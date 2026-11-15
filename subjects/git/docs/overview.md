# Git: overview

The subject teaches Git for someone who already uses `git add` and `git commit` and wants to know why things happen, then goes inside the `.git` folder. The list of
lessons comes from the table of contents of two books and the structure of the Git source, not from a guess (the first plan, 14 lessons copied from the shape of other
subjects, was rejected on 2026-11-14 for exactly that reason).

## Lessons

| # | Slug | Phase | Source of the topic |
|---|---|---|---|
| 0 | `what-is-git` | A | LG ch. 1 (version control), VCWG ch. 1 |
| 1 | `first-commit` | A | LG ch. 2 and 3, VCWG ch. 5 |
| 2 | `history` | A | LG ch. 3, VCWG ch. 4 and 7 |
| 3 | `branches` | B | LG ch. 4, VCWG ch. 3 |
| 4 | `merge` | B | LG ch. 5, 9 and 10, VCWG ch. 6 |
| 5 | `rebase` | B | LG ch. 11, VCWG ch. 9 |
| 6 | `remotes` | C | LG ch. 6 to 8, VCWG ch. 11 |
| 7 | `team-workflow` | C | LG ch. 12, VCWG ch. 12 and 18 |
| 8 | `rewriting-history` | D | VCWG ch. 9 |
| 9 | `recovery` | D | VCWG ch. 10 and 16 |
| 10 | `finding-commits` | D | VCWG ch. 8 |
| 11 | `object-store` | E | VCWG ch. 2, `object-file.c` |
| 12 | `refs-and-packs` | E | VCWG ch. 2 and 4, `refs/`, `pack-objects.c` |
| 13 | `index-diff-merge` | E | VCWG ch. 5 to 7, `read-cache.c`, `xdiff/`, `merge-ort.c` |
| 14 | `patch-hook-submodule` | F | VCWG ch. 13 to 15 |

## Left out on purpose

LG chapter 1 on the command line and chapter 6 on hosting accounts and authentication (they are about the operating system and a website, not Git); VCWG chapter 17 (tips and
tricks, which are one-liners without a concept), and the `git subtree` part of chapter 15. The topics of VCWG chapters 13 to 15 that are not hooks, patches or submodules
(for example `git bundle` and `git filter-repo`) are a candidate for later.

## How it is checked

`code/verify.py` runs the 15 exercises in `code/exercises/`. Each builds a throwaway repository in the system temp folder with `gitlab.py`: a fixed author and clock, no user or
system configuration, and bytes (not text) in and out, because a Windows text-mode pipe turns `\n` into `\r\n` and changes every id. Because of that, the ids printed in a
lesson are the same on every machine.

## Backlog

- Labs: three areas, branch and HEAD, merge against rebase, remotes, reset, the object store, a pack. See `lessons` for which are built.
- `git worktree`, `git bundle`, sparse checkout and partial clone are not covered.
- Linux and macOS were not run.
