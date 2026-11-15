# Sources of the Git subject

## Books (kept outside the repo)

Both are PDFs in `E:\books\Command Line & Developer Tools\Version Control\`. They were converted to text with `pdftotext` (one page per form feed) so that a
claim can be given a printed page. The text has captions and the words around a figure, but not the figures: **no figure of either book was seen**.

| Book | Used for | Page offset (printed page = PDF page minus offset) |
|---|---|---|
| *Version Control with Git*, 3rd edition, Prem Kumar Ponuthorai and Jon Loeliger (O'Reilly, 2022). 18 chapters in 5 parts. Cited as **VCWG** | internals (objects, index, packfiles), merge, rebase, remotes, history surgery, the reflog, hooks, submodules | 20. Checked on 70 pages spread over the book: all match. |
| *Learning Git*, Anna Skoulikari (O'Reilly, 2023). 12 chapters, the running Rainbow project. Cited as **LG** | the three areas, first commit, branches, merge conflicts, remotes and pull requests, written for a beginner | about 22. Checked on only 2 pages (its printed page numbers are hard to find in the text), so a page may be one or two off. |

Page rule, as in the other subjects: a citation gives the chapter or section and the printed page where the section starts (for example `VCWG บทที่ 2 หน้า 26`).
A page header is the top of its page, so a passage belongs to the nearest header **above** it. Where a search found only the first page on which a word appears,
the lesson cites the page that opens the section, read by hand. Never the section sign or "ch.".

## The Git source and its knowledge graph

- Source: `E:\Development\Project\open-source\git`, a shallow clone at tag **v2.56.1**, commit `03b41523c576f26ad34085378717a0c1b287470f`.
- The graph (`graphs/git-current/`) covers the C and header files at the root and in `builtin/`, `refs/`, `odb/`, `xdiff/` and `reftable/`: 681 files, 9,621 nodes
  (8,019 functions, 921 structs and enums), 25,983 edges, 10 layers, an 18-step tour. Shell, Perl, `contrib/`, `t/` and the documentation were left out.
- Built with the `understand-to-self-learning` skill in 42 batches by file-analyzer agents. Limits that matter when you cite it:
  - A `calls` edge exists only where the callee has a node. Functions shorter than 10 lines that are not exported have no node, so many calls are missing.
    83 calls that pointed at a function without a node were dropped at merge.
  - 85 files have no function or class node (most are headers), and 80 files that do have functions have no `calls` edge.
  - 915 function nodes that an agent had made in a header were merged into the `.c` node of the same name.
  - A spot check of 617 `lineRange` values against the source: 614 right, 3 ended a few lines off.
  - Summaries were written by the agents from reading the code. Some agents said they read only part of a very long function (for example `handle_revision_opt`).
- A claim tagged **source** in a lesson was checked in the source files themselves with `grep`, not only in the graph. The ones used:

| Claim | Where |
|---|---|
| The index file starts with the signature `DIRC` | `read-cache.c`, `CACHE_SIGNATURE`, in `do_read_index` and `do_write_index` |
| A pack starts with the letters `PACK` and version 2 | `pack.h`, `PACK_SIGNATURE` and `PACK_VERSION` |
| A loose object is `"<type> <size>"` and a NUL, then the bytes, deflated | `object-file.c`, `format_object_header` and `write_loose_object` |
| A delta chain is at most 50 deep and the window is 10 objects | `builtin/pack-objects.c`, `static int window = 10;` and `static int depth = 50;` |
| Rename detection needs 50% similarity | `diffcore.h`, `DEFAULT_RENAME_SCORE 30000 /* ... (50%) */` |
| The reflog expiry defaults in 2.56.1 | `reflog.h`, `REFLOG_EXPIRE_OPTIONS_INIT`: `default_expire_total = now - 30 * 24 * 3600`, `default_expire_unreachable = now - 90 * 24 * 3600`; `reflog.c`, `should_expire_reflog_ent` |
| `git reset` writes `ORIG_HEAD` | `builtin/reset.c`, around line 308 |
| The merge engine is `merge-ort.c` (`merge_incore_nonrecursive`, `merge_incore_recursive`) | `merge-ort.c` |

## Where the book and the source disagree

The reflog default expiry is the one place where three sources do not agree, and the lesson says so. The book (VCWG, chapter 10) and `Documentation/config/gc.adoc` in the same tree say
90 days for `gc.reflogExpire` and 30 days for `gc.reflogExpireUnreachable`. The code in `reflog.h` of v2.56.1 sets the first cutoff to 30 days and the second to 90, and an experiment
(`exercises/09_recovery.py`, section 7) shows an entry that is 40 days old is already gone with the default options and 20 days old is kept. The lesson reports what ran.
It was not checked whether this is an upstream defect or a misreading of the macro, and it is worth reporting upstream.

## The machine

Exercises ran on Windows 11 with Git for Windows 2.56.1 (Git Bash), Python 3.12 or newer, no network. `dev`, `ino`, `uid` and `gid` in the index are 0 on that platform
(`git ls-files --debug`), and they hold real values on Linux and macOS. Hooks run through the `sh` that Git for Windows ships. Linux and macOS were not run.
