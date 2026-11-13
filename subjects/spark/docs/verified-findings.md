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
| 6 Catalyst and AQE | `06_catalyst_aqe.py`, `06b_rule_iterations.py` | four plans, explain modes and 0 jobs, optimizer result, CSV pushdown, join selection and hints, AQE defaults, isFinalPlan traps, coalescing numbers (1 / 200 / 3), runtime join change, non-empty ratio, skew join (1 / 23 / 8), ANSI lock; 06b: FixedPoint rounds of the Optimizer (2 for the view and join queries, 4 for four nested subqueries, Analyzer Resolution 9) and the order of the rules that changed the plan |
| 7 Performance tuning | `07_performance_tuning.py`, `07b_jvm_limits.py` | shuffle partitions table, 80-case join matrix (feeds the join lab), salting distribution and join correctness, repartition vs coalesce plans and the destination of every row of the repartition lab (`lab_placements`), cache semantics and levels, which steps of a four step recipe each of three actions runs with a cache after step 0 to 4 and with a block of one partition removed, and that a stage before a shuffle is not run again (`cache_lineage`), the same on DataFrames with a groupBy and a join, with a lost block after the shuffle, and with a different query on a cached base (`cache_dataframe`), with the shuffle files deleted (`07b ... lost_shuffle`, its own session), where MEMORY_ONLY, MEMORY_AND_DISK and DISK_ONLY put 6 partitions (171 MB) in 94 MB of storage memory (`07b ... levels`), count(distinct) shapes, shuffle handles (200 vs 201), spill (280 / 232 MiB), maxResultSize |
| 8 UDF | `08_udf.py` | plan shapes and eval types, conf read at definition, optimizer barrier cases (4), fusion, NULL handling, return type table (pickle vs Arrow), PythonException shape, per-row cost order |
| 9 Streaming | `09_streaming.py` (WSL) | watermark and append (batches 0-6), replay after deleting commits/N, availableNow, output modes, RocksDB provider, checkpoint layout |
| 10 Table formats | `10_table_formats.py` (WSL) | Delta log actions, copy-on-write, raw parquet read 125 vs 100 rows, history and time travel, schema rules, OPTIMIZE/VACUUM, checkpoint at 10 commits, data skipping, concurrent writers (ConcurrentAppendException), plain Parquet baseline |
| 11 Deployment and UI | `11_deployment_ui.py`, `11b_standalone_spread.py` (WSL) | real standalone cluster (Master + Worker), REST API numbers, event log events, dynamic allocation with shuffle tracking, cluster mode refused for Python, Spark Connect client differences; 11b: Master + 3 Workers (4 cores each), cores per Worker and executors for spreadOutApps true/false x executor.cores unset/1/2 (2·2·2 or 4·2·0) |
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
  One exception, named as such on the page: `foundations/overview` (history) quotes the multipliers of the RDD paper (20x, 25.3x, 40x),
  the 2014 GraySort result and the TPC-DS 2x of the 3.0 release notes. They are **source** (paper, Databricks blog, release notes, linked from
  the page), were not re-measured here, and the page says so.
- Locality on a real cluster, speculation, fair scheduler pools.
- Whether adding `hadoop.dll` fixes writes on Windows.
- The pages were built and the animations were opened in headless Chrome (Playwright), clicking through the steps, but not
  looked at on a phone or in a screen reader.

## Clock labs (added after the rewrite)

Twenty-four labs run on a clock (`labs/spark/timeline.tsx`; the cluster manager ones also use `scene.tsx`): `ShuffleFlowLab`, `StragglerLab`, `JoinFlowLab`, `PushdownFlowLab`,
`AqeFlowLab`, `AqeLoopLab`, `RuleLoopLab`, `UdfLanesLab`, `WatermarkFlowLab`, and on the in-depth pages `Py4jLab`,
`DriverMemoryLab` (no clock), `JoinDecisionLab`, `ShuffleWriterLab`, `LocalityWaitLab`, `CheckpointCrashLab`, `StateStoreLab`, `HandshakeLab`,
`WorkerReuseLab`, and on lesson 1 and its cluster manager sub-pages `RolesFlowLab`, `ClusterLaunchLab` (standalone, YARN, Kubernetes), `StandaloneSpreadLab`, `YarnAllocLab`, `K8sBatchLab`. What is measured and what is drawn for the picture:

- Shuffle: one `.data` plus `.index` per map task and the 24 files of 8 maps are **ran** (exercise 13); the 8 rows per map
  task and the key placement are made up.
- Straggler: row counts per partition (skewed and salted) are **ran** (exercise 07); time is rows divided by 100,000, a scale.
- Join: the strategies are **source**; the dot counts are a toy, and only the shape of the cost (broadcast copies x executors)
  is claimed.
- Pushdown: rule names and the plan change are **source** and **ran** (lesson 6); row counts (1,000,000, 20% paid) are made up.
- AQE (replaced `AqeLab`): 200 to 1 partition, 1,152 bytes and the 5-row right side are **ran** (exercise 06); plan names and the skew
  threshold formula are **source**; the skew partition sizes, dot counts and task sizes in the mini timelines are made up.
- RuleLoopLab and AqeLoopLab (the in-depth page of lesson 6): the 4 rounds and the order of the effective rules are **ran** (exercise 06b);
  the plan after each rule is shortened from the plan change log; the six loop steps and the cost rule are **source**; 2 jobs, 1,152 bytes
  and 1 partition are **ran** (exercise 06).
- In-depth pages (lessons 1, 7, 8, 9): `Py4jLab` (handles, collect/show/toPandas/write) **ran** (exercise 01), numbers made up;
  `DriverMemoryLab` formula **ran** at 1 GiB (455,501,414 B), other sizes are the same formula; `JoinDecisionLab` order and the
  build-side table are **source**, the presets marked "วัดจริง" are **ran** (exercise 07), other combinations are the rules applied
  by hand; `ShuffleWriterLab` Bypass at 8 and 200 and Serialized at 201 are **ran** (exercise 07), the RDD cases and what each
  writer does are **source**; `LocalityWaitLab` is **source** only (local mode has no locality); `CheckpointCrashLab` order of
  offsets/commits and the rename are **source**, the replay of batch 1 with the state carried over is **ran** (exercise 09), the five
  crash points are reasoned, not run; `StateStoreLab` Restore/Save and versions are **source**, delta vs .sst/.zip files are **ran**
  (exercise 09), the moment of the snapshot is drawn only; `HandshakeLab` order of the 9 values, the special lengths and the error
  paths are **source** (an error raised in the function is **ran**, exercise 08; a Python crash is not tested); `WorkerReuseLab` rules
  are **source**, the Windows case (a new process per task) was observed (exercise 08), the Linux daemon was not run.
- Lesson 1, cluster managers (`RolesFlowLab`, `ClusterLaunchLab`, `StandaloneSpreadLab`, `YarnAllocLab`, `K8sBatchLab`; sub-pages `standalone`,
  `yarn`, `kubernetes`): the order of events and the class names are **source** (Spark 4.2.0: `Master.scala`, `Worker.scala`,
  `yarn/Client.scala`, `ApplicationMaster.scala`, `YarnAllocator.scala`, `KubernetesClientApplication`, `ExecutorPodsAllocator`,
  `BasicExecutorFeatureStep`, `entrypoint.sh`). Standalone is also **ran**: executors appear only after the first job and register with
  the driver (exercise 11); the cores per Worker and the number of executors of all six `StandaloneSpreadLab` cases are **ran**
  (exercise 11b, 3 Workers with 4 cores, `spark.cores.max = 6`). **Not run**: everything on YARN and Kubernetes (no Hadoop or
  Kubernetes cluster here), including the AM sleep intervals 0.2/0.4/0.8/1.6/3 s, the batch of 20 pods every second, the
  ownerReference clean-up and the claim that the driver container runs `spark-submit` in client mode. From the Spark docs, not run:
  spreadOut versus consolidate trade-off, running applications surviving a Master failover, the NodeManager killing a container that
  exceeds its memory. Made up: machine counts, container sizes, the moment the ResourceManager grants containers, the 2.5 s a pod
  takes to become Running.
- UDF lanes: call counts per kind are **ran** (exercise 08); the time drawn is proportional to calls, not measured.
- Watermark: delay 10 minutes is **ran** (exercise 09); delay 0 and 20 minutes are computed with the same rules and were not run.

## Where the evidence lives

- Evidence notes written before the rewrite: `subjects/spark/graphs/notes/` (lessons 6 to 8, audit of lessons 0 to 5).
- Knowledge graph of the Spark source: `subjects/spark/graphs/query-pipeline-current/` (253 files, 4,527 nodes).
- Labs read their data from the exercises: `joinMatrix.json` is written by `07_performance_tuning.py --write`; the other
  labs carry the measured numbers in a comment at the top of the component.
