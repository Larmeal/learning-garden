# Verified findings (Spark lessons, rewritten 2026-11-05)

Every claim in the Spark lessons carries one of three tags in this file and in the lesson text:

- **ran**: an exercise in `subjects/spark/code/exercises/` asserts it (or prints the number the lesson quotes).
  `uv run python verify.py` re-runs all of them.
- **source**: read in the Spark v4.2.0 source (`E:\Development\Project\open-source\spark`, commit 32f72996) or taken from
  the knowledge graph summaries in `subjects/spark/graphs/` (itself produced from that source). Lines are quoted in
  the lesson.
- **author**: the owner's judgement or general knowledge, not tested. The lessons say so where it matters.

Numbers that depend on the machine (times, file sizes, bytes read) are printed by the exercises and quoted as measured on
one machine. The asserts check the shape (for example "Parquet reads far fewer bytes than CSV"), not the absolute value.

Environment: PySpark 4.2.0, Java 21 (Temurin) in WSL for everything that writes files or streams, Python 3.12, pandas 3.1.1,
pyarrow 26.0.1. Delta Lake 4.4.1 for chapter 10.

## How to run

```
cd subjects/spark/code
uv sync
uv run python verify.py            # all exercises
uv run python verify.py 06 09      # chosen ones
```

Exercises 01-05 and 09-12 re-launch themselves in WSL when started on Windows through `run_wsl.sh`. One-time WSL setup
(no sudo): a Temurin 21 JDK in `~/spark-lab/jdk`, a venv in `~/spark-lab/venv` made with uv, `pyspark[connect]==4.2.0`,
`pandas`, `pyarrow`. Chapter 10 downloads the Delta jar from Maven Central on first run.

Why WSL: Hadoop cannot write a local file on this Windows machine (`UnsatisfiedLinkError: NativeIO$Windows.access0`,
`hadoop.dll` is missing; the cause was not confirmed by installing it). Separately, the Python to JVM sockets on this
Windows machine reset now and then (`ConnectionResetError`, "Python worker exited unexpectedly") when many tasks start at
once, which is why the data-frame exercises that create small DataFrames also run in WSL.

## Chapter by chapter

| Chapter | Exercise | What it asserts (tag: ran unless noted) |
|---|---|---|
| 1 Architecture | `01_architecture.py` | `local[*]`, defaultParallelism = cores, driver is the only executor, getOrCreate returns the same object, Py4J handle `_jdf`, driver memory managed by Spark = (heap - 300 MiB) x 0.6 = 455,501,414 B, collect/show/toPandas |
| 2 Lazy evaluation | `02_lazy_evaluation.py` | transformations and explain start 0 jobs; groupBy collect = 2 jobs with AQE, 1 without; same DataFrame again = 1 job (map stage skipped), rebuilt DataFrame = 2; show(5) on 1e12 rows = 1 task; cache lazy; UNRESOLVED_COLUMN at definition, CAST_INVALID_INPUT at action; ANSI mode fixed when the DataFrame is defined |
| 3 DataFrame and SQL | `03_dataframe_sql.py` | three-valued logic, NULL in aggregates/groups/distinct/order, NOT IN with NULL, join row counts with NULL keys, rank vs dense_rank, RANGE vs ROWS frame, ANSI errors and try_ functions, decimal literal vs double |
| 4 Data I/O | `04_data_io.py` | CSV vs Parquet size and bytes read, ReadSchema, predicate pushdown and row-group skipping (2,072 vs 597,928 rows), partitionBy layout and pruning (120,000 of 600,000 rows), files per write (16, 50, 1, 80), read partitions vs maxPartitionBytes, write modes, inferSchema = 2 jobs vs 0 |
| 5 Execution model | `05_execution_model.py` | Exchange per operation (16 cases), stages = Exchange + 1 (orderBy +1), task counts and shuffle write = read bytes, join of two aggregates = [4, 4, 200] |
| 6 Catalyst and AQE | `06_catalyst_aqe.py` | four plans, explain modes and 0 jobs, optimizer result, CSV pushdown, join selection and hints, AQE defaults, isFinalPlan traps, coalescing numbers (1 / 200 / 3), runtime join change, non-empty ratio, skew join (1 / 23 / 8), ANSI lock |
| 7 Performance tuning | `07_performance_tuning.py`, `07b_jvm_limits.py` | shuffle partitions table, 80-case join matrix (feeds the join lab), salting distribution and join correctness, repartition vs coalesce plans, cache semantics and levels, count(distinct) shapes, shuffle handles (200 vs 201), spill (280 / 232 MiB), maxResultSize |
| 8 UDF | `08_udf.py` | plan shapes and eval types, conf read at definition, optimizer barrier cases (4), fusion, NULL handling, return type table (pickle vs Arrow), PythonException shape, per-row cost order |
| 9 Streaming | `09_streaming.py` (WSL) | watermark and append (batches 0-6), replay after deleting commits/N, availableNow, output modes, RocksDB provider, checkpoint layout |
| 10 Table formats | `10_table_formats.py` (WSL) | Delta log actions, copy-on-write, raw parquet read 125 vs 100 rows, history and time travel, schema rules, OPTIMIZE/VACUUM, checkpoint at 10 commits, data skipping, concurrent writers (ConcurrentAppendException), plain Parquet baseline |
| 11 Deployment and UI | `11_deployment_ui.py` (WSL) | real standalone cluster (Master + Worker), REST API numbers, event log events, dynamic allocation with shuffle tracking, cluster mode refused for Python, Spark Connect client differences |
| 12 MLlib | `12_mllib.py` (WSL) | Param defaults, fit = 14 jobs / transform = 0, model stage types, AUC 0.981, CrossValidator 6 x 3 (333 jobs), save and load layout, VectorAssembler null handling |
| 13 Internals | `13_internals.py` | lineage and stages (1, 2, 3 stages), shuffle files (8 maps x 3 = 24), unified memory formula and eviction (153.9 to 77.0 MiB), generated code and codegen on/off |

## Findings worth keeping in mind (all tag ran unless noted)

- Python UDFs in Spark 4.2 are Arrow-optimized by default (evalType 101). The comment at `python/pyspark/sql/udf.py:99`
  ("disabled by default") is stale (**source**).
- An Arrow UDF is still called once per row; only pandas UDFs are called once per batch (**source** and ran).
- `explain("formatted")` prints only the physical plan.
- AQE: only plans with an exchange or subquery get an `AdaptiveSparkPlan`; `isFinalPlan` flips only on the DataFrame
  object that ran.
- `repartition(n)` is never coalesced by AQE.
- A DataFrame keeps the plan it was first planned with: build a new DataFrame after changing a conf (hit while writing the
  chapter 7 exercise).
- PySpark's RDD `join` is a union plus one shuffle: 2 stages, not 3.
- `df.limit(n)` as the last step is `CollectLimit` (no Exchange).
- Delta 4.4.1 targets Spark 4.2.0 and works. The Iceberg runtime built for Spark 4.1 fails on 4.2.0 with
  `IncompatibleClassChangeError` because `org.apache.spark.sql.connector.catalog.View` is a class in 4.2
  (`View.java:43`, **source**). No Iceberg runtime for Spark 4.2 was on Maven Central on 2026-11-05.
- Dynamic allocation with shuffle tracking keeps idle executors that hold shuffle data (shuffleTracking.timeout default is
  unbounded, **source**); executors of a job without a shuffle are released.
- Event logs are zstd-compressed by default in 4.2 (`spark.eventLog.compress` = true).

## Not tested (said so in the lessons)

- Hudi, Iceberg (see above), YARN, Kubernetes, History Server, Databricks and EMR.
- Parquet pushdown behaviour of other engines, ORC.
- Stream-stream joins, `flatMapGroupsWithState`, Kafka, real-time mode (**source** only).
- OOM behaviour (broadcasting too much, a huge group in `applyInPandas`).
- Speed claims: only the order of costs and the single measurements printed by the exercises. Never a multiplier.
- Locality on a real cluster, speculation, fair scheduler pools.
- Whether adding `hadoop.dll` fixes writes on Windows.
- The pages were built and the animations were opened in headless Chrome (Playwright), clicking through the steps, but not
  looked at on a phone or in a screen reader.

## Where the evidence lives

- Evidence notes written before the rewrite: `subjects/spark/graphs/notes/` (lessons 6 to 8, audit of lessons 0 to 5).
- Knowledge graph of the Spark source: `subjects/spark/graphs/query-pipeline-current/` (253 files, 4,527 nodes).
- Labs read their data from the exercises: `joinMatrix.json` is written by `07_performance_tuning.py --write`; the other
  labs carry the measured numbers in a comment at the top of the component.
