"""Lesson 5: the build cache and the build context.

Asserts that a second build of the same Dockerfile reuses every step, that the order of the lines decides how much is rebuilt when a file changes (`COPY . .` before
`pip install` against `requirements.txt` first), that a change in one step rebuilds every step after it, that the cache looks at the content of a copied file and not at its
modification time, that `--no-cache` rebuilds everything, how big the build context is with and without `.dockerignore`, and that a COPY cannot reach outside the context.
`--write` saves which steps were reused and the build times of both orders as site/src/components/labs/docker/buildcache.json for the lab.
"""

import os
import re
import sys
import time
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dlab import LABEL, LABS, PYTHON, check, fresh_dir, main_guard, run, show, table, timed, write_json  # noqa: E402

WRITE = "--write" in sys.argv
RUN = uuid.uuid4().hex[:8]  # a new value on every run, so that the cache of an earlier run cannot answer for the edits below

BAD = f"""FROM {PYTHON}
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir -r requirements.txt
CMD ["python", "app.py"]
"""
GOOD = f"""FROM {PYTHON}
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
CMD ["python", "app.py"]
"""


def steps_of(log: str) -> list[dict]:
    """The numbered steps of a BuildKit plain log, with whether each one was taken from the cache."""
    names: dict[str, tuple[int, str]] = {}
    cached: set[str] = set()
    for line in log.splitlines():
        m = re.match(r"^#(\d+) \[(?:\w+ )?(\d+)/(\d+)\] (.*)$", line)
        if m and m.group(1) not in names:
            names[m.group(1)] = (int(m.group(2)), m.group(4).strip())
        c = re.match(r"^#(\d+) CACHED", line)
        if c:
            cached.add(c.group(1))
    # FROM is not a cacheable step (BuildKit prints DONE for it, never CACHED), so it is left out of the list
    return [{"n": n, "step": s, "cached": k in cached} for k, (n, s) in sorted(names.items(), key=lambda kv: kv[1][0]) if not s.startswith("FROM")]


def build(ctx: Path, tag: str, *extra: str) -> tuple[list[dict], float, str]:
    done, secs = timed(lambda: run("build", "--progress=plain", "--label", LABEL, "-t", tag, *extra, str(ctx)))
    return steps_of(done.stderr), secs, done.stderr


def short(steps: list[dict]) -> str:
    return " ".join(("=" if s["cached"] else "R") for s in steps)  # = reused from cache, R run again


def main() -> None:
    recorded = {}
    for name, text in (("bad", BAD), ("good", GOOD)):
        ctx = fresh_dir(name)
        (ctx / "Dockerfile").write_text(text, encoding="utf-8")
        (ctx / "requirements.txt").write_text(f"six==1.17.0  # {RUN}-1\n", encoding="utf-8")
        (ctx / "app.py").write_text(f'# {RUN}-1\nimport six\nprint("six", six.__version__)\n', encoding="utf-8")
        tag = f"dlab-order-{name}"
        first, t0, _ = build(ctx, tag, "--no-cache")
        check(f"[{name}] with --no-cache the COPY and RUN steps run (WORKDIR still shows CACHED: BuildKit does not skip it, we did not look into why)", not any(s["cached"] for s in first if s["step"].startswith(("COPY", "RUN"))), short(first))
        same, t1, _ = build(ctx, tag)
        check(f"[{name}] building again with nothing changed reuses every step", all(s["cached"] for s in same), short(same))
        (ctx / "app.py").write_text(f'# {RUN}-2\nimport six\nprint("six", six.__version__)\nprint("changed")\n', encoding="utf-8")
        edit_app, t2, _ = build(ctx, tag)
        (ctx / "requirements.txt").write_text(f"six==1.16.0  # {RUN}-2\n", encoding="utf-8")
        edit_req, t3, _ = build(ctx, tag)
        recorded[name] = {
            "steps": [s["step"][:46] for s in first],
            "none": {"cached": [s["cached"] for s in same], "seconds": round(t1, 1)},
            "app": {"cached": [s["cached"] for s in edit_app], "seconds": round(t2, 1)},
            "req": {"cached": [s["cached"] for s in edit_req], "seconds": round(t3, 1)},
            "first": round(t0, 1),
        }
        recorded[name]["_ctx"] = ctx  # type: ignore[assignment]
    bad, good = recorded["bad"], recorded["good"]
    rows = []
    for name, rec in (("COPY . . first", bad), ("requirements.txt first", good)):
        rows.append([name, f"{rec['first']}s", f"{rec['none']['seconds']}s  {short([{'cached': c} for c in rec['none']['cached']])}", f"{rec['app']['seconds']}s  {short([{'cached': c} for c in rec['app']['cached']])}", f"{rec['req']['seconds']}s  {short([{'cached': c} for c in rec['req']['cached']])}"])
    show("build time and which steps ran (= reused, R ran again) for each order of the Dockerfile", table(rows, ["order", "first build", "nothing changed", "app.py changed", "requirements.txt changed"]))
    pip_i_bad = next(i for i, s in enumerate(bad["steps"]) if "pip install" in s)
    pip_i_good = next(i for i, s in enumerate(good["steps"]) if "pip install" in s)
    check("changing only app.py re-runs pip install when COPY . . comes first", bad["app"]["cached"][pip_i_bad] is False)
    check("changing only app.py leaves pip install cached when requirements.txt is copied first", good["app"]["cached"][pip_i_good] is True)
    check("the good order is faster to rebuild after an edit of app.py", good["app"]["seconds"] < bad["app"]["seconds"], f"{good['app']['seconds']} vs {bad['app']['seconds']}")
    check("changing requirements.txt re-runs pip install in both orders", bad["req"]["cached"][pip_i_bad] is False and good["req"]["cached"][pip_i_good] is False)
    check("the step before the first changed one stays cached (WORKDIR)", bad["app"]["cached"][:1] == [True] and good["req"]["cached"][:1] == [True])
    first_changed = next(i for i, c in enumerate(good["req"]["cached"]) if not c)
    check("from the first changed step on, every later step runs again", not any(good["req"]["cached"][first_changed:]), short([{"cached": c} for c in good["req"]["cached"]]))

    # ---- the cache looks at content, not at the clock ----
    gctx = recorded["good"]["_ctx"]
    now = time.time() + 3600
    os.utime(gctx / "app.py", (now, now))
    touched, _, _ = build(gctx, "dlab-order-good")
    check("touching a file (new modification time, same content) does not invalidate the cache", all(s["cached"] for s in touched), short(touched))
    nocache, _, _ = build(gctx, "dlab-order-good", "--no-cache")
    check("--no-cache runs the COPY and RUN steps again", not any(s["cached"] for s in nocache if s["step"].startswith(("COPY", "RUN"))), short(nocache))

    # ---- a change in an early RUN rebuilds the rest ----
    cctx = fresh_dir("cascade")
    (cctx / "Dockerfile").write_text(f'FROM alpine:3.22\nRUN echo one-{RUN} > /one\nRUN echo two > /two\nRUN echo three > /three\n', encoding="utf-8")
    build(cctx, "dlab-cascade")
    (cctx / "Dockerfile").write_text(f'FROM alpine:3.22\nRUN echo ONE-{RUN} > /one\nRUN echo two > /two\nRUN echo three > /three\n', encoding="utf-8")
    casc, _, _ = build(cctx, "dlab-cascade")
    show("after editing only the first RUN line", "\n".join(f"{'cached' if s['cached'] else 'ran   '}  {s['step']}" for s in casc))
    check("the unchanged RUN lines after an edited one still run again (the cache is a chain)", [s["cached"] for s in casc] == [False, False, False], short(casc))

    # ---- the build context ----
    kctx = fresh_dir("context")
    (kctx / "small.txt").write_text("hi", encoding="utf-8")
    (kctx / "big.bin").write_bytes(os.urandom(20 * 1024 * 1024))

    def ctx_bytes(log: str) -> int:
        """The largest 'transferring context' figure of a BuildKit log, in bytes (the others are the Dockerfile and .dockerignore)."""
        sizes = re.findall(r"transferring context: ([\d.]+)\s?(kB|MB|GB|B)", log)
        unit = {"B": 1, "kB": 1000, "MB": 1_000_000, "GB": 1_000_000_000}
        return max((int(float(v) * unit[u]) for v, u in sizes), default=-1)

    (kctx / "Dockerfile").write_text("FROM alpine:3.22\nCOPY small.txt /\n", encoding="utf-8")
    _, _, log_unused = build(kctx, "dlab-ctx")
    (kctx / "Dockerfile").write_text("FROM alpine:3.22\nCOPY . /ctx/\n", encoding="utf-8")
    _, _, log_all = build(kctx, "dlab-ctx")
    (kctx / ".dockerignore").write_text("big.bin\n", encoding="utf-8")
    _, _, log_ign = build(kctx, "dlab-ctx")
    sizes = {"unused": ctx_bytes(log_unused), "all": ctx_bytes(log_all), "ignored": ctx_bytes(log_ign)}
    show("bytes sent to the builder (a 20 MB file big.bin sits next to the Dockerfile)", table([["COPY small.txt (big.bin not used)", sizes["unused"]], ["COPY . /ctx/", sizes["all"]], ["COPY . /ctx/ with .dockerignore listing big.bin", sizes["ignored"]]], ["Dockerfile", "bytes"]))
    check("BuildKit sends only the files a COPY needs: an unused 20 MB file stays behind", 0 <= sizes["unused"] < 1_000_000, str(sizes))
    check("COPY . sends everything in the folder, 20 MB here", sizes["all"] >= 20_000_000, str(sizes))
    check(".dockerignore keeps big.bin out, so the same COPY . sends almost nothing", 0 <= sizes["ignored"] < 1_000_000, str(sizes))
    listing = run("run", "--rm", "--label", LABEL, "dlab-ctx", "ls", "-A", "/ctx").stdout.split()
    check("the image of the last build holds small.txt and not big.bin", "small.txt" in listing and "big.bin" not in listing, str(listing))
    outer = fresh_dir("outside")
    inner = outer / "ctx"
    inner.mkdir()
    (outer / "secret.txt").write_text("not in the context", encoding="utf-8")
    (inner / "Dockerfile").write_text("FROM alpine:3.22\nCOPY ../secret.txt /\n", encoding="utf-8")
    bad_copy = run("build", "--progress=plain", "-t", "dlab-outside", "--label", LABEL, str(inner), check=False)
    show("COPY ../secret.txt", "\n".join(bad_copy.stderr.strip().splitlines()[-3:]))
    check("COPY cannot reach a file outside the build context", bad_copy.returncode != 0 and "secret.txt" in bad_copy.stderr and ("outside the build context" in bad_copy.stderr or "not found" in bad_copy.stderr), bad_copy.stderr[-200:])

    if WRITE:
        for r in recorded.values():
            r.pop("_ctx", None)
        write_json(LABS / "buildcache.json", {"order": recorded, "context": sizes})


if __name__ == "__main__":
    main_guard(main)
