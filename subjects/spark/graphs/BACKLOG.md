# Spark graph backlog (Spark v4.2.0, commit 32f72996)

Goal: cover Spark as widely as possible for a PySpark user who wants to understand it
deeply, not only the 14 chapters of the website. The knowledge graph lives in
`<spark repo>/.ua/` (excluded from git via `.git/info/exclude`). The newest copy is
kept in `subjects/spark/graphs/query-pipeline-current/` (despite the name it will hold the whole graph).

Cost model measured so far: about 65k-145k tokens per subagent regardless of file size
(one agent handled 7 files / 2,400 lines for 144k). Plan sets of 2,000-4,500 lines per
agent, 1-3 agents per set, so roughly 100k-400k tokens per set.

## Done

| Set | Content | Status |
|---|---|---|
| Q1-Q4 | Query pipeline: TreeNode, RuleExecutor, LogicalPlan, QueryPlan, QueryExecution, planners, SparkStrategies, SparkPlan, Optimizer, Analyzer, AstBuilder, SparkSqlParser, WholeStageCodegenExec | done (15 files) |
| 5a | AQE: AdaptiveSparkPlanExec, QueryStageExec, AQEOptimizer, coalesce/skew rules, AQEShuffleReadExec, InsertAdaptiveSparkPlan | done (7 files) |

## Backlog, in the order to run

Legend: lessons = website chapter served. Agents = estimated subagent count.

| # | Set | Files (key ones) | Lessons | Agents |
|---|---|---|---|---|
| S0 (done) | Audit of lessons 00-05 against source and real behavior (main session only, no agents) | site/src/content/lessons/spark/*.mdx | 00-05 | 0 |
| S1 (done) | Deterministic indexes, no LLM: all Rule objects (file, line, batch), all *Exec physical operators, SQLConf config catalog (name, default, doc), strategy list | catalyst, sql/core, SQLConf.scala | 06, 07 | 0 |
| S2 | Exchange (5b): ShuffleExchangeExec, EnsureRequirements, BroadcastExchangeExec | execution/exchange | 05, 07 | 1 |
| S3 | Python to JVM bridge, JVM side: ArrowEvalPythonExec, EvalPythonExec, BatchEvalPythonExec, PythonRunner, PythonWorkerFactory, ArrowPythonRunner | execution/python, core/api/python | 08 | 1-2 |
| S4 | Python worker side: worker.py, daemon.py, serializers.py, sql/udf.py, sql/pandas/serializers.py | python/pyspark | 08 | 2-3 |
| S5 | Joins and optimizer rules not yet covered: BroadcastHashJoinExec, ShuffledHashJoinExec, SortMergeJoinExec, optimizer/joins.scala, optimizer/expressions.scala | execution/joins, optimizer | 07 | 2-3 |
| S6 | Aggregation and window execs: HashAggregateExec, ObjectHashAggregateExec, SortAggregateExec, AggUtils, WindowExec | execution/aggregate, window | 05, 07 | 1-2 |
| S7 | Data source read path: FileSourceScanExec, FileScanRDD, ParquetFileFormat, ParquetFilters, partition pruning, DataSourceStrategy | execution/datasources | 04 | 2 |
| S8 | Spark Connect: pyspark/sql/connect (session, client, dataframe, plan), sql/connect server (service, planner), protobuf | python/pyspark/sql/connect, sql/connect | 11 | 2-3 |
| S9 | Scheduler: DAGScheduler, TaskSchedulerImpl, TaskSetManager, Stage classes, scheduler backend | core/scheduler | 05, 13 | 2-3 |
| S10 | Shuffle: SortShuffleManager, writers, BlockStoreShuffleReader, IndexShuffleBlockResolver, ShuffleBlockFetcherIterator | core/shuffle, storage | 05, 07 | 2 |
| S11 | Structured Streaming: StreamExecution, MicroBatchExecution, StateStore, RocksDB provider, watermark, checkpoint | execution/streaming | 09 | 3-4 |
| S12 | Memory and storage: UnifiedMemoryManager, TaskMemoryManager, BlockManager, MemoryStore, DiskStore | core/memory, storage | 07 | 2 |
| S13 | Catalyst expressions and codegen: Expression, namedExpressions, predicates, CodeGenerator, Cast, TypeCoercion | catalyst/expressions, analysis | 06 | 2-3 |
| S14 | PySpark API surface: dataframe.py, column.py, session.py, readwriter.py, group.py, window.py, types.py | python/pyspark/sql | 03 | 3 |
| S15 | DataSource V2 and catalog interfaces (hooks used by Delta, Iceberg, Hudi) | catalyst/connector, catalog | 10 | 2 |
| S16 | RDD, SparkContext, dependencies, partitioners, SparkEnv | core/rdd, SparkContext | 01, 13 | 2 |
| S17 | Executor and deploy: Executor, CoarseGrainedExecutorBackend, SparkSubmit, standalone master/worker, YARN and Kubernetes entry points | core/executor, deploy, resource-managers | 11 | 3 |
| S18 | Spark UI, metrics, status store, SQL UI listener | core/ui, status, sql ui | 11 | 2 |
| S19 | DataFrame API and SparkSession (Scala side): SparkSession, Dataset, readers/writers | sql/core classic | 03 | 2 |
| S20 | Python data source API, PySpark streaming, declarative pipelines | pyspark/sql/datasource.py, streaming, pipelines, sql/pipelines | 09 | 2 |
| S21 | pandas API on Spark: internal.py, frame.py, series.py (key parts) | python/pyspark/pandas | 03 | 3 |
| S22 | MLlib core abstractions: Pipeline, Estimator, Transformer, Param (Scala and Python) | mllib, python/pyspark/ml | 12 | 2 |
| S23 | Common infrastructure: network RPC, external shuffle service, unsafe, kvstore, launcher | common/*, launcher | 13 | 3 |

Not planned (low value for the goal): hive, hive-thriftserver, graphx, R, kinesis, ganglia,
connector/* other than possibly kafka source, docs, examples.

Things that are not graphs but would help (do when cheap):
- Lesson evidence notes: per lesson, verified facts with source references (file:line) so
  the lesson can be written or fixed quickly. Stored in `subjects/spark/graphs/notes/`.
- Real-behavior checks with PySpark 4.2.0 in this project's venv (explain output, default
  configs, partition counts) for claims in lessons 00-05.

## Rules for each set (so an interrupted run can be resumed safely)

1. Snapshot first: copy `.ua/knowledge-graph.json`, `fingerprints.json`, `meta.json`,
   `.understandignore` and `intermediate/scan-result.json` to the session scratchpad
   `repair/snap-<set>/`.
2. Clear `.ua/intermediate/*` except `scan-result.json` (a stale `incremental-baseline.json`
   corrupts the next merge). If `scan-result.json` was refreshed by an aborted run, restore
   it to the files that are in `fingerprints.json`.
3. Keep new files under 50 percent of the current file count, otherwise the skill plans a
   FULL_UPDATE (rebuild everything). Split the set instead.
4. Run prepare, batches, agents, merge, finalize one step at a time and check each result.
5. Verify after finalize: one connected component, no dangling edges, fingerprints and
   meta equal to the graph file count, line ranges match source, no non-ASCII characters.
6. Add layers and tour steps by hand, then copy graph, meta and ignore file to
   `subjects/spark/graphs/query-pipeline-current/` and append a line to `PROGRESS.md`.
7. If any check fails: restore the snapshot, log the failure in `PROGRESS.md`, move on.
8. Never commit or push anything, never touch Spark source files.

## Status update (graph at 217 files, 3,867 nodes) and what exists beyond S23

Done since the table above was written: S3, S4, S7, S8, S9 (+S9b bridge), S10, S11, S13, S14 and gap fills
(Rule, data source API, Parquet readers, Python bridge pieces). Not done yet: S12, S15 to S23.
Coverage at this point: 13.1 percent of all main code lines, 16.2 percent of the "relevant" scope (see tools/coverage.cjs).

After S23 there is still a lot, because S1-S23 only pick the files that explain how a query runs. Remaining
(main code lines, from tools/coverage.cjs, before S12 and S15-S23 are done):

| Area | Lines left | Priority | Notes |
|---|---|---|---|
| sql/catalyst (analysis, optimizer, parser, expression families) | about 213k | high | datetime/string/collection/regexp/hash expressions, rest of Analyzer rules, optimizer subpackages, catalog/connector interfaces, rest of plans/logical, types/encoders. Split by family, one set each. |
| sql/core (rest of execution) | about 160k | high | FileFormatWriter and commands (write path), other file formats (CSV/JSON/ORC/text), datasources/v2 (S15 only starts it), exchange leftovers, python/ leftovers (MapInPandas, grouped UDF execs), streaming sources/sinks and operators (joins, flatMapGroupsWithState), ui, internal/SQLConf |
| core (rest) | about 125k | medium | rdd/ subclasses, broadcast, memory, serializer, storage (rest), network use, deploy master/worker, util, status/ui (S18 part), resource, security, metrics, plugins |
| python/pyspark/sql (rest) | about 78k | medium | functions/builtin.py (30k lines, mostly generated-looking docs: sample only), pandas/ (conversion, group_ops, map_ops, serializers done), streaming, datasource, udf/udtf, catalog |
| sql/api | about 58k | medium | Dataset/DataFrame public Scala API, encoders, types, parser interfaces |
| sql/connect (rest) | about 36k | medium | rest of server (execution manager, plugins, handlers), client (Scala), common, the .proto files |
| mllib + python ml/mllib | about 135k | low for a PySpark SQL user | S22 only covers Pipeline/Estimator/Transformer/Param |
| python/pyspark/pandas | about 68k | medium | S21 covers key parts only |
| streaming (DStream), hive, hive-thriftserver | about 50k | low | legacy or optional |
| resource-managers (k8s, yarn) | about 17k | low | entry points are in S17 |
| common/* | about 37k | medium | S23 |
| sql/pipelines (declarative pipelines) | about 9k | low | S20 |
| connector/* (kafka, avro, protobuf), graphx, R | not measured | low | outside the goal |

Honest limit: full coverage costs about 35 tokens per line, so the whole repo is roughly 40M subagent tokens, which is
not practical. A realistic end state is 30 to 35 percent of the relevant scope by finishing S12 and S15-S23 (roughly
60-90k more lines) and then adding the high-priority rows above only when a question or a lesson needs them.
Rule of thumb for the next person: add a set only when a lesson claim or a debugging question points at code that
is not in the graph; use `subjects/spark/graphs/index/*` (generated, free) for rules, configs and physical operators in the meantime.

Known small gaps to fold into the next sets: SortExec, InMemoryRelation, CacheManager, MapStatus, Spillable,
MemoryStore, ShuffledRDD/ShuffledRowRDD, 19 Optimizer/Analyzer Rule subclasses without class nodes,
SpecificParquetRecordReaderBase, PythonPlannerRunner, StateStoreCoordinator, stream-stream join execs,
errors/exceptions/captured.py, pandas/conversion.py and group_ops.py mixins, the Spark Connect .proto files.

## Core completion plan (added 2026-10-27, after S19)
Goal: every file under core/src/main in the graph. 565 files (about 90k lines) were missing; they are split into
waves C1..C21 (30 files or fewer each) in tools/core-waves.json (made by tools/core-waves.cjs, the order is
scheduler, storage/memory/shuffle, serializer/executor/rpc, rdd/network, api/resource/metrics/config, util, deploy, ui, status/protobuf).
Run one wave like any stage (append "!path" lines to .ua/.understandignore, prep_stage.sh, agents, post_stage.sh).
Rough cost: 0.7-1M subagent tokens per wave, 15-20M for all 21.

## SQL completion plan (started 2026-10-28, depth B)
Remaining sql main code at start: catalyst 864 files, core 691, api 199, connect 149, pipelines 48 (about 1,950 files, 445k lines).
hive and hive-thriftserver are not planned. Estimated cost 25 to 30M subagent tokens, about 70 waves of at most 30 files.
Depth B: every file gets a file node. Logic files (optimizer, resolver, planners, execs, runtime) get class and function nodes as
in core. Long tail files (lists of expressions, small Java interfaces, UDF interfaces, protobuf serializers) get file and class
nodes with summaries, and no per-function nodes. Each such file is recorded in `tools/shallow-files.txt` so depth A can be added later
(ids are stable; the way to re-analyse an already included file is untested, try it on one small file first).
Phases: 1 gaps (SQLConf, SessionState, SharedState, DataSource, columnNodes, sql/api functions and core classes, Rule subclasses, Connect proto,
captured.py), 2 sql/core runtime, 3 sql/core streaming, 4 sql/catalyst, 5 sql/connect and sql/pipelines, 6 rest of sql/api.
