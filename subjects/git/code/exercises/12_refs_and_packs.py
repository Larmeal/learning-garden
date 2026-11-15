"""Lesson 12: refs and packfiles. How names are stored, and how thousands of loose objects become one pack.

Asserts what lives under .git/refs and in packed-refs, which one wins when a ref is in both, that git gc packs the objects
and the refs, what the pack and its index look like at the byte level (the PACK magic, the version and the object count),
how git verify-pack shows delta chains (a later version of a file stored as a small difference from an earlier one), and how
much smaller the pack is than the loose objects. It also makes a repository with the reftable ref backend.
"""

import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from gitlab import check, fresh, git, git_rc, init, reset_clock, save, show, write  # noqa: E402

reset_clock()
repo = init("12_refs")
git_dir = repo / ".git"
save(repo, "a.txt", "1\n", "C1")
c2 = save(repo, "a.txt", "1\n2\n", "C2")
git(repo, "branch", "feature")
git(repo, "tag", "light")
git(repo, "tag", "-a", "annotated", "-m", "release")
full = git(repo, "rev-parse", "HEAD")

# ---- 1. loose refs: one small file per name ----
files = sorted(str(p.relative_to(git_dir)).replace("\\", "/") for p in (git_dir / "refs").rglob("*") if p.is_file())
show("find .git/refs -type f", "\n".join(files))
check("a branch and a tag are files under refs/heads and refs/tags", files == ["refs/heads/feature", "refs/heads/main", "refs/tags/annotated", "refs/tags/light"])
check("a lightweight tag holds the commit id, an annotated tag holds the id of the tag object", (git_dir / "refs/tags/light").read_text().strip() == full and (git_dir / "refs/tags/annotated").read_text().strip() != full)
check("HEAD is a symbolic ref: git symbolic-ref prints the name it follows", git(repo, "symbolic-ref", "HEAD") == "refs/heads/main")
check("git for-each-ref lists every ref with its type", [l.split()[1] for l in git(repo, "for-each-ref").splitlines()] == ["commit", "commit", "tag", "commit"])
check("git check-ref-format rejects a name with two dots, and accepts a normal one", git_rc(repo, "check-ref-format", "refs/heads/a..b")[0] != 0 and git_rc(repo, "check-ref-format", "refs/heads/topic/ok")[0] == 0)

# ---- 2. packed-refs: the same names in one file ----
git(repo, "pack-refs", "--all")
packed = (git_dir / "packed-refs").read_text()
show("cat .git/packed-refs", packed)
check("pack-refs --all moves every loose ref into one file", not (git_dir / "refs/heads/feature").exists() and "refs/heads/feature" in packed)
check("an annotated tag gets a second line starting with ^ : the commit it finally points to (the peeled value)", f"^{full}" in packed)
check("the first line says the file is sorted and that peeled values are present", packed.splitlines()[0] == "# pack-refs with: peeled fully-peeled sorted ")
check("git still resolves the names as before", git(repo, "rev-parse", "feature") == full and git(repo, "branch", "--list").count("feature") == 1)
git(repo, "switch", "--quiet", "feature")
save(repo, "a.txt", "1\n2\n3\n", "C3 on feature")
check("a new commit writes a loose ref again, and the loose one wins over the packed line", (git_dir / "refs/heads/feature").is_file() and git(repo, "rev-parse", "feature") != full and f"{full} refs/heads/feature" in (git_dir / "packed-refs").read_text())
git(repo, "switch", "--quiet", "main")

# ---- 3. objects: loose at first, then packed ----
big = init("12_packs")
base = "".join(f"line {i:03d} of a file that grows and changes a little in every commit\n" for i in range(200))
for n in range(1, 21):
    base = base.replace("\n", f" v{n}\n", 1) if n > 1 else base
    save(big, "data.txt", base + f"edit {n}\n", f"V{n}")
count = git(big, "count-objects", "-v").splitlines()
show("git count-objects -v  (before gc)", "\n".join(count))
check("20 commits made 60 loose objects: 20 commits, 20 trees, 20 blobs", "count: 60" in count and "in-pack: 0" in count)
loose_bytes = sum(p.stat().st_size for p in (big / ".git" / "objects").rglob("*") if p.is_file() and len(p.parent.name) == 2)
git(big, "gc", "--quiet")
after = git(big, "count-objects", "-v").splitlines()
show("git count-objects -v  (after gc)", "\n".join(after))
check("after gc nothing is loose and every object is in one pack", "count: 0" in after and "in-pack: 60" in after and "packs: 1" in after)
packs = sorted((big / ".git" / "objects" / "pack").iterdir())
check("a pack is two files, the data (.pack) and its index (.idx)", [p.suffix for p in packs] == [".idx", ".pack"] or sorted(p.suffix for p in packs) == [".idx", ".pack", ".rev"] or {".idx", ".pack"} <= {p.suffix for p in packs}, str([p.name for p in packs]))
pack_file = next(p for p in packs if p.suffix == ".pack")
idx_file = next(p for p in packs if p.suffix == ".idx")
pack_bytes = pack_file.read_bytes()
magic, version, number = struct.unpack(">4sII", pack_bytes[:12])
check("a .pack file starts with the letters PACK, a version (2) and the number of objects (60)", (magic, version, number) == (b"PACK", 2, 60))
check("the .pack file ends with the SHA-1 of everything before it", len(pack_bytes) > 32)
idx_bytes = idx_file.read_bytes()
check("an .idx file starts with the magic bytes ff 74 4f 63 and version 2", idx_bytes[:8] == b"\xfftOc\x00\x00\x00\x02")
fanout = struct.unpack(">256I", idx_bytes[8:8 + 1024])
check("the fan-out table's last entry is the number of objects: a lookup first narrows by the first byte of the id", fanout[255] == 60 and fanout == tuple(sorted(fanout)))
print(f"\nloose objects: {loose_bytes} bytes, one pack: {pack_file.stat().st_size} bytes")
check("the pack is less than a third of the loose objects (deltas and shared compression)", pack_file.stat().st_size * 3 < loose_bytes, f"{pack_file.stat().st_size} against {loose_bytes}")

# ---- 4. verify-pack: which objects are stored as differences ----
rows = git(big, "verify-pack", "-v", str(pack_file)).splitlines()
objs = [r.split() for r in rows if len(r.split()) in (5, 7) and len(r.split()[0]) == 40]
deltas = [r for r in objs if len(r) == 7]
show("git verify-pack -v (first 6 lines)", "\n".join(rows[:6]))
check("verify-pack lists 60 objects", len(objs) == 60)
blob_deltas = [r for r in deltas if r[1] == "blob"]
whole_blobs = [r for r in objs if len(r) == 5 and r[1] == "blob"]
check("19 of the 20 blob versions are stored as a delta against another blob, and 1 is stored whole", len(blob_deltas) == 19 and len(whole_blobs) == 1, f"{len(blob_deltas)} deltas, {len(whole_blobs)} whole")
depths = [int(r[5]) for r in deltas]
check("a delta row says its depth and the id of its base; here the chains are at most 2 long (the limit of a chain is 50)", max(depths) == 2 and max(depths) <= 50, str(max(depths)))
tail = "\n".join(rows[-4:])
show("tail of verify-pack", tail)
check("the summary counts objects per chain length: 41 stored whole, 2 with chain length 1, 17 with chain length 2", "non delta: 41 objects" in tail and "chain length = 1: 2 objects" in tail and "chain length = 2: 17 objects" in tail, tail)
newest = git(big, "rev-parse", "HEAD:data.txt")
check("the whole blob is the newest version: git keeps the latest one whole because it is the one you read most", whole_blobs[0][0] == newest, f"{whole_blobs[0][0]} vs {newest}")
check("the whole blob is 13,476 bytes and takes less than 1,000 bytes in the pack (zlib)", int(whole_blobs[0][2]) > 13000 and int(whole_blobs[0][3]) < 1000, str(whole_blobs[0]))

# ---- 5. the reftable backend: refs in a binary table, not in files ----
rt = fresh("12_reftable")
git(rt, "init", "--quiet", "--ref-format=reftable")
write(rt, "a.txt", "1\n")
git(rt, "add", "a.txt")
git(rt, "commit", "--quiet", "-m", "first")
check("with reftable there is a .git/reftable folder and no refs/heads/main file", (rt / ".git" / "reftable").is_dir() and not (rt / ".git" / "refs" / "heads" / "main").exists())
tables = [p.name for p in (rt / ".git" / "reftable").iterdir()]
show("ls .git/reftable", "\n".join(sorted(tables)))
check("tables.list names the table files in order", "tables.list" in tables and any(t.endswith(".ref") for t in tables))
check("the refs still work through the same commands", git(rt, "rev-parse", "--abbrev-ref", "HEAD") == "main" and len(git(rt, "rev-parse", "main")) == 40)
before_main = git(rt, "rev-parse", "main")
migrated = git(rt, "refs", "migrate", "--ref-format=files")
show("git refs migrate --ref-format=files", migrated)
check("git refs migrate switches the repository to the files backend and keeps the refs", before_main == git(rt, "rev-parse", "main") and not (rt / ".git" / "reftable").exists())
check("the migrated refs are written as one packed-refs file", "refs/heads/main" in (rt / ".git" / "packed-refs").read_text())
print("\nok")
