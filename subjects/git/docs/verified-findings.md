# Verified findings (Git)

Every statement in a lesson is tagged **ran** (produced by an exercise in `code/exercises/` with Git 2.56.1 for Windows, Python 3.12, no network),
**source** (read in the Git v2.56.1 source at `E:\Development\Project\open-source\git`, by file and function; the knowledge graph in
`graphs/git-current/` is the map and the claims below were also checked with `grep`), **book** (chapter and the printed page where the section
starts; `docs/sources.md` has the page offsets) or **author** (advice, framing or a guess, said so in the lesson).
`code/verify.py` re-runs the 17 exercises (431 checks) and exits non-zero if one changes. The ids that the lessons print repeat on every
run because `gitlab.py` fixes the author, the clock and the configuration.

| Lesson | Claim | Tag | Where |
|---|---|---|---|
| what-is-git | the same bytes give the same id in two repositories, one changed letter changes it whole | ran | `00_snapshots.py` |
| what-is-git | an unchanged file is shared between two commits, a changed file is stored whole, the second commit lists every file | ran | `00_snapshots.py` |
| what-is-git | the first commit makes 4 objects, two commits make 7 | ran | `00_snapshots.py` |
| what-is-git | a clone has the whole history | ran | `06_remotes.py` |
| what-is-git | Git stores snapshots, not deltas; the name comes from the SHA-1 of the content | book | VCWG ch. 1 p. 5, ch. 2 p. 29 |
| first-commit | `git init` makes only `.git`, `HEAD` is `ref: refs/heads/main`, `No commits yet` | ran | `01_first_commit.py` |
| first-commit | an untracked file is `??`, after `git add` it is `A `, the index holds mode `100644` and the blob id, the blob is already in `.git/objects` | ran | `01_first_commit.py` |
| first-commit | the first commit is `41d3c6b` and the second `66df49b` on every run | ran | `01_first_commit.py` |
| first-commit | `git diff`, `--staged` and `HEAD` compare different pairs; `M `, ` M`, `MM` | ran | `01_first_commit.py`, `02_history.py` |
| first-commit | a commit stores what was in the index, not the file | ran | `01_first_commit.py` |
| first-commit | `.gitignore`, `git check-ignore -v`, `git add -f` | ran | `01_first_commit.py` |
| first-commit | the three areas; the index | book | LG ch. 2 p. 26, VCWG ch. 5 p. 103 |
| history | `HEAD`, `main`, `HEAD~n`, `HEAD^`, a short prefix, `HEAD:file`, `HEAD^{tree}` | ran | `02_history.py` |
| history | `A..B`, `HEAD ^A`, `A...B`, `git merge-base` | ran | `02_history.py` |
| history | `git log -- path`, `--grep`, `-n`, `--stat`, `--graph`; `git diff A B`, `--name-status`, `--stat` | ran | `02_history.py` |
| history | `HEAD^1` and `HEAD^2` of a merge commit | ran | `02_history.py` |
| branches | a branch is a 41-byte file, `HEAD` holds `ref: refs/heads/<name>`, `git branch` adds one file and no object | ran | `03_branches.py` |
| branches | a commit moves only the branch `HEAD` points at; the working tree follows `git switch` | ran | `03_branches.py` |
| branches | unfinished work follows a new branch; Git refuses when it would be overwritten (the message) | ran | `03_branches.py` |
| branches | a detached `HEAD` holds a commit id; a commit made there is on no branch; `git branch <name> <commit>` keeps it | ran | `03_branches.py` |
| branches | `-d` refuses an unmerged branch (the message), `-D` deletes the name, the commit stays | ran | `03_branches.py` |
| merge | fast-forward makes no commit; a real merge has two parents and `Merge made by the 'ort' strategy.` | ran | `04_merge.py` |
| merge | a conflict: exit code 1, `CONFLICT (content)`, the markers, `MERGE_HEAD`, `UU`, stages 1 to 3 in the index, the `diff3` labels `ours`, `base`, `theirs` | ran | `04_merge.py` |
| merge | `git merge --abort` restores everything; add and commit gives a merge commit with two parents | ran | `04_merge.py` |
| merge | the merge engine is `merge-ort.c` | source | `merge-ort.c`: `merge_incore_nonrecursive`, `merge_incore_recursive` |
| rebase | rebase makes a straight line with new ids and the same patch id; `main` does not move | ran | `05_rebase.py` |
| rebase | `ORIG_HEAD`, the reflog and `git reset --hard ORIG_HEAD` undo it | ran | `05_rebase.py` |
| rebase | a conflict stops it, `HEAD` is detached, the `HEAD` marker side is the target, `--continue`, `--abort` | ran | `05_rebase.py` |
| rebase | `--onto`; `rebase -i` with fixup, reword, drop (a script writes the todo list) | ran | `05_rebase.py` |
| remotes | `push -u` writes the remote and branch sections into `.git/config`; `clone` copies the history and sets tracking | ran | `06_remotes.py` |
| remotes | fetch moves only `origin/main`; `pull` is fetch and merge; `pull --rebase` gives a line | ran | `06_remotes.py` |
| remotes | a rejected push (`fetch first`); `--force-with-lease` refuses with `stale info`; `main:release`, `ls-remote`, `--delete`, `fetch --prune` | ran | `06_remotes.py` |
| team-workflow | two dots against three dots in `git diff`; `git request-pull` | ran | `07_team_workflow.py` |
| team-workflow | merge commit, squash and rebase give different histories; squash is not counted as merged; a fork uses a second remote | ran | `07_team_workflow.py` |
| team-workflow | the pull request page, review, checks and branch protection of a hosting site | not run | LG ch. 12 p. 233 to 237 (described only) |
| rewriting-history | the three kinds of `reset` against HEAD, the index and the working tree; the old commit stays | ran | `08_rewriting_history.py` |
| rewriting-history | `reset` writes `ORIG_HEAD` before it moves `HEAD` | source | `builtin/reset.c`, `reset_refs` |
| rewriting-history | `revert`, reverting a merge needs `-m`; `--amend` gives a new id and does not write `ORIG_HEAD`; `cherry-pick` (new id, same patch id, `-x`, `git cherry`); `restore`; `clean` | ran | `08_rewriting_history.py` |
| recovery | a stash is a commit on `refs/stash` with two parents; `-u`; `pop` and `apply` | ran | `09_recovery.py` |
| recovery | the reflog; recovering after `reset --hard` and after deleting a branch; the line under `moving from` holds the id | ran | `09_recovery.py` |
| recovery | `git fsck --lost-found --no-reflogs`; `reflog expire --expire=now` and `gc --prune=now` delete for good | ran | `09_recovery.py` |
| recovery | by default a 20-day-old reflog entry is kept and a 40-day-old one expires | ran | `09_recovery.py` section 7 |
| recovery | defaults in the code: `default_expire_total` 30 days, `default_expire_unreachable` 90 days | source | `reflog.h`, `REFLOG_EXPIRE_OPTIONS_INIT` |
| recovery | the documentation and the book say 90 days for `gc.reflogExpire` and 30 for unreachable (this does not match the run) | source, book | `Documentation/config/gc.adoc`, VCWG ch. 10 p. 236 |
| finding-commits | bisect by hand finds the first bad commit in 4 answers out of 16; the message `is the first 'bad' commit`; `bisect run` | ran | `10_finding_commits.py` |
| finding-commits | `git blame` columns and `^`; `-L`; `-w`; `--ignore-revs-file` needs full ids | ran | `10_finding_commits.py` |
| finding-commits | `-S` counts occurrences, `-G` matches changed lines; `--diff-filter=A`; `log -L`; `--follow` | ran | `10_finding_commits.py` |
| object-store | a blob id is the SHA-1 of `blob <size>`, NUL and the bytes; a loose object is the same bytes in zlib | ran | `11_object_store.py` |
| object-store | the header is built by `format_object_header` | source | `object-file.c` |
| object-store | tree and commit layouts, recomputed ids; a commit built with plumbing; tags; a SHA-256 repository; `git fsck` finds `hash-path mismatch` and `missing blob` | ran | `11_object_store.py` |
| object-store | the lab picture (8 objects of two commits, the ids and bytes) | ran | `15_object_graph.py`, `labs/git/objectGraph.json` |
| refs-and-packs | ref files, `packed-refs` with `^` lines, a loose ref wins over a packed line | ran | `12_refs_and_packs.py` |
| refs-and-packs | 20 commits make 60 loose objects, `gc` leaves 1 pack; the first bytes of `.pack` and `.idx` | ran | `12_refs_and_packs.py` |
| refs-and-packs | `PACK_SIGNATURE` and `PACK_VERSION` | source | `pack.h` |
| refs-and-packs | the pack is under a third of the loose size (4,838 against 16,613 bytes); 19 of 20 blobs are deltas at most 2 deep; the newest is stored whole | ran | `12_refs_and_packs.py` |
| refs-and-packs | `window = 10`, `depth = 50` | source | `builtin/pack-objects.c` |
| refs-and-packs | why the newest version is stored whole | author | a guess, said so in the lesson |
| refs-and-packs | reftable can be created and migrated back to files | ran | `12_refs_and_packs.py` |
| index-diff-merge | the bytes of `.git/index`, sorted entries, ids and sizes match, the `TREE` extension | ran | `13_index_diff_merge.py` |
| index-diff-merge | `CACHE_SIGNATURE` | source | `read-cache.c` |
| index-diff-merge | `touch` does not change the index until `git status` refreshes it; index version 4; `dev`, `ino`, `uid`, `gid` are 0 on Windows | ran | `13_index_diff_merge.py` (Windows only) |
| index-diff-merge | four diff algorithms give three different diffs on a made-up pair of files and each applies cleanly | ran | `13_index_diff_merge.py` |
| index-diff-merge | rename detection in a merge; below the threshold a `CONFLICT (modify/delete)`; 50% | ran, source | `13_index_diff_merge.py`, `diffcore.h` `DEFAULT_RENAME_SCORE` |
| index-diff-merge | `git merge-tree --write-tree` computes a merge without touching anything | ran | `13_index_diff_merge.py` |
| patch-hook-submodule | `format-patch`, `am` (same tree, other ids), `apply --check` | ran | `14_patch_hook_submodule.py` |
| patch-hook-submodule | `pre-commit`, `--no-verify`, `commit-msg`, hooks are not cloned, `core.hooksPath`, `pre-receive` rejects a push | ran | `14_patch_hook_submodule.py` |
| patch-hook-submodule | `.gitmodules`, the `160000` entry, the pointer does not follow, an empty folder after clone, `submodule update --init`, `transport 'file' not allowed` | ran | `14_patch_hook_submodule.py` |
| patch-hook-submodule | sending patches by real mail, `git subtree` | not run | VCWG ch. 13 p. 326, ch. 15 p. 364 (left out) |
| team-workflow | the same start taken in three ways (merge commit, squash, rebase and fast-forward) gives one tree id; 5, 3 and 4 commits on main; 1, 0 and 0 merge commits; the old C1 and C2 stay in main only after a merge; `git branch -r --merged` says no after a squash | ran | `16_lab_data.py` section 1, `IntegrateLab` |
| merge | a fast-forward ends with main on d1 and makes nothing; the real merge has parents m2 and k1; the base is d1 | ran | `16_lab_data.py` section 6, `MergeKindsLab` |
| merge | changes on different lines merge alone; the same line stops with the markers; the two scenarios' texts | ran | `16_lab_data.py` section 6, `ConflictLab` |
| merge | the way out `salad with egg and tuna` is the text exercise 04 commits | ran | `04_merge.py` |
| history | the set of commits of each selector (`HEAD~2`, `HEAD~3`, `M^2`, `main..topic`, `topic..main`, `main...topic`, `^B main`, `--first-parent`, `feature`) on a history with a merge | ran | `16_lab_data.py` section 2, `RangesLab` |
| finding-commits | for every possible first bad commit among 16 (2 to 16) the real `git bisect` needs at most 4 answers; the commits it tests when 11 is the culprit are 8, 12, 10, 11 | ran | `16_lab_data.py` section 3, `BisectLab` |
| recovery | the reflog lines before the reset, after `reset --hard HEAD~2` and after `reset --hard HEAD@{1}`, with their ids | ran | `16_lab_data.py` section 4, `ReflogLab` |
| refs-and-packs | for each of the 20 blobs: loose size, size in the pack, delta depth and base (V1 to V17 against V18, V18 and V19 against V20, V20 whole); 16,613 against 4,838 bytes, the same bytes as exercise 12 | ran | `16_lab_data.py` section 5, `PackLab` |
| what-is-git | two commits make 4 and then 3 more objects, and b.txt is the same blob in both | ran | `16_lab_data.py` section 7, `SnapshotLab` |
| index-diff-merge | the diff of each algorithm on the made-up pair (lines marked added and removed); patience 3 each, the others 2 | ran | `16_lab_data.py` section 8, `DiffLab` |
| index-diff-merge | the one-line description of each algorithm shown by the lab | docs (not run) | Git `diff-options` documentation, summarised |
| patch-hook-submodule | a pre-commit hook that exits 1 stops the commit and `--no-verify` skips it, with the hook's text and the two logs | ran | `16_lab_data.py` section 9, `HookLab` |
| patch-hook-submodule | the gitlink `160000 commit <id>` for the library at L1 and later L2, `git status` ` M vendor/lib` after the pull, an empty folder after a plain clone | ran | `16_lab_data.py` section 10, `SubmoduleLab` |

## Not run, or not checked

- A hosting website (pull requests, reviews, branch protection) and any real network. Every remote is a folder.
- Linux and macOS. Hooks run through the `sh` of Git for Windows. `dev`, `ino`, `uid`, `gid` in the index are 0 on this machine.
- The reflog expiry difference above is reported as measured. It was not checked whether it is an upstream defect.
- The figures of the two books were not seen, only their text and captions.
- The animated labs (`IntegrateLab`, `MergeKindsLab`, `ConflictLab`, `RangesLab`, `BisectLab`, `ReflogLab`, `PackLab`, `SnapshotLab`, `DiffLab`, `HookLab`, `SubmoduleLab`) draw ids, sizes and outputs from `exercises/16_lab_data.py`; the positions, colours and the pace of the animations are the author's. No person watched them play from start to end; the key moments were looked at as screenshots.
