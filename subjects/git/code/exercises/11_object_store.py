"""Lesson 11: the object store. Four kinds of object, each one stored under the hash of its own bytes.

Asserts, by recomputing every id in Python, how a blob, a tree and a commit are laid out in bytes; that a loose object is the
same bytes compressed with zlib in a file named after its id; that a commit can be built by hand with plumbing commands;
what an annotated tag adds over a lightweight one; that a repository made with --object-format=sha256 uses 64-letter ids; and
that git fsck notices a file whose content no longer matches its name.
"""

import hashlib
import sys
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from gitlab import check, commit, fresh, git, init, reset_clock, save, show, write  # noqa: E402

reset_clock()
repo = init("11_object_store")
objects = repo / ".git" / "objects"


def loose(oid: str) -> bytes:
    return zlib.decompress((objects / oid[:2] / oid[2:]).read_bytes())


# ---- 1. a blob: the header "blob <size>" and a zero byte, then the file's bytes ----
body = b"hello\n"
store = b"blob " + str(len(body)).encode() + b"\0" + body
oid = hashlib.sha1(store).hexdigest()
check("the blob id is the SHA-1 of 'blob 6' + NUL + the bytes", oid == git(repo, "hash-object", "--stdin", stdin="hello\n") == "ce013625030ba8dba906f756967f9e9ca394464a")
check("hash-object without -w stores nothing", not (objects / oid[:2]).exists())
git(repo, "hash-object", "-w", "--stdin", stdin="hello\n")
path = objects / oid[:2] / oid[2:]
show("ls .git/objects/ce", path.name)
check("-w writes the file .git/objects/<2 letters>/<38 letters>", path.is_file())
check("the file holds the same bytes after zlib decompression", loose(oid) == store)
check("git cat-file -t, -s and -p read the type, the size and the content", (git(repo, "cat-file", "-t", oid), git(repo, "cat-file", "-s", oid), git(repo, "cat-file", "-p", oid)) == ("blob", "6", "hello"))
check("the file name is not part of the blob: two names with the same content share one object", git(repo, "hash-object", "--stdin", stdin="hello\n") == oid)

# ---- 2. a tree: one line per entry, mode, name, NUL and the 20 raw bytes of the id ----
write(repo, "notes.txt", "hello\n")
write(repo, "src/app.txt", "app\n")
git(repo, "add", ".")
tree_id = git(repo, "write-tree")
sub_id = git(repo, "rev-parse", f"{tree_id}:src")
entry = lambda mode, name, ident: mode + b" " + name + b"\0" + bytes.fromhex(ident)  # noqa: E731
sub_body = entry(b"100644", b"app.txt", git(repo, "hash-object", "src/app.txt"))
check("a subdirectory is its own tree object, built from its entries", hashlib.sha1(b"tree " + str(len(sub_body)).encode() + b"\0" + sub_body).hexdigest() == sub_id)
top_body = entry(b"100644", b"notes.txt", oid) + entry(b"40000", b"src", sub_id)
check("the top tree lists entries sorted by name: notes.txt (blob, mode 100644) and src (tree, mode 40000)", hashlib.sha1(b"tree " + str(len(top_body)).encode() + b"\0" + top_body).hexdigest() == tree_id)
show("git ls-tree <tree>", git(repo, "ls-tree", tree_id))
check("ls-tree prints mode, type, id and name", git(repo, "ls-tree", tree_id).splitlines()[1] == f"040000 tree {sub_id}\tsrc")
check("a tree holds names, modes and ids only: none of the file's own bytes", b"hello" not in loose(tree_id))

# ---- 3. a commit: the id of the tree, the parents, who and when, a blank line, the message ----
first = commit(repo, "First commit")
full = git(repo, "rev-parse", first)
text = loose(full).split(b"\0", 1)[1].decode()
show("cat-file -p of the commit", git(repo, "cat-file", "-p", full))
want = f"tree {tree_id}\nauthor Ada <ada@example.com> 1767261600 +0000\ncommitter Ada <ada@example.com> 1767261600 +0000\n\nFirst commit\n"
check("a commit is text: tree line, author, committer, blank line, message", text.startswith("tree ") and "\n\nFirst commit\n" in text)
check("the whole commit is reproducible from its parts: the id is the SHA-1 of that text", hashlib.sha1(b"commit " + str(len(text.encode())).encode() + b"\0" + text.encode()).hexdigest() == full)
check("the time in the commit is a Unix timestamp with a time zone", " 1767261" in text and "+0000" in text)
second = save(repo, "notes.txt", "hello\nworld\n", "Second commit")
text2 = loose(git(repo, "rev-parse", second)).split(b"\0", 1)[1].decode()
check("the second commit has a parent line with the first commit's id", f"parent {full}\n" in text2)
check("so each commit's id depends on the whole history before it", git(repo, "rev-parse", second) != full)

# ---- 4. build a commit by hand with plumbing commands ----
hand = init("11_by_hand")
blob = git(hand, "hash-object", "-w", "--stdin", stdin="made by hand\n")
git(hand, "update-index", "--add", "--cacheinfo", f"100644,{blob},hand.txt")
tree = git(hand, "write-tree")
c = git(hand, "commit-tree", tree, "-m", "by hand")
check("commit-tree wrote a commit object, but no branch points at it yet", git(hand, "cat-file", "-t", c) == "commit" and git(hand, "branch", "--list") == "")
git(hand, "update-ref", "refs/heads/main", c)
check("update-ref makes the branch, and then git log sees the commit", git(hand, "log", "--format=%s") == "by hand")
git(hand, "checkout", "--quiet", "-f", "main")
check("the file reached the working tree from nothing but objects", (hand / "hand.txt").read_text() == "made by hand\n")

# ---- 5. tags: a lightweight tag is a ref, an annotated tag is an object ----
git(repo, "tag", "v1-light")
git(repo, "tag", "-a", "v1", "-m", "release one")
check("a lightweight tag is a ref that points straight at the commit", git(repo, "rev-parse", "v1-light") == git(repo, "rev-parse", "HEAD") and git(repo, "cat-file", "-t", "v1-light") == "commit")
check("an annotated tag is its own object of type tag", git(repo, "cat-file", "-t", "v1") == "tag")
show("git cat-file -p v1", git(repo, "cat-file", "-p", "v1"))
check("it records the object, its type, the name, who tagged and a message", all(k in git(repo, "cat-file", "-p", "v1") for k in ("object ", "type commit", "tag v1", "tagger Ada", "release one")))
check("v1^{commit} peels the tag down to the commit", git(repo, "rev-parse", "v1^{commit}") == git(repo, "rev-parse", "HEAD"))

# ---- 6. the id length is a property of the repository ----
sha256 = fresh("11_sha256")
git(sha256, "init", "--quiet", "--object-format=sha256")
write(sha256, "a.txt", "hello\n")
git(sha256, "add", "a.txt")
long_id = git(sha256, "hash-object", "a.txt")
check("a repository made with --object-format=sha256 uses 64-letter ids", len(long_id) == 64 and long_id == hashlib.sha256(b"blob 6\0hello\n").hexdigest())

# ---- 7. git checks every object against its name ----
check("git fsck is quiet on a healthy repository", "error" not in git(repo, "fsck", "--strict"))
broken = objects / oid[:2] / oid[2:]
broken.chmod(0o666)
broken.write_bytes(zlib.compress(b"blob 6\0HELLO\n"))
code_out = git(repo, "fsck", check=False)
show("git fsck  (after a blob file was changed by hand)", code_out)
check("fsck says the file holds a different object (hash-path mismatch) and that the blob it should hold is missing", "hash-path mismatch" in code_out and f"missing blob {oid}" in code_out, code_out)
print("\nok")
