# DuckDB: sources

## Book

*DuckDB in Action*, Mark Needham, Michael Hunger and Michael Simons (Manning). PDF at `E:\Books\Databases\Analytical (OLAP)\DuckDB in Action (Mark Needham, Michael Hunger, Michael Simons).pdf`. Text was extracted with `pdftotext -layout` and read as text, so **no figure was seen**, only captions and the text around them.

Printed page = PDF page minus 24 (section 1.1 is on printed page 2 and PDF page 26). Checked on two sections only (1.1 and 10.2), so a page may be one off. Where a page header was not at hand, the page was taken from the nearest header above the passage.

Pages cited by the lessons:

| Where | Section | Printed page |
|---|---|---|
| lesson 1 | 1.1 | 2 |
| lesson 1 | 1.3 | 4 |
| lessons 1, 10 | 1.4 | 5 |
| lesson 11 | 2.4 | 15 |
| lesson 3 | 3.5 | 50 |
| lesson 4 | 4.4 | 66 |
| lesson 4 | 4.5 | 69 |
| lesson 3 | 4.6.2 (QUALIFY) | 80 |
| lesson 4 | 4.6.3 (FILTER) | 81 |
| lesson 4 | 4.7 | 82 |
| lesson 4 | 4.10 | 93 |
| lesson 5 | 5.3 | 102 |
| lessons 2, 8, 11 | 5.4 | 108, 109 |
| lesson 11 | 5.6 | 116 |
| lesson 6 | 6.3, 6.4, 6.5 | 134, 136, 141 |
| lessons 7, 8 | 10.2.2 | 243, 244 |
| lesson 9 | 10.2.3 | 245 |
| lesson 5 | 10.1.7 (enums) | 238 |
| lesson 11 | 10.4 | 251 |
| lessons 7, 10 | appendix A, A.2 (concurrency) | 267 |
| lesson 12 | 8.2 to 8.4 (named, not run) | 165 to 182 |

## Source tree

DuckDB `v1.5.6` cloned (shallow) to `E:\Development\Project\open-source\duckdb`. Read with `grep` and `ls` only; the engine was **not** read through. Facts taken from it:

- `src/include/duckdb/storage/storage_info.hpp:22` `DEFAULT_ROW_GROUP_SIZE 122880`
- `src/include/duckdb/common/vector_size.hpp:16` `DEFAULT_STANDARD_VECTOR_SIZE 2048`
- `src/include/duckdb/main/config.hpp:101` `checkpoint_wal_size = 1 << 24` (16 MiB)
- `src/optimizer/` file names (`filter_pushdown.cpp`, `build_probe_side_optimizer.cpp` with `TryFlipJoinChildren`, `expression_rewriter.cpp`, `row_group_pruner.cpp`, and others)

## Packages (see `code/uv.lock`)

duckdb 1.5.6, pandas, polars 2.1.0, pyarrow 26.0.1, psutil. The extensions httpfs, sqlite_scanner and fts were downloaded from the DuckDB extension repository by `INSTALL` on 2026-11-20.
