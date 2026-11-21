# Polars

A path through Polars 2.1.0, from the first DataFrame to the engine inside, in 12 lessons (Thai and English, each with a quiz).
The running example is a small order table of 8 rows (a few nulls planted on purpose) and a 4-row customer table; the lessons about speed use
synthetic orders of 200,000 to 5,000,000 rows from a fixed seed (`code/plab.py`).

| # | Slug | What it teaches | Exercise | Lab |
|---|---|---|---|---|
| 1 | `first-dataframe` | Series, DataFrame, dtype, no index, nothing changes in place, shared buffers | 01 | |
| 2 | `expressions` | Expression and context (select, with_columns, filter, group_by), broadcast, `when/then`, selectors | 02 | `ExpressionLab` |
| 3 | `types-and-nulls` | strict cast, overflow wrap, null against NaN, three-valued logic, Decimal, Enum, dates | 03 | `NullLab` |
| 4 | `group-by-windows` | `group_by`, `over`, sort, pivot, `group_by_dynamic` | 04 | `GroupByLab` |
| 5 | `joins` | six kinds of join, duplicate keys, `validate`, `join_where`, `join_asof`, `concat` | 05 | `JoinLab` |
| 6 | `lazy` | LazyFrame, `explain`, predicate and projection pushdown, engines, removed `profile` | 06 | `PlanLab` |
| 7 | `io` | CSV inference, Parquet statistics, row groups, hive folders, scan and sink | 07 | `RowGroupLab` |
| 8 | `nested-strings` | List, Struct, explode, string expressions, `map_elements` cost | 08 | |
| 9 | `performance` | measured: pandas, scan against read, threads, memory of two engines | 09 | |
| 10 | `inside` | values buffer and validity bitmap, chunks, zero copy, morsels of the streaming engine | 10 | `ColumnarLab`, `MorselLab` |
| 11 | `from-pandas` | the same questions in both libraries, NaN against null, moving data | 11 | |
| 12 | `capstone` | a dirty CSV through one lazy pipeline, checked against planted defects | 12 | |

Run everything: `uv run python verify.py` in `code/` (about 1 to 2 minutes; 9 and 10 time things, so do not build or crawl at the same time).
`node subjects/polars/code/verify_labs.mts` (from the repo root) checks the browser code of the labs against the exercises.
Exercises 06, 07 and 10 take `--write` to save the JSON that the plan, row group, columnar and morsel labs read.

## Backlog

- No book was used. The Polars user guide was not read as a source; claims are tagged ran, source or author.
- Not covered: SQL context, `pl.Config`, plugins and expression extensions, `Array` type, Cloud storage and Delta/Iceberg scans, GPU engine, `streaming` spill to disk, categorical string cache.
- A knowledge graph of the Polars source (`graphs/`) was not built; the source facts were read with `grep` from a checkout at tag `py-2.1.0`.
