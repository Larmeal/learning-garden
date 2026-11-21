# DuckDB: overview

Twelve lessons, Thai and English, each with a quiz, built on 2026-11-20 with **DuckDB 1.5.6** (the Python package) and the book *DuckDB in Action* (Needham, Hunger and Simons, kept outside the repo as a PDF in `E:\Books\Databases\Analytical (OLAP)\`).

Running example: one million synthetic orders and 5,000 customers made by DuckDB itself from `range()` and `hash()` (`code/ddb.py`, `make_shop`), so every number is the same on every run.

| Phase | Lessons |
|---|---|
| A. Getting started | 1 what DuckDB is, 2 query files without loading them, 3 friendly SQL |
| B. Analysing data | 4 aggregates, windows and special joins, 5 nested data, 6 using DuckDB from Python |
| C. Inside DuckDB | 7 how the data is stored, 8 how a query runs, 9 the optimizer |
| D. In real work | 10 data bigger than memory and many users, 11 extensions and reading files over a network, 12 capstone: daily CSV files with bad rows |

Thirteen labs in `site/src/components/labs/duckdb/` (all take `lang`, share `ib.tsx` and the step and clock players of the Spark labs). Eight read JSON that an exercise writes with `--write`.

## Backlog

- No `in-depth` pages yet. Candidates: compression methods (BitPacking, ALP, FSST) read from the source, the join order search, the checkpoint and WAL replay after a crash.
- MotherDuck, dbt, dlt, Dagster and Streamlit (book chapters 7 to 9) are not covered.
- A knowledge graph of the DuckDB source (`subjects/duckdb/graphs/` is empty). The source checkout is at `E:\Development\Project\open-source\duckdb`, tag `v1.5.6`.
- Linux and macOS: the lock message of lesson 10 is the Windows one.
