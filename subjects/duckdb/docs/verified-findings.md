# DuckDB: verified findings

Tags: **ran** (an exercise in `code/exercises/` asserts it), **source** (grep in the v1.5.6 tree), **book** (section and printed page, see `sources.md`), **author** (an inference, marked so in the lesson), **not run**.
Written against DuckDB 1.5.6 on Windows 11 (16 threads, memory limit 25 GiB). `uv run python verify.py` re-runs everything: 230 checks in 12 exercises, about one minute.
Times are printed and not asserted (several change a lot between runs); the asserts are about counts, plans and ratios.

| Lesson | Exercise | Checks | Main claims (all ran unless marked) |
|---|---|---|---|
| 1 what DuckDB is | `01_what_is_duckdb.py` | 10 | no child process and no listening port, memory of the process grows; a closed database is one file; same GROUP BY answer as SQLite (22 ms against 1,477 ms, one run); 2,000 single INSERTs 9,253 ms against 749 ms for executemany. Book: 1.1, 1.3, 1.4. |
| 2 query files | `02_query_files.py` | 21 | CSV sniffer, forced types give an error naming line and value, `nullstr` replaces the default, `store_rejects`, Parquet 16.9 MB against CSV 50 MB, Hive layout opens 1 of 12 files for `m = 3` and all 12 for a column inside the files, JSON becomes STRUCT. Book: 5.4. |
| 3 friendly SQL | `03_friendly_sql.py` | 20 | EXCLUDE, REPLACE, COLUMNS, GROUP BY ALL, FROM first, aliases, QUALIFY, sample with seed, BY NAME, SUMMARIZE (`approx_unique` of order_id is 953,281, an estimate). Book: 3.5, 4.6.2. |
| 4 analysis | `04_analysis.py` | 20 | ROLLUP 41 rows, CUBE 45, GROUPING SETS 13; FILTER equals CASE; ROWS, RANGE and running total on a made-up six-row table; PIVOT and UNPIVOT; ASOF JOIN on made-up prices and trades; LATERAL equals QUALIFY. Book: 4.4 to 4.10. |
| 5 nested data | `05_nested_data.py` | 23 | list, unnest, lambdas, STRUCT, MAP (missing key NULL, missing STRUCT field is a Binder Error), LIST of STRUCT, JSON `->>` and `json_transform`, ENUM. Book: 5.3. ENUM space saving **not run**. |
| 6 Python | `06_python.py` | 17 | relation is lazy, methods equal SQL, replacement scan (must be a local of the calling function), pandas, Polars and DuckDB agree; times (DuckDB on a DataFrame about 100 ms, on its own table 7 ms, pandas 40 ms, Polars 3 ms) are one computer; Arrow UDF faster than one-value UDF; bound parameters. Cause of the DataFrame slowness is a guess (**author**). Book: 6.3 to 6.5. |
| 7 storage | `07_storage.py` | 27 | 9 row groups (8 x 122,880 and 16,960), compression per column (BitPacking, Dictionary, ALP), min and max of order_ts do not overlap, rows scanned equal the row groups whose range overlaps the filter, file 6.6 MB against CSV 50 MB, `.wal` 260 bytes until CHECKPOINT, transactions with two connections. Source: row group and vector size, checkpoint threshold. Book: 10.2.2, A.2. WAL replay after a crash **not run**. |
| 8 execution | `08_execution.py` | 21 | scan chunks 488 x 2,048 + 576, a 70% filter gives 489 smaller chunks (average 1,431), plan of `where qty >= 3`, grouping by a string adds compress and decompress projections, threads capped by row groups (CPU / wall 1.0 for one row group, 6.4 for nine at 8 threads), integer answers equal at 1, 4, 16 threads. That a morsel is exactly a row group in every case is **not checked**. Book: 10.2.2, 5.4. |
| 9 optimizer | `09_optimizer.py` | 21 | same answer on and off; filter pushed into the scan of customers (642 of 5,000 rows, join 128,403 against 1,000,000); `unused_columns`; `2 + 1` folded; expected against real rows (178 / 189, 250,000 / 30,104, and others); six rules switched off one at a time. How estimates are made is **not checked** (observation only). |
| 10 beyond memory | `10_beyond_memory.py` | 16 | same answer under six memory limits, temp folder written below 1 GB, Out of Memory for one 50-million-value list, 365 MB Parquet read under 64 MB, second process refused (even `read_only`) while a writer is open (Windows message), three readers after it closes, `Conflict on update!`. Book: 1.4, A.2. |
| 11 extensions | `11_extensions.py` | 16 | 4 of 30 extensions built in, INSTALL and LOAD, bytes a local range-aware web server sent (count 0.4%, sum(qty) 2.6%, with year-end filter 1.1%, select * 99.2%), Parquet joined with SQLite, full-text search. S3 and real network **not run**. Book: 2.4, 5.6. |
| 12 capstone | `12_capstone_pipeline.py` | 18 | 10 files, 27,566 rows read, 137 duplicates, 27,310 clean, 119 quarantined, every planted fault found (27, 36, 8, 36, 12), failed load leaves nothing, rerun adds nothing, Parquet by month reads back, pandas with the same rules agrees. Synthetic data. |

## Surprises the exercises found (all are in the lessons)

- `nullstr` replaces the default, so an empty field becomes `''`, not NULL.
- DuckDB reading a pandas DataFrame was slower than pandas itself in the group-by; on its own table it was much faster. Polars was fastest.
- `approx_unique` of a column with a million distinct values said 953,281.
- A `sum` of DOUBLE over threads can differ in the last digits, so assertions round first.
- A DataFrame must be a local variable of the function that runs the SQL, and `full` is a reserved word.
- Even a read-only open fails while another process has the file open for writing.
- The time of a spilling query changed from 5.1 to 2.3 seconds between two runs at the same limit.

## Not run

MotherDuck, dbt, dlt, Dagster, Streamlit, Superset, S3 and other object stores, HTTPS, the Postgres and MySQL scanners, DuckLake, Iceberg and Delta extensions, spatial, Linux and macOS, a crash during a write, a database larger than the free disk, running on a schedule.
