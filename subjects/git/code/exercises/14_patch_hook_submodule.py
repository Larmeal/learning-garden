"""Lesson 14: three ways Git reaches beyond one repository: patches, hooks and submodules.

Asserts what format-patch writes and what git am rebuilds from it, that a pre-commit hook can stop a commit and a
pre-receive hook on the remote can stop a push, that hooks are not part of what clone copies, and what a submodule is:
a .gitmodules file and a tree entry of mode 160000 that holds a commit id of another repository.
"""

import os
import stat
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from gitlab import LAB, check, fresh, git, git_rc, init, reset_clock, save, show, write  # noqa: E402

reset_clock()
rev = lambda repo, name: git(repo, "rev-parse", name)  # noqa: E731


def hook(repo: Path, name: str, body: str) -> None:
    path = repo / ("hooks" if (repo / "hooks").is_dir() and not (repo / ".git").exists() else ".git/hooks") / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(("#!/bin/sh\n" + body).encode())
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


# ---- 1. a patch is a commit written as an e-mail ----
src = init("14_patch_src")
save(src, "a.txt", "1\n", "A1 first")
save(src, "a.txt", "1\n2\n", "A2 add a second line")
save(src, "b.txt", "b\n", "A3 add b")
out = git(src, "format-patch", "-2", "-o", str(src.parent / "14_patches"))
files = sorted(Path(l).name for l in out.splitlines())
show("git format-patch -2", "\n".join(files))
check("format-patch writes one numbered file per commit, named after the subject", files == ["0001-A2-add-a-second-line.patch", "0002-A3-add-b.patch"], str(files))
text = (src.parent / "14_patches" / files[0]).read_text()
show("head of 0001-...patch", "\n".join(text.splitlines()[:16]))
check("a patch file is a mail: From, Date and Subject headers, then the message, then the diff", text.startswith("From ") and "\nFrom: Ada <ada@example.com>\n" in text and "\nSubject: [PATCH 1/2] A2 add a second line\n" in text and "\n+2\n" in text)
check("it starts with the id of the commit it came from", text.split()[1] == rev(src, "HEAD~1"))

dst = init("14_patch_dst")
save(dst, "a.txt", "1\n", "A1 first")
git(dst, "am", "--quiet", str(src.parent / "14_patches" / files[0]), str(src.parent / "14_patches" / files[1]))
check("git am makes the same commits again: same author, same message, same files", git(dst, "log", "--format=%an|%s", "-n", "2") == "Ada|A3 add b\nAda|A2 add a second line" and (dst / "b.txt").exists())
check("the files are identical: same tree id as the source", rev(dst, "HEAD^{tree}") == rev(src, "HEAD^{tree}"))
check("the author date is kept from the patch, the committer date is the time of git am, and the parent differs here, so the commit ids are not the same", git(dst, "log", "--format=%ad", "-n", "1") == git(src, "log", "--format=%ad", "-n", "1") and rev(dst, "HEAD") != rev(src, "HEAD"))
check("git apply --check tells whether a patch fits, without changing anything", git_rc(dst, "apply", "--check", str(src.parent / "14_patches" / files[1]))[0] != 0)
write(dst, "a.txt", "something else\n")
code, out = git_rc(dst, "apply", "--check", str(src.parent / "14_patches" / files[0]))
check("a patch that does not match the file is refused, and nothing is changed", code != 0 and "patch does not apply" in out and (dst / "a.txt").read_text() == "something else\n", out)

# ---- 2. a hook on your side: pre-commit can say no ----
repo = init("14_hooks")
save(repo, "a.txt", "1\n", "C1")
hook(repo, "pre-commit", 'if git diff --cached | grep -q "^+.*DEBUG"; then\n  echo "pre-commit: remove the DEBUG line first" >&2\n  exit 1\nfi\n')
write(repo, "a.txt", "1\nDEBUG print\n")
git(repo, "add", "a.txt")
code, out = git_rc(repo, "commit", "-m", "C2 with debug")
show("git commit  (the hook says no)", out)
check("a pre-commit hook that exits non-zero stops the commit", code != 0 and "remove the DEBUG line" in out and git(repo, "log", "--format=%s") == "C1", out)
code, out = git_rc(repo, "commit", "--no-verify", "-m", "C2 with debug")
check("--no-verify skips the pre-commit and commit-msg hooks", code == 0 and git(repo, "log", "--format=%s", "-n", "1") == "C2 with debug", out)
hook(repo, "commit-msg", 'echo "Signed-off-by: Ada" >> "$1"\n')
write(repo, "a.txt", "1\nmore\n")
git(repo, "add", "a.txt")
git(repo, "commit", "--quiet", "-m", "C3 clean")
check("a commit-msg hook can change the message before the commit is made", git(repo, "log", "--format=%B", "-n", "1").strip().endswith("Signed-off-by: Ada"))
check("hooks are files in .git/hooks, and the samples that git init writes end in .sample so they do nothing", (repo / ".git" / "hooks" / "pre-commit.sample").is_file() and (repo / ".git" / "hooks" / "pre-commit").is_file())

# ---- 3. a hook is not part of the repository: clone does not copy it ----
copy = fresh("14_hooks_clone")
git(copy, "clone", "--quiet", str(repo), ".")
check("a clone has the sample hooks of git init, and not the hooks of the repository it came from", not (copy / ".git" / "hooks" / "pre-commit").exists() and not (copy / ".git" / "hooks" / "commit-msg").exists())
shared = repo / "shared-hooks"
shared.mkdir()
(shared / "pre-commit").write_bytes(b"#!/bin/sh\necho shared hook ran >&2\nexit 0\n")
git(repo, "config", "core.hooksPath", "shared-hooks")
check("core.hooksPath points git at a folder, which can live in the repository and be versioned", git(repo, "config", "core.hooksPath") == "shared-hooks")

# ---- 4. a hook on the server: pre-receive can reject a push ----
origin = init("14_remote.git", bare=True)
hook(origin, "pre-receive", 'while read old new ref; do\n  if git log --format=%s "$old..$new" 2>/dev/null | grep -qi "^WIP"; then\n    echo "pre-receive: no WIP commits on $ref" >&2\n    exit 1\n  fi\ndone\n')
work = fresh("14_remote_work")
git(work, "clone", "--quiet", origin.as_posix(), ".")
save(work, "a.txt", "1\n", "A1 first")
git(work, "push", "--quiet", "origin", "main")
save(work, "a.txt", "1\n2\n", "WIP half done")
code, out = git_rc(work, "push", "origin", "main")
show("git push  (the remote's hook says no)", out)
check("a pre-receive hook on the remote rejects the push, and the remote does not change", code != 0 and "no WIP commits" in out and "pre-receive hook declined" in out and rev(origin, "main") != rev(work, "main"), out)
git(work, "commit", "--quiet", "--amend", "-m", "A2 finished")
code, out = git_rc(work, "push", "origin", "main")
check("after the commit message is fixed the same push is accepted", code == 0 and rev(origin, "main") == rev(work, "main"), out)

# ---- 5. a submodule: another repository, pinned to one commit ----
lib = init("14_lib")
save(lib, "lib.txt", "v1\n", "L1 library v1")
lib_v1 = rev(lib, "HEAD")
probe = init("14_super_probe")
save(probe, "a.txt", "a\n", "P1")
code, out = git_rc(probe, "submodule", "add", lib.as_posix(), "vendor/lib")
show("git submodule add <a folder>  (without the protocol option)", out)
check("a folder on the same computer is refused as a submodule url unless protocol.file.allow is set: transport 'file' not allowed", code != 0 and "transport 'file' not allowed" in out, out)
main = init("14_super")
save(main, "app.txt", "app\n", "S1 app")
git(main, "-c", "protocol.file.allow=always", "submodule", "add", "--quiet", lib.as_posix(), "vendor/lib")
show("cat .gitmodules", (main / ".gitmodules").read_text())
check(".gitmodules lists the path and the url of every submodule", '[submodule "vendor/lib"]' in (main / ".gitmodules").read_text() and "path = vendor/lib" in (main / ".gitmodules").read_text())
git(main, "commit", "--quiet", "-m", "S2 add the library")
entry = git(main, "ls-tree", "HEAD", "vendor/lib")
show("git ls-tree HEAD vendor/lib", entry)
check("in the tree, the submodule is an entry of mode 160000 (a gitlink) that holds a commit id of the other repository", entry == f"160000 commit {lib_v1}\tvendor/lib")
check("the files of the library are not stored in the main repository at all", git(main, "ls-files", "vendor/lib") == "vendor/lib" and (main / "vendor" / "lib" / "lib.txt").is_file())
check("git submodule status shows the pinned commit id", git(main, "submodule", "status").strip().startswith(lib_v1))

save(lib, "lib.txt", "v1\nv2\n", "L2 library v2")
check("the main repository does not follow the library by itself", git(main, "submodule", "status").strip().startswith(lib_v1))
sub = main / "vendor" / "lib"
git(sub, "-c", "protocol.file.allow=always", "pull", "--quiet", "origin", "main")
check("after the submodule is updated, the main repository sees a change of the pointer", git(main, "status", "--short") == " M vendor/lib", git(main, "status", "--short"))
git(main, "add", "vendor/lib")
git(main, "commit", "--quiet", "-m", "S3 use library v2")
check("committing it records the new commit id, which is what makes a build repeatable", git(main, "ls-tree", "HEAD", "vendor/lib").split()[2] == rev(lib, "HEAD"))

clone = fresh("14_super_clone")
git(clone, "-c", "protocol.file.allow=always", "clone", "--quiet", main.as_posix(), ".")
check("a plain clone makes the submodule folder, but leaves it empty", (clone / "vendor" / "lib").is_dir() and not any((clone / "vendor" / "lib").iterdir()))
git(clone, "-c", "protocol.file.allow=always", "submodule", "update", "--init", "--quiet")
check("git submodule update --init fetches it and checks out the pinned commit", (clone / "vendor" / "lib" / "lib.txt").read_text() == "v1\nv2\n")
print("\nok")
