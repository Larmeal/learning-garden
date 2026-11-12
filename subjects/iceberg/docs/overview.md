# Iceberg: overview and backlog

Goal: understand Apache Iceberg by using it from Spark and PyIceberg, and by opening the files it writes. Every lesson is backed by an
exercise in `code/exercises/` that asserts what the lesson prints.

## Plan (4 phases) and state on 2026-11-12

| Phase | Lessons | State |
|---|---|---|
| A. Inside a table | 1 what-is-iceberg, 2 table-anatomy, 3 schema-partitioning | Thai written with quizzes, exercises 01 to 03 |
| B. Writing and reading | 4 writing, 5 reading, 6 row-level | Thai written with quizzes, exercises 04 to 06 |
| C. Change and history | 7 evolution, 8 time-travel | Thai written with quizzes, exercises 07, 08 |
| D. Running it for real | 9 catalogs, 10 maintenance, 11 migration, 12 streaming, 13 spec-versions, 14 capstone | Thai written with quizzes, exercises 09 to 14 |

All 14 exercises pass (`./run_wsl.sh verify.py` inside WSL). English versions of all 14 lessons and quizzes exist (written 2026-11-12, `npm run sync` records them as in step). Seven labs exist (see CLAUDE.md). Not done: more labs (compaction, partition evolution, catalogs), the `in-depth` pages, and a
read-through by the owner of the Thai and English text (the Thai was linted with thai-lint, not read by a person).

## Open questions and risks

- REST catalog: no REST server runs here (no Docker image pulled, the Java test adapter is not in the runtime jar). The REST lesson would be source and docs only, tagged "not run", unless a server is found.
- Spark 4.2 has no Iceberg runtime yet; if one appears, re-run everything on Spark 4.2 and compare with the Spark subject.
- Labs planned: tree of metadata growing per commit, two writers colliding, scan pruning with a predicate.
