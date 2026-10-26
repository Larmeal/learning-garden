# Config catalog (Spark v4.2.0, commit 32f72996)

Generated from source by a script (not an LLM) from SQLConf, StaticSQLConf and the core config package.
Only public (non-internal) configs are listed here; internal ones are in `configs.json`.
Defaults are the source expressions. `(fallback to X)` means the value defaults to another config. Docs are cut at 170 characters.

Counts: 1294 configs found, 755 public with a resolved key.

## Tuning highlights

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.broadcast.blockSize | 4m | 0.5.0 | Size of each piece of a block for TorrentBroadcastFactory, in KiB unless otherwise specified. Too large a value decreases parallelism during broadcast (makes it slower);  | package.scala:2252 |
| spark.broadcast.checksum | true | 2.1.1 | Whether to enable checksum for broadcast. If enabled, broadcasts will include a checksum, which can help detect corrupted blocks, at the cost of computing and sending a l | package.scala:2261 |
| spark.broadcast.compress | true | 0.6.0 | Whether to compress broadcast variables before sending them. Generally a good idea. Compression will use spark.io.compression.codec | package.scala:2246 |
| spark.broadcast.UDFCompressionThreshold | 1L * 1024 * 1024 | 3.0.0 | The threshold at which user-defined functions (UDFs) and Python RDD commands are compressed by broadcast in bytes unless otherwise specified | package.scala:2272 |
| spark.default.parallelism | (none) | 0.5.0 | Default number of partitions in RDDs returned by transformations like join, reduceByKey, and parallelize when not set by user. For distributed shuffle operations like red | package.scala:46 |
| spark.driver.maxResultSize | 1g | 1.2.0 | Size limit for results. | package.scala:1649 |
| spark.driver.memory | 1g | 1.1.1 | Amount of memory to use for the driver process, in MiB unless otherwise specified. | package.scala:119 |
| spark.driver.memoryOverhead | (none) | 2.3.0 | The amount of non-heap memory to be allocated per driver in cluster mode, in MiB unless otherwise specified. | package.scala:125 |
| spark.driver.memoryOverheadFactor | 0.1 | 3.3.0 | Fraction of driver memory to be allocated as additional non-heap memory per driver process in cluster mode. This is memory that accounts for things like VM overheads, int | package.scala:141 |
| spark.dynamicAllocation.cachedExecutorIdleTimeout | Integer.MAX_VALUE | 1.4.0 |  | package.scala:766 |
| spark.dynamicAllocation.enabled | false | 1.2.0 |  | package.scala:731 |
| spark.dynamicAllocation.executorAllocationRatio | 1.0 | 2.4.0 |  | package.scala:760 |
| spark.dynamicAllocation.executorIdleTimeout | 60 | 1.2.0 |  | package.scala:773 |
| spark.dynamicAllocation.initialExecutors | (fallback to DYN_ALLOCATION_MIN_EXECUTORS) | 1.3.0 |  | package.scala:749 |
| spark.dynamicAllocation.maxExecutors | Int.MaxValue | 1.2.0 |  | package.scala:754 |
| spark.dynamicAllocation.minExecutors | 0 | 1.2.0 |  | package.scala:743 |
| spark.dynamicAllocation.schedulerBacklogTimeout | 1 | 1.2.0 |  | package.scala:793 |
| spark.dynamicAllocation.shuffleTracking.enabled | true | 3.0.0 |  | package.scala:780 |
| spark.dynamicAllocation.shuffleTracking.timeout | Long.MaxValue | 3.0.0 |  | package.scala:786 |
| spark.dynamicAllocation.sustainedSchedulerBacklogTimeout | (fallback to DYN_ALLOCATION_SCHEDULER_BACKLOG_TIMEOUT) | 1.2.0 |  | package.scala:798 |
| spark.dynamicAllocation.testing | false | 1.2.0 |  | package.scala:737 |
| spark.executor.cores | 1 | 1.0.0 |  | package.scala:413 |
| spark.executor.instances | (none) | 1.0.0 |  | package.scala:920 |
| spark.executor.memory | 1g | 0.7.0 | Amount of memory to use per executor process, in MiB unless otherwise specified, and with minimum value 450m | package.scala:418 |
| spark.executor.memoryOverhead | (none) | 2.3.0 | The amount of non-heap memory to be allocated per executor, in MiB unless otherwise specified. | package.scala:425 |
| spark.executor.memoryOverheadFactor | 0.1 | 3.3.0 | Fraction of executor memory to be allocated as additional non-heap memory per executor process. This is memory that accounts for things like VM overheads, interned string | package.scala:442 |
| spark.executor.pyspark.memory | (none) | 2.4.0 |  | Python.scala:54 |
| spark.executor.python.worker.log.details | false | 3.5.0 |  | Python.scala:39 |
| spark.files.maxPartitionBytes | 128 * 1024 * 1024 | 2.1.0 | The maximum number of bytes to pack into a single partition when reading files. | package.scala:1278 |
| spark.files.openCostInBytes | 4 * 1024 * 1024 | 2.1.0 | The estimated cost to open a file, measured by the number of bytes could be scanned in the same time. This is used when putting multiple files into a partition. It's bett | package.scala:1284 |
| spark.history.store.serializer | LocalStoreSerializer.JSON.toString | 3.4.0 | Serializer for writing/reading in-memory UI objects to/from disk-based KV Store; JSON or PROTOBUF. JSON serializer is the only choice before Spark 3.4.0, thus it is the d | History.scala:120 |
| spark.kryoserializer.buffer | 64k | 1.4.0 |  | Kryo.scala:56 |
| spark.kryoserializer.buffer.max | 64m | 1.4.0 |  | Kryo.scala:61 |
| spark.memory.fraction | 0.6 | 1.6.0 | Fraction of (heap space - 300MB) used for execution and storage. The lower this is, the more frequently spills and cached data eviction occur. The purpose of this config  | package.scala:495 |
| spark.memory.offHeap.enabled | false | 1.6.0 | If true, Spark will attempt to use off-heap memory for certain operations. If off-heap memory use is enabled, then spark.memory.offHeap.size must be positive. | package.scala:466 |
| spark.memory.offHeap.size | 0 | 1.6.0 | The absolute amount of memory which can be used for off-heap allocation, in bytes unless otherwise specified. This setting has no impact on heap memory usage, so if your  | package.scala:474 |
| spark.memory.storageFraction | 0.5 | 1.6.0 | Amount of storage memory immune to eviction, expressed as a fraction of the size of the region set aside by spark.memory.fraction. The higher this is, the less working me | package.scala:485 |
| spark.pyspark.driver.python | (none) | 2.1.0 |  | package.scala:1159 |
| spark.pyspark.python | (none) | 2.1.0 |  | package.scala:1164 |
| spark.python.daemon.killWorkerOnFlushFailure | true | 4.1.0 | When enabled, exceptions raised during output flush operations in the Python worker managed under Python daemon are not caught, causing the worker to terminate with the e | Python.scala:143 |
| spark.python.daemon.module | (none) | 2.4.0 |  | Python.scala:44 |
| spark.python.factory.idleWorkerMaxPoolSize | (none) | 4.1.0 | Maximum number of idle Python workers to keep. If unset, the number is unbounded. If set to a positive integer N, at most N idle workers are retained; least-recently used | Python.scala:132 |
| spark.python.task.killTimeout | 2s | 2.2.2 |  | Python.scala:29 |
| spark.python.unix.domain.socket.enabled | sys.env.get("PYSPARK_UDS_MODE").contains("true") | 4.1.0 | When set to true, the Python driver uses a Unix domain socket for operations like creating or collecting a DataFrame from local data, using accumulators, and executing Py | Python.scala:73 |
| spark.python.use.daemon | true | 2.3.0 |  | Python.scala:34 |
| spark.python.worker.faulthandler.enabled | false | 3.2.0 | When true, Python workers set up the faulthandler for the case when the Python worker exits unexpectedly (crashes), and shows the stack trace of the moment the Python wor | Python.scala:65 |
| spark.python.worker.idleTimeoutSeconds | 0 | 4.0.0 | The time (in seconds) Spark will wait for activity (e.g., data transfer or communication) from a Python worker before considering it potentially idle or unresponsive. Whe | Python.scala:100 |
| spark.python.worker.killOnIdleTimeout | false | 4.1.0 | Whether Spark should terminate the Python worker process when the idle timeout (as defined by $PYTHON_WORKER_IDLE_TIMEOUT_SECONDS_KEY) is reached. If enabled, Spark will  | Python.scala:113 |
| spark.python.worker.module | (none) | 2.4.0 |  | Python.scala:49 |
| spark.python.worker.reuse | true | 1.2.0 |  | Python.scala:24 |
| spark.python.worker.tracebackDumpIntervalSeconds | 0 | 4.1.0 | The interval (in seconds) for Python workers to dump their tracebacks. If it's positive, the Python worker will periodically dump the traceback into its `stderr`. The def | Python.scala:122 |
| spark.serializer | "org.apache.spark.serializer.JavaSerializer" | 0.5.0 |  | package.scala:2309 |
| spark.serializer.extraDebugInfo | true | 1.3.0 |  | package.scala:2320 |
| spark.serializer.objectStreamReset | 100 | 1.0.0 |  | package.scala:2315 |
| spark.speculation | false | 0.6.0 |  | package.scala:2414 |
| spark.speculation.efficiency.enabled | true | 3.4.0 | When set to true, spark will evaluate the efficiency of task processing through the stage task metrics or its duration, and only need to speculate the inefficient tasks.  | package.scala:2481 |
| spark.speculation.efficiency.longRunTaskFactor | 2.0 | 3.4.0 | A task will be speculated anyway as long as its duration has exceeded the value of multiplying the factor and the time threshold (either be ${SPECULATION_MULTIPLIER.key}  | package.scala:2469 |
| spark.speculation.efficiency.processRateMultiplier | 0.75 | 3.4.0 | A multiplier that used when evaluating inefficient tasks. The higher the multiplier is, the more tasks will be possibly considered as inefficient. | package.scala:2460 |
| spark.speculation.interval | 100 | 0.6.0 |  | package.scala:2420 |
| spark.speculation.minTaskRuntime | 100 | 3.2.0 | Minimum amount of time a task runs before being considered for speculation. This can be used to avoid launching speculative copies of tasks that are very short. | package.scala:2438 |
| spark.speculation.multiplier | 3 | 0.6.0 |  | package.scala:2426 |
| spark.speculation.quantile | 0.9 | 0.6.0 |  | package.scala:2432 |
| spark.speculation.task.duration.threshold | (none) | 3.0.0 | Task duration after which scheduler would try to speculative run the task. If provided, tasks would be speculatively run if current stage contains less tasks than or equa | package.scala:2446 |
| spark.sql.adaptive.advisoryPartitionSizeInBytes | (fallback to SHUFFLE_TARGET_POSTSHUFFLE_INPUT_SIZE) | 3.0.0 | The advisory size in bytes of the shuffle partition during adaptive optimization (when ${ADAPTIVE_EXECUTION_ENABLED.key} is true). It takes effect when Spark coalesces sm | SQLConf.scala:1094 |
| spark.sql.adaptive.autoBroadcastJoinThreshold | (none) | 3.2.0 | Configures the maximum size in bytes for a table that will be broadcast to all worker nodes when performing a join. By setting this value to -1 broadcasting can be disabl | SQLConf.scala:1281 |
| spark.sql.adaptive.coalescePartitions.enabled | true | 3.0.0 | When true and '${ADAPTIVE_EXECUTION_ENABLED.key}' is true, Spark will coalesce contiguous shuffle partitions according to the target size (specified by '${ADVISORY_PARTIT | SQLConf.scala:1102 |
| spark.sql.adaptive.coalescePartitions.initialPartitionNum | (none) | 3.0.0 | The initial number of shuffle partitions before coalescing. If not set, it equals to ${SHUFFLE_PARTITIONS.key}. This configuration only has an effect when '${ADAPTIVE_EXE | SQLConf.scala:1147 |
| spark.sql.adaptive.coalescePartitions.minPartitionSize | 1MB | 3.2.0 | The minimum size of shuffle partitions after coalescing. This is useful when the adaptively calculated target size is too small during partition coalescing. | SQLConf.scala:1125 |
| spark.sql.adaptive.coalescePartitions.parallelismFirst | true | 3.2.0 | When true, Spark does not respect the target size specified by '${ADVISORY_PARTITION_SIZE_IN_BYTES.key}' (default 64MB) when coalescing contiguous shuffle partitions, but | SQLConf.scala:1111 |
| spark.sql.adaptive.customCostEvaluatorClass | (none) | 3.2.0 | The custom cost evaluator class to be used for adaptive execution. If not being set, Spark will use its own SimpleCostEvaluator by default. | SQLConf.scala:1328 |
| spark.sql.adaptive.enabled | true | 1.6.0 | When true, enable adaptive query execution, which re-optimizes the query plan in the middle of query execution, based on accurate runtime statistics. | SQLConf.scala:1050 |
| spark.sql.adaptive.forceOptimizeSkewedJoin | false | 3.3.0 | When true, force enable OptimizeSkewedJoin even if it introduces extra shuffle. | SQLConf.scala:1321 |
| spark.sql.adaptive.localShuffleReader.enabled | true | 3.0.0 | When true and '${ADAPTIVE_EXECUTION_ENABLED.key}' is true, Spark tries to use local shuffle reader to read the shuffle data when the shuffle partitioning is not needed, f | SQLConf.scala:1222 |
| spark.sql.adaptive.maxShuffledHashJoinLocalMapThreshold | 0L | 3.2.0 | Configures the maximum size in bytes per partition that can be allowed to build local hash map. If this value is not smaller than ${ADVISORY_PARTITION_SIZE_IN_BYTES.key}  | SQLConf.scala:1291 |
| spark.sql.adaptive.optimizer.excludedRules | (none) | 3.1.0 | Configures a list of rules to be disabled in the adaptive optimizer, in which the rules are specified by their rule names and separated by comma. The optimizer will log t | SQLConf.scala:1272 |
| spark.sql.adaptive.optimizeSkewsInRebalancePartitions.enabled | true | 3.2.0 | When true and '${ADAPTIVE_EXECUTION_ENABLED.key}' is true, Spark will optimize the skewed shuffle partitions in RebalancePartitions and split them to smaller ones accordi | SQLConf.scala:1302 |
| spark.sql.adaptive.rebalancePartitionsSmallPartitionFactor | 0.2 | 3.3.0 | A partition will be merged during splitting if its size is small than this factor multiply ${ADVISORY_PARTITION_SIZE_IN_BYTES.key}. | SQLConf.scala:1312 |
| spark.sql.adaptive.skewJoin.enabled | true | 3.0.0 | When true and '${ADAPTIVE_EXECUTION_ENABLED.key}' is true, Spark dynamically handles skew in shuffled join (sort-merge and shuffled hash) by splitting (and replicating if | SQLConf.scala:1231 |
| spark.sql.adaptive.skewJoin.skewedPartitionFactor | 5.0 | 3.0.0 | A partition is considered as skewed if its size is larger than this factor multiplying the median partition size and also larger than 'spark.sql.adaptive.skewJoin.skewedP | SQLConf.scala:1240 |
| spark.sql.adaptive.skewJoin.skewedPartitionThresholdInBytes | 256MB | 3.0.0 | A partition is considered as skewed if its size in bytes is larger than this threshold and also larger than '${SKEW_JOIN_SKEWED_PARTITION_FACTOR.key}' multiplying the med | SQLConf.scala:1250 |
| spark.sql.autoBroadcastJoinThreshold | 10MB | 1.1.0 | Configures the maximum size in bytes for a table that will be broadcast to all worker nodes when performing a join. By setting this value to -1 broadcasting can be disabl | SQLConf.scala:949 |
| spark.sql.cache.serializer | "org.apache.spark.sql.execution.columnar.DefaultCachedBatchSerializer" | 3.1.0 | The name of a class that implements org.apache.spark.sql.columnar.CachedBatchSerializer. It will be used to translate SQL data into a format that can more efficiently be  | StaticSQLConf.scala:145 |
| spark.sql.execution.arrow.compression.codec | "none" | 4.1.0 | Compression codec used to compress Arrow IPC data when transferring data between JVM and Python processes (e.g., toPandas, toArrow). This can significantly reduce memory  | SQLConf.scala:4640 |
| spark.sql.execution.arrow.compression.zstd.level | 3 | 4.1.0 | Compression level for Zstandard (zstd) codec when compressing Arrow IPC data. This config is only used when spark.sql.execution.arrow.compression.codec is set to 'zstd'.  | SQLConf.scala:4654 |
| spark.sql.execution.arrow.enabled | true | 2.3.0 | (Deprecated since Spark 3.0, please set 'spark.sql.execution.arrow.pyspark.enabled'.) | SQLConf.scala:4399 |
| spark.sql.execution.arrow.fallback.enabled | true | 2.4.0 | (Deprecated since Spark 3.0, please set 'spark.sql.execution.arrow.pyspark.fallback.enabled'.) | SQLConf.scala:4566 |
| spark.sql.execution.arrow.localRelationThreshold | 48MB | 3.4.0 | When converting Arrow batches to Spark DataFrame, local collections are used in the driver side if the byte size of Arrow batches is smaller than this threshold. Otherwis | SQLConf.scala:4442 |
| spark.sql.execution.arrow.maxRecordsPerBatch | 10000 | 2.3.0 | When using Apache Arrow, limit the maximum number of records that can be written to a single ArrowRecordBatch in memory. If set to zero or negative there is no limit. See | SQLConf.scala:4581 |
| spark.sql.execution.arrow.pyspark.enabled | (fallback to ARROW_EXECUTION_ENABLED) | 3.0.0 | When true, make use of Apache Arrow for columnar data transfers in PySpark. This optimization applies to: 1. pyspark.sql.DataFrame.toPandas. 2. pyspark.sql.SparkSession.c | SQLConf.scala:4406 |
| spark.sql.execution.arrow.pyspark.fallback.enabled | (fallback to ARROW_FALLBACK_ENABLED) | 3.0.0 | When true, optimizations enabled by '${ARROW_PYSPARK_EXECUTION_ENABLED.key}' will fallback automatically to non-optimized implementations if an error occurs. | SQLConf.scala:4574 |
| spark.sql.execution.arrow.pyspark.selfDestruct.enabled | false | 3.2.0 | (Experimental) When true, make use of Apache Arrow's self-destruct and split-blocks options for columnar data transfers in PySpark, when converting from Arrow to Pandas.  | SQLConf.scala:4418 |
| spark.sql.execution.arrow.pyspark.validateSchema.enabled | false | 4.1.0 | When true, validate the schema of Arrow batches returned by mapInArrow, mapInPandas and DataSource against the expected schema to ensure that they are compatible. | SQLConf.scala:4766 |
| spark.sql.execution.arrow.pythonUDF.columnarInput.enabled | true | 4.2.0 | When true, Arrow-based Python UDFs (pandas UDFs) can accept columnar input directly from upstream operators that produce Arrow-backed ColumnarBatch (e.g., DataSource V2 c | SQLConf.scala:4666 |
| spark.sql.execution.arrow.sparkr.enabled | false | 3.0.0 | When true, make use of Apache Arrow for columnar data transfers in SparkR. This optimization applies to: 1. createDataFrame when its input is an R DataFrame 2. collect 3. | SQLConf.scala:4552 |
| spark.sql.execution.arrow.transformWithStateInPySpark.maxStateRecordsPerBatch | 10000 | 4.0.0 | When using TransformWithState in PySpark (both Python Row and Pandas), limit the maximum number of state records that can be written to a single ArrowRecordBatch in memor | SQLConf.scala:4679 |
| spark.sql.execution.arrow.useLargeVarTypes | false | 3.5.0 | When using Apache Arrow, use large variable width vectors for string and binary types. Regular string and binary types have a 2GiB limit for a column in a single record b | SQLConf.scala:4691 |
| spark.sql.execution.pyspark.binaryAsBytes | true | 4.1.0 | When true, BinaryType is consistently mapped to bytes in PySpark. When false, restores the PySpark behavior before 4.1.0. Before 4.1.0, BinaryType is mapped to bytearray  | SQLConf.scala:4429 |
| spark.sql.execution.pyspark.udf.daemonKillWorkerOnFlushFailure | (fallback to Python.PYTHON_DAEMON_KILL_WORKER_ON_FLUSH_FAILURE) | 4.1.0 | Same as ${Python.PYTHON_DAEMON_KILL_WORKER_ON_FLUSH_FAILURE.key} for Python execution with DataFrame and SQL. It can change during runtime. | SQLConf.scala:4526 |
| spark.sql.execution.pyspark.udf.faulthandler.enabled | (fallback to Python.PYTHON_WORKER_FAULTHANLDER_ENABLED) | 4.0.0 | Same as ${Python.PYTHON_WORKER_FAULTHANLDER_ENABLED.key} for Python execution with DataFrame and SQL. It can change during runtime. | SQLConf.scala:4494 |
| spark.sql.execution.pyspark.udf.hideTraceback.enabled | false | 4.0.0 | When true, only show the message of the exception from Python UDFs, hiding the stack trace. If this is enabled, simplifiedTraceback has no effect. | SQLConf.scala:4746 |
| spark.sql.execution.pyspark.udf.idleTimeoutSeconds | (fallback to Python.PYTHON_WORKER_IDLE_TIMEOUT_SECONDS) | 4.0.0 | Same as ${Python.PYTHON_WORKER_IDLE_TIMEOUT_SECONDS.key} for Python execution with DataFrame and SQL. It can change during runtime. | SQLConf.scala:4502 |
| spark.sql.execution.pyspark.udf.killOnIdleTimeout | (fallback to Python.PYTHON_WORKER_KILL_ON_IDLE_TIMEOUT) | 4.1.0 | Same as ${Python.PYTHON_WORKER_KILL_ON_IDLE_TIMEOUT.key} for Python execution with DataFrame and SQL. It can change during runtime. | SQLConf.scala:4510 |
| spark.sql.execution.pyspark.udf.simplifiedTraceback.enabled | !Utils.isTesting | 3.1.0 | When true, the traceback from Python UDFs is simplified. It hides the Python worker, (de)serialization, etc from PySpark in tracebacks, and only shows the exception messa | SQLConf.scala:4755 |
| spark.sql.execution.pyspark.udf.tracebackDumpIntervalSeconds | (fallback to Python.PYTHON_WORKER_TRACEBACK_DUMP_INTERVAL_SECONDS) | 4.1.0 | Same as ${Python.PYTHON_WORKER_TRACEBACK_DUMP_INTERVAL_SECONDS.key} for Python execution with DataFrame and SQL. It can change during runtime. | SQLConf.scala:4518 |
| spark.sql.execution.python.udf.buffer.size | (fallback to BUFFER_SIZE) | 4.0.0 | Same as `${BUFFER_SIZE.key}` but only applies to Python UDF executions. If it is not set, the fallback is `${BUFFER_SIZE.key}`. | SQLConf.scala:4711 |
| spark.sql.execution.python.udf.maxRecordsPerBatch | 100 | 4.0.0 | When using Python UDFs, limit the maximum number of records that can be batched for serialization/deserialization. | SQLConf.scala:4701 |
| spark.sql.execution.pythonUDF.arrow.concurrency.level | (none) | 4.0.0 | The level of concurrency to execute Arrow-optimized Python UDF. This can be useful if Python UDFs use I/O intensively. | SQLConf.scala:4783 |
| spark.sql.execution.pythonUDF.arrow.enabled | true | 3.4.0 | Enable Arrow optimization in regular Python UDFs. This optimization can only be enabled when the given function takes at least one argument. | SQLConf.scala:4775 |
| spark.sql.execution.pythonUDTF.arrow.enabled | true | 3.5.0 | Enable Arrow optimization for Python UDTFs. | SQLConf.scala:4821 |
| spark.sql.files.maxPartitionBytes | 128MB | 2.0.0 | The maximum number of bytes to pack into a single partition when reading files. This configuration is effective only when using file-based sources such as Parquet, JSON a | SQLConf.scala:2706 |
| spark.sql.pyspark.dataSource.profiler | (none) | 4.2.0 | Configure the Python Data Source profiler by enabling or disabling it with the option to choose between \ and \ types, or unsetting the config disables the profiler. This | SQLConf.scala:4472 |
| spark.sql.pyspark.inferNestedDictAsStruct.enabled | false | 3.3.0 | PySpark's SparkSession.createDataFrame infers the nested dict as a map by default. When it set to true, it infers the nested dict as a struct. | SQLConf.scala:6626 |
| spark.sql.pyspark.jvmStacktrace.enabled | Utils.isTesting | 3.0.0 | When true, it shows the JVM stacktrace in the user-facing PySpark exception together with Python stacktrace. By default, it is disabled to hide JVM stacktrace and shows a | SQLConf.scala:4461 |
| spark.sql.pyspark.plotting.max_rows | 1000 | 4.0.0 | The visual limit on plots. If set to 1000 for top-n-based plots (pie, bar, barh), the first 1000 data points will be used for plotting. For sampled-based plots (scatter,  | SQLConf.scala:4543 |
| spark.sql.pyspark.toJSON.returnDataFrame | false | 4.2.0 | When true, DataFrame.toJSON in PySpark Classic returns a Dataframe instead of RDD. | SQLConf.scala:4454 |
| spark.sql.pyspark.udf.profiler | (none) | 4.0.0 | Configure the Python/Pandas UDF profiler by enabling or disabling it with the option to choose between \ and \ types, or unsetting the config disables the profiler. This  | SQLConf.scala:4483 |
| spark.sql.pyspark.worker.logging.enabled | false | 4.1.0 | When set to true, this configuration enables comprehensive logging within Python worker processes that execute User-Defined Functions (UDFs), User-Defined Table Functions | SQLConf.scala:4534 |
| spark.sql.shuffle.partitions | 200 | 1.1.0 | The default number of partitions to use when shuffling data for joins or aggregations. | SQLConf.scala:1000 |
| spark.streaming.dynamicAllocation.enabled | false | 3.0.0 |  | Streaming.scala:25 |
| spark.streaming.dynamicAllocation.maxExecutors | Int.MaxValue | 3.0.0 |  | Streaming.scala:45 |
| spark.streaming.dynamicAllocation.minExecutors | (none) | 3.0.0 |  | Streaming.scala:37 |
| spark.streaming.dynamicAllocation.scalingDownRatio | 0.3 | 3.0.0 |  | Streaming.scala:69 |
| spark.streaming.dynamicAllocation.scalingInterval | 60 | 3.0.0 |  | Streaming.scala:53 |
| spark.streaming.dynamicAllocation.scalingUpRatio | 0.9 | 3.0.0 |  | Streaming.scala:61 |
| spark.streaming.dynamicAllocation.testing | false | 3.0.0 |  | Streaming.scala:31 |
| spark.testing.dynamicAllocation.schedule.enabled | true | 3.1.0 |  | Tests.scala:32 |

## All public configs by prefix

### spark.acls (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.acls.enable | false | 1.1.0 |  | UI.scala:191 |

### spark.admin (2)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.admin.acls | Nil | 1.1.0 |  | UI.scala:208 |
| spark.admin.acls.groups | Nil | 2.0.0 |  | UI.scala:214 |

### spark.api (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.api.mode |  | 4.0.0 | For Spark Classic applications, specify whether to automatically use Spark Connect by running a local Spark Connect server dedicated to the application. The server is ter | package.scala:2931 |

### spark.appStateStore (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.appStateStore.asyncTracking.enable | true | 2.3.0 |  | Status.scala:24 |

### spark.archives (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.archives | Nil | 3.1.0 | Comma-separated list of archives to be extracted into the working directory of each executor. .jar, .tar.gz, .tgz and .zip are supported. You can specify the directory na | package.scala:2337 |

### spark.authenticate (7)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.authenticate | false | 1.0.0 |  | package.scala:1333 |
| spark.authenticate.enableSaslEncryption | false | 1.4.0 |  | package.scala:1339 |
| spark.authenticate.secret | (none) | 1.0.0 |  | package.scala:1321 |
| spark.authenticate.secret.driver.file | (fallback to AUTH_SECRET_FILE) | 3.0.0 | Path to a file that contains the authentication secret to use. Loaded by the driver. In Kubernetes client mode it is often useful to set a different secret path for the d | package.scala:1355 |
| spark.authenticate.secret.executor.file | (fallback to AUTH_SECRET_FILE) | 3.0.0 | Path to a file that contains the authentication secret to use. Loaded by the executors only. In Kubernetes client mode it is often useful to set a different secret path f | package.scala:1367 |
| spark.authenticate.secret.file | (none) | 3.0.0 | Path to a file that contains the authentication secret to use. The secret key is loaded from this path on both the driver and the executors if overrides are not set for e | package.scala:1345 |
| spark.authenticate.secretBitLength | 256 | 1.6.0 |  | package.scala:1327 |

### spark.barrier (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.barrier.sync.timeout | 365d | 2.4.0 | The timeout in seconds for each barrier() call from a barrier task. If the coordinator didn't receive all the sync messages from barrier tasks within the configured time, | package.scala:1870 |

### spark.block (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.block.failures.beforeLocationRefresh | 5 | 2.0.0 | Max number of failures before this block manager refreshes the block locations from the driver. | package.scala:709 |

### spark.blockManager (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.blockManager.port | 0 | 1.1.0 | Port to use for the block manager when a more specific setting is not provided. | package.scala:1234 |

### spark.broadcast (4)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.broadcast.blockSize | 4m | 0.5.0 | Size of each piece of a block for TorrentBroadcastFactory, in KiB unless otherwise specified. Too large a value decreases parallelism during broadcast (makes it slower);  | package.scala:2252 |
| spark.broadcast.checksum | true | 2.1.1 | Whether to enable checksum for broadcast. If enabled, broadcasts will include a checksum, which can help detect corrupted blocks, at the cost of computing and sending a l | package.scala:2261 |
| spark.broadcast.compress | true | 0.6.0 | Whether to compress broadcast variables before sending them. Generally a good idea. Compression will use spark.io.compression.codec | package.scala:2246 |
| spark.broadcast.UDFCompressionThreshold | 1L * 1024 * 1024 | 3.0.0 | The threshold at which user-defined functions (UDFs) and Python RDD commands are compressed by broadcast in bytes unless otherwise specified | package.scala:2272 |

### spark.buffer (2)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.buffer.pageSize | (none) | 1.5.0 | The amount of memory used per page in bytes | package.scala:2541 |
| spark.buffer.size | 65536 | 0.5.0 |  | package.scala:2209 |

### spark.checkpoint (2)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.checkpoint.compress | true | 2.2.0 | Whether to compress RDD checkpoints. Generally a good idea. Compression will use spark.io.compression.codec. | package.scala:1399 |
| spark.checkpoint.dir | (none) | 4.0.0 | Set the default directory for checkpointing. It can be overwritten by SparkContext.setCheckpointDir. | package.scala:1390 |

### spark.cleaner (6)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.cleaner.periodicGC.interval | 30min | 1.6.0 |  | package.scala:1981 |
| spark.cleaner.referenceTracking | true | 1.0.0 |  | package.scala:1987 |
| spark.cleaner.referenceTracking.blocking | true | 1.0.0 |  | package.scala:1993 |
| spark.cleaner.referenceTracking.blocking.shuffle | false | 1.1.1 |  | package.scala:1999 |
| spark.cleaner.referenceTracking.blocking.timeout | (fallback to Network.NETWORK_TIMEOUT) | 4.2.0 |  | package.scala:2011 |
| spark.cleaner.referenceTracking.cleanCheckpoints | false | 1.4.0 |  | package.scala:2005 |

### spark.cores (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.cores.max | (none) | 0.6.0 | When running on a standalone deploy cluster, the maximum amount of CPU cores to request for the application from across the cluster (not from each machine). If not set, t | package.scala:457 |

### spark.dead (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.dead.worker.persistence | 15 | 0.8.0 |  | Deploy.scala:76 |

### spark.decommission (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.decommission.enabled | false | 3.1.0 | When decommission enabled, Spark will try its best to shutdown the executor gracefully. Spark will try to migrate all the RDD blocks (controlled by ${STORAGE_DECOMMISSION | package.scala:2495 |

### spark.default (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.default.parallelism | (none) | 0.5.0 | Default number of partitions in RDDs returned by transformations like join, reduceByKey, and parallelize when not set by user. For distributed shuffle operations like red | package.scala:46 |

### spark.deploy (18)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.deploy.appIdPattern | "app-%s-%04d" | 4.0.0 | The pattern for app ID generation based on Java `String.format` method.. The default value is `app-%s-%04d` which represents the existing app id string, e.g., `app-202310 | Deploy.scala:147 |
| spark.deploy.appNumberModulo | (none) | 4.0.0 | The modulo for app number. By default, the next of `app-yyyyMMddHHmmss-9999` is `app-yyyyMMddHHmmss-10000`. If we have 10000 as modulo, it will be `app-yyyyMMddHHmmss-000 | Deploy.scala:128 |
| spark.deploy.defaultCores | Int.MaxValue | 0.9.0 |  | Deploy.scala:115 |
| spark.deploy.driverIdPattern | "driver-%s-%04d" | 4.0.0 | The pattern for driver ID generation based on Java `String.format` method. The default value is `driver-%s-%04d` which represents the existing driver id string , e.g., `d | Deploy.scala:138 |
| spark.deploy.maxDrivers | Int.MaxValue | 4.0.0 | The maximum number of running drivers. | Deploy.scala:121 |
| spark.deploy.maxExecutorRetries | 10 | 1.6.3 |  | Deploy.scala:81 |
| spark.deploy.recoveryCompressionCodec | (none) | 4.0.0 | A compression codec for persistence engines. none (default), lz4, lzf, snappy, and zstd. Currently, only FILESYSTEM mode supports this configuration. | Deploy.scala:29 |
| spark.deploy.recoveryDirectory | "" | 0.8.1 |  | Deploy.scala:41 |
| spark.deploy.recoveryMode | "NONE" | 0.8.1 |  | Deploy.scala:24 |
| spark.deploy.recoveryMode.factory | "" | 1.2.0 |  | Deploy.scala:36 |
| spark.deploy.recoveryTimeout | (none) | 4.0.0 | Configures the timeout for recovery process. The default value is the same with ${Worker.WORKER_TIMEOUT.key}. | Deploy.scala:46 |
| spark.deploy.retainedApplications | 200 | 0.8.0 |  | Deploy.scala:66 |
| spark.deploy.retainedDrivers | 200 | 1.1.0 |  | Deploy.scala:71 |
| spark.deploy.spreadOutApps | true | 0.6.1 |  | Deploy.scala:91 |
| spark.deploy.spreadOutDrivers | true | 4.0.0 |  | Deploy.scala:86 |
| spark.deploy.workerSelectionPolicy | WorkerSelectionPolicy.CORES_FREE_DESC.toString | 4.0.0 | A policy to assign executors on one of the assignable workers; CORES_FREE_ASC to choose a worker with the least free cores, CORES_FREE_DESC to choose a worker with the mo | Deploy.scala:101 |
| spark.deploy.zookeeper.dir | (none) | 0.8.1 |  | Deploy.scala:61 |
| spark.deploy.zookeeper.url | (none) | 0.8.1 | When `${RECOVERY_MODE.key}` is set to ZOOKEEPER, this configuration is used to set the zookeeper URL to connect to. | Deploy.scala:54 |

### spark.diskStore (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.diskStore.subDirectories | 64 | 0.6.0 | Number of subdirectories inside each path listed in spark.local.dir for hashing Block files into. | package.scala:700 |

### spark.driver (24)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.driver.bindAddress | (fallback to DRIVER_HOST_ADDRESS) | 2.1.0 | Address where to bind network listen sockets on the driver. | package.scala:1229 |
| spark.driver.blockManager.port | (fallback to BLOCK_MANAGER_PORT) | 2.1.0 | Port to use for the block manager on the driver. | package.scala:1240 |
| spark.driver.cores | 1 | 1.3.0 | Number of cores to use for the driver process, only in cluster mode. | package.scala:113 |
| spark.driver.extraClassPath | (none) | 1.0.0 |  | package.scala:88 |
| spark.driver.extraJavaOptions | (none) | 1.0.0 |  | package.scala:95 |
| spark.driver.extraLibraryPath | (none) | 1.0.0 |  | package.scala:102 |
| spark.driver.host | Utils.localCanonicalHostName() | 0.7.0 | Address of driver endpoints. | package.scala:1193 |
| spark.driver.limitActiveProcessorCount.enabled | false | 4.2.0 | Whether to add -XX:ActiveProcessorCount=<spark.driver.cores> to the driver JVM options. Currently, this only takes effect in YARN cluster mode. | package.scala:2969 |
| spark.driver.log.allowErasureCoding | false | 3.0.0 |  | package.scala:200 |
| spark.driver.log.dfsDir | (none) | 3.0.0 |  | package.scala:185 |
| spark.driver.log.layout | (none) | 3.0.0 |  | package.scala:188 |
| spark.driver.log.localDir | (none) | 4.0.0 | Specifies a local directory to write driver logs and enable Driver Log UI Tab. | package.scala:178 |
| spark.driver.log.persistToDfs.enabled | false | 3.0.0 |  | package.scala:194 |
| spark.driver.log.redirectConsoleOutputs | Seq("stdout", "stderr") | 4.1.0 | Comma-separated list of the console output kind for driver that needs to redirect to logging system. Supported values are `stdout`, `stderr`. It only takes affect when `$ | package.scala:2943 |
| spark.driver.maxResultSize | 1g | 1.2.0 | Size limit for results. | package.scala:1649 |
| spark.driver.memory | 1g | 1.1.1 | Amount of memory to use for the driver process, in MiB unless otherwise specified. | package.scala:119 |
| spark.driver.memoryOverhead | (none) | 2.3.0 | The amount of non-heap memory to be allocated per driver in cluster mode, in MiB unless otherwise specified. | package.scala:125 |
| spark.driver.memoryOverheadFactor | 0.1 | 3.3.0 | Fraction of driver memory to be allocated as additional non-heap memory per driver process in cluster mode. This is memory that accounts for things like VM overheads, int | package.scala:141 |
| spark.driver.metrics.pollingInterval | (fallback to EXECUTOR_HEARTBEAT_INTERVAL) | 4.1.0 | How often to collect driver metrics (in milliseconds). If unset, the polling is done at the executor heartbeat interval. If set, the polling is done at this interval. | package.scala:1222 |
| spark.driver.minMemoryOverhead | 384m | 4.0.0 | The minimum amount of non-heap memory to be allocated per driver in cluster mode, in MiB unless otherwise specified. This value is ignored if spark.driver.memoryOverhead  | package.scala:132 |
| spark.driver.port | 0 | 0.7.0 | Port of driver endpoints. | package.scala:1199 |
| spark.driver.supervise | false | 1.3.0 | If true, restarts the driver automatically if it fails with a non-zero exit status. Only has effect in Spark standalone mode. | package.scala:1205 |
| spark.driver.timeout | 0min | 4.0.0 | A timeout for Spark driver in minutes. 0 means infinite. For the positive time value, terminate the driver with the exit code 124 if it runs after timeout duration. To us | package.scala:1212 |
| spark.driver.userClassPathFirst | false | 1.3.0 |  | package.scala:108 |

### spark.dynamicAllocation (12)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.dynamicAllocation.cachedExecutorIdleTimeout | Integer.MAX_VALUE | 1.4.0 |  | package.scala:766 |
| spark.dynamicAllocation.enabled | false | 1.2.0 |  | package.scala:731 |
| spark.dynamicAllocation.executorAllocationRatio | 1.0 | 2.4.0 |  | package.scala:760 |
| spark.dynamicAllocation.executorIdleTimeout | 60 | 1.2.0 |  | package.scala:773 |
| spark.dynamicAllocation.initialExecutors | (fallback to DYN_ALLOCATION_MIN_EXECUTORS) | 1.3.0 |  | package.scala:749 |
| spark.dynamicAllocation.maxExecutors | Int.MaxValue | 1.2.0 |  | package.scala:754 |
| spark.dynamicAllocation.minExecutors | 0 | 1.2.0 |  | package.scala:743 |
| spark.dynamicAllocation.schedulerBacklogTimeout | 1 | 1.2.0 |  | package.scala:793 |
| spark.dynamicAllocation.shuffleTracking.enabled | true | 3.0.0 |  | package.scala:780 |
| spark.dynamicAllocation.shuffleTracking.timeout | Long.MaxValue | 3.0.0 |  | package.scala:786 |
| spark.dynamicAllocation.sustainedSchedulerBacklogTimeout | (fallback to DYN_ALLOCATION_SCHEDULER_BACKLOG_TIMEOUT) | 1.2.0 |  | package.scala:798 |
| spark.dynamicAllocation.testing | false | 1.2.0 |  | package.scala:737 |

### spark.eventLog (16)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.eventLog.buffer.kb | 100k | 1.0.0 | Buffer size to use when writing to output streams, in KiB unless otherwise specified. | package.scala:248 |
| spark.eventLog.compress | true | 1.0.0 |  | package.scala:216 |
| spark.eventLog.compression.codec | CompressionCodec.ZSTD | 3.0.0 | The codec used to compress event log. By default, Spark provides four codecs: lz4, lzf, snappy, and zstd. You can also use fully qualified class names to specify the code | package.scala:2200 |
| spark.eventLog.dir | EventLoggingListener.DEFAULT_LOG_DIR | 1.0.0 |  | package.scala:210 |
| spark.eventLog.enabled | false | 1.0.0 |  | package.scala:205 |
| spark.eventLog.erasureCoding.enabled | false | 3.0.0 |  | package.scala:236 |
| spark.eventLog.excludedPatterns | Nil | 4.1.0 | Specifies comma-separated event names to be excluded from the event logs. | package.scala:228 |
| spark.eventLog.gcMetrics.oldGenerationGarbageCollectors | GarbageCollectionMetrics.OLD_GENERATION_BUILTIN_GARBAGE_COLLECTORS | 3.0.0 | Names of supported old generation garbage collector. A name usually is the return of GarbageCollectorMXBean.getName. The built-in old generation garbage collectors are ${ | package.scala:273 |
| spark.eventLog.gcMetrics.youngGenerationGarbageCollectors | GarbageCollectionMetrics.YOUNG_GENERATION_BUILTIN_GARBAGE_COLLECTORS | 3.0.0 | Names of supported young generation garbage collector. A name usually is the return of GarbageCollectorMXBean.getName. The built-in young generation garbage collectors ar | package.scala:263 |
| spark.eventLog.includeTaskMetricsAccumulators | true | 4.0.0 | Whether to include TaskMetrics' underlying accumulator values in the event log (as part of the Task/Stage/Job metrics' 'Accumulables' fields. The TaskMetrics values are a | package.scala:283 |
| spark.eventLog.logBlockUpdates.enabled | false | 2.3.0 |  | package.scala:222 |
| spark.eventLog.logStageExecutorMetrics | false | 3.0.0 | Whether to write per-stage peaks of executor metrics (for each executor) to the event log. | package.scala:255 |
| spark.eventLog.longForm.enabled | false | 2.4.0 |  | package.scala:301 |
| spark.eventLog.overwrite | false | 1.0.0 |  | package.scala:295 |
| spark.eventLog.rolling.enabled | true | 3.0.0 | Whether rolling over event log files is enabled. If set to true, it cuts down each event log file to the configured size. | package.scala:307 |
| spark.eventLog.rolling.maxFileSize | 128m | 3.0.0 | When ${EVENT_LOG_ENABLE_ROLLING.key}=true, specifies the max size of event log file to be rolled over. | package.scala:315 |

### spark.excludeOnFailure (13)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.excludeOnFailure.application.enabled | (none) | 4.0.0 |  | package.scala:977 |
| spark.excludeOnFailure.application.fetchFailure.enabled | false | 3.1.0 |  | package.scala:1051 |
| spark.excludeOnFailure.application.maxFailedExecutorsPerNode | 2 | 3.1.0 |  | package.scala:1013 |
| spark.excludeOnFailure.application.maxFailedTasksPerExecutor | 2 | 3.1.0 |  | package.scala:1001 |
| spark.excludeOnFailure.enabled | (none) | 3.1.0 |  | package.scala:971 |
| spark.excludeOnFailure.killExcludedExecutors | false | 3.1.0 |  | package.scala:1031 |
| spark.excludeOnFailure.killExcludedExecutors.decommission | false | 3.2.0 | Attempt decommission of excluded nodes instead of going directly to kill | package.scala:1037 |
| spark.excludeOnFailure.stage.maxFailedExecutorsPerNode | 2 | 3.1.0 |  | package.scala:1019 |
| spark.excludeOnFailure.stage.maxFailedTasksPerExecutor | 2 | 3.1.0 |  | package.scala:1007 |
| spark.excludeOnFailure.task.maxTaskAttemptsPerExecutor | 1 | 3.1.0 |  | package.scala:989 |
| spark.excludeOnFailure.task.maxTaskAttemptsPerNode | 2 | 3.1.0 |  | package.scala:995 |
| spark.excludeOnFailure.taskAndStage.enabled | (none) | 4.0.0 |  | package.scala:983 |
| spark.excludeOnFailure.timeout | (none) | 3.1.0 |  | package.scala:1025 |

### spark.executor (32)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.executor.allowSparkContext | false | 3.0.1 | If set to true, SparkContext can be created in executors. | package.scala:2568 |
| spark.executor.cores | 1 | 1.0.0 |  | package.scala:413 |
| spark.executor.decommission.forceKillTimeout | (none) | 3.2.0 | Duration after which a Spark will force a decommissioning executor to exit. this should be set to a high value in most situations as low values will prevent block migrati | package.scala:2520 |
| spark.executor.decommission.killInterval | (none) | 3.1.0 | Duration after which a decommissioned executor will be killed forcefully *by an outside* (e.g. non-spark) service. This config is useful for cloud environments where we k | package.scala:2508 |
| spark.executor.decommission.signal | PWR | 3.2.0 | The signal that used to trigger the executor to start decommission. | package.scala:2529 |
| spark.executor.extraClassPath | (none) | 1.0.0 |  | package.scala:335 |
| spark.executor.extraJavaOptions | (none) | 1.0.0 |  | package.scala:395 |
| spark.executor.extraLibraryPath | (none) | 1.0.0 |  | package.scala:402 |
| spark.executor.failuresValidityInterval | (none) | 3.5.0 | Interval after which executor failures will be considered independent and not accumulate towards the attempt count. This configuration only takes effect on YARN and Kuber | package.scala:1065 |
| spark.executor.heartbeatInterval | 10s | 1.1.0 |  | package.scala:349 |
| spark.executor.id | (none) | 1.2.0 |  | package.scala:325 |
| spark.executor.instances | (none) | 1.0.0 |  | package.scala:920 |
| spark.executor.isolatedSessionCache.size | 100 | 4.1.0 | Maximum number of isolated sessions to cache in the executor. Each cached session maintains its own classloader for artifact isolation. | package.scala:362 |
| spark.executor.limitActiveProcessorCount.enabled | false | 4.2.0 | Whether to add -XX:ActiveProcessorCount=<spark.executor.cores> to executor JVM options. Currently, this only takes effect in YARN mode. | package.scala:2977 |
| spark.executor.logs.redirectConsoleOutputs | Seq("stdout", "stderr") | 4.1.0 | Comma-separated list of the console output kind for executor that needs to redirect to logging system. Supported values are `stdout`, `stderr`. It only takes affect when  | package.scala:2956 |
| spark.executor.logs.rolling.enableCompression | false | 2.0.2 |  | package.scala:2040 |
| spark.executor.logs.rolling.maxRetainedFiles | -1 | 1.1.0 |  | package.scala:2034 |
| spark.executor.logs.rolling.maxSize | (1024 * 1024).toString | 1.4.0 |  | package.scala:2028 |
| spark.executor.logs.rolling.strategy | "" | 1.1.0 |  | package.scala:2016 |
| spark.executor.logs.rolling.time.interval | "daily" | 1.1.0 |  | package.scala:2022 |
| spark.executor.maxNumFailures | (none) | 3.5.0 | The maximum number of executor failures before failing the application. This configuration only takes effect on YARN and Kubernetes. | package.scala:1057 |
| spark.executor.memory | 1g | 0.7.0 | Amount of memory to use per executor process, in MiB unless otherwise specified, and with minimum value 450m | package.scala:418 |
| spark.executor.memoryOverhead | (none) | 2.3.0 | The amount of non-heap memory to be allocated per executor, in MiB unless otherwise specified. | package.scala:425 |
| spark.executor.memoryOverheadFactor | 0.1 | 3.3.0 | Fraction of executor memory to be allocated as additional non-heap memory per executor process. This is memory that accounts for things like VM overheads, interned string | package.scala:442 |
| spark.executor.metrics.fileSystemSchemes | file,hdfs | 3.1.0 | The file system schemes to report in executor metrics. | package.scala:388 |
| spark.executor.metrics.pollingInterval | 0 | 3.0.0 | How often to collect executor metrics (in milliseconds). If 0, the polling is done on executor heartbeats. If positive, the polling is done at this interval. | package.scala:379 |
| spark.executor.minMemoryOverhead | 384m | 4.0.0 | The minimum amount of non-heap memory to be allocated per executor in MiB unless otherwise specified. This value is ignored if spark.executor.memoryOverhead is set direct | package.scala:433 |
| spark.executor.processTreeMetrics.enabled | false | 3.0.0 | Whether to collect process tree metrics (from the /proc filesystem) when collecting executor metrics. | package.scala:371 |
| spark.executor.pyspark.memory | (none) | 2.4.0 |  | Python.scala:54 |
| spark.executor.python.worker.log.details | false | 3.5.0 |  | Python.scala:39 |
| spark.executor.syncLogLevel.enabled | false | 4.0.0 | If set to true, log level applied through SparkContext.setLogLevel() method will be propagated to all executors. | package.scala:2575 |
| spark.executor.userClassPathFirst | false | 1.3.0 |  | package.scala:408 |

### spark.extraListeners (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.extraListeners | (none) | 1.3.0 | Class names of listeners to add to SparkContext during initialization. | package.scala:1608 |

### spark.file (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.file.transferTo | true | 1.4.0 | If true, NIO's `transferTo` API will be preferentially used when merging Spark shuffle spill files | package.scala:1743 |

### spark.files (6)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.files | Nil | 1.0.0 |  | package.scala:2331 |
| spark.files.fetchFailure.unRegisterOutputOnHost | false | 2.3.0 | Whether to un-register all the outputs on the host in condition that we receive a FetchFailure. This is set default to false, which means, we only un-register the outputs | package.scala:1074 |
| spark.files.ignoreCorruptFiles | false | 2.1.0 | Whether to ignore corrupt files. If true, the Spark jobs will continue to run when encountering corrupted or non-existing files and contents that have been read will stil | package.scala:1245 |
| spark.files.ignoreMissingFiles | false | 2.4.0 | Whether to ignore missing files. If true, the Spark jobs will continue to run when encountering missing files and the contents that have been read will still be returned. | package.scala:1253 |
| spark.files.maxPartitionBytes | 128 * 1024 * 1024 | 2.1.0 | The maximum number of bytes to pack into a single partition when reading files. | package.scala:1278 |
| spark.files.openCostInBytes | 4 * 1024 * 1024 | 2.1.0 | The estimated cost to open a file, measured by the number of bytes could be scanned in the same time. This is used when putting multiple files into a partition. It's bett | package.scala:1284 |

### spark.history (38)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.history.custom.executor.log.url | (none) | 3.0.0 | Specifies custom spark executor log url for supporting external log service instead of using cluster managers' application log urls in the history server. Spark will supp | History.scala:299 |
| spark.history.custom.executor.log.url.applyIncompleteApplication | true | 3.0.0 | Whether to apply custom executor log url, as specified by ${CUSTOM_EXECUTOR_LOG_URL.key}, to incomplete application as well. Even if this is true, this still only affects | History.scala:310 |
| spark.history.fs.cleaner.enabled | false | 1.4.0 | Whether the History Server should periodically clean up event logs from storage | History.scala:83 |
| spark.history.fs.cleaner.interval | 1d | 1.4.0 | When spark.history.fs.cleaner.enabled=true, specifies how often the filesystem job history cleaner checks for files to delete. | History.scala:89 |
| spark.history.fs.cleaner.maxAge | 7d | 1.4.0 | When spark.history.fs.cleaner.enabled=true, history files older than this will be deleted when the filesystem history cleaner runs. | History.scala:96 |
| spark.history.fs.cleaner.maxNum | Int.MaxValue | 3.0.0 | The maximum number of log files in the event log directory. | History.scala:103 |
| spark.history.fs.driverlog.cleaner.enabled | (fallback to CLEANER_ENABLED) | 3.0.0 | Specifies whether the History Server should periodically clean up driver logs from storage. | History.scala:195 |
| spark.history.fs.driverlog.cleaner.interval | (fallback to CLEANER_INTERVAL_S) | 3.0.0 | When ${DRIVER_LOG_CLEANER_ENABLED.key}=true, specifies how often the filesystem driver log cleaner checks for files to delete. Files are only deleted if they are older th | History.scala:207 |
| spark.history.fs.driverlog.cleaner.maxAge | (fallback to MAX_LOG_AGE_S) | 3.0.0 | When ${DRIVER_LOG_CLEANER_ENABLED.key}=true, driver log files older than this will be deleted when the driver log cleaner runs. | History.scala:201 |
| spark.history.fs.endEventReparseChunkSize | 1m | 2.4.0 | How many bytes to parse at the end of log files looking for the end event. This is used to speed up generation of application listings by skipping unnecessary parts of ev | History.scala:159 |
| spark.history.fs.eventLog.rolling.maxFilesToRetain | Integer.MAX_VALUE | 3.0.0 | The maximum number of event log files which will be retained as non-compacted. By default, all event log files will be retained. Please set the configuration and ${EVENT_ | History.scala:168 |
| spark.history.fs.eventLog.rolling.onDemandLoadEnabled | true | 4.1.0 | Whether to look up rolling event log locations on demand manner before listing files. | History.scala:189 |
| spark.history.fs.inProgressOptimization.enabled | true | 2.4.0 | Enable optimized handling of in-progress logs. This option may leave finished applications that fail to rename their event logs listed as in-progress. | History.scala:151 |
| spark.history.fs.logDirectory | DEFAULT_LOG_DIR | 1.1.0 | Directory where app logs are stored. Multiple directories can be specified as a comma-separated list to monitor event logs from multiple paths. | History.scala:29 |
| spark.history.fs.logDirectory.names | (none) | 4.2.0 | Optional comma-separated list of display names for the log directories specified in spark.history.fs.logDirectory. Names correspond to directories by position. If not set | History.scala:38 |
| spark.history.fs.numCompactThreads | (computed) | 4.1.0 | Number of threads that will be used by history server to compact event logs. | History.scala:257 |
| spark.history.fs.numReplayThreads | (computed) | 2.0.0 | Number of threads that will be used by history server to process event logs. | History.scala:251 |
| spark.history.fs.safemodeCheck.interval | 5s | 1.6.0 | Interval between HDFS safemode checks for the event log directory | History.scala:46 |
| spark.history.fs.update.batchSize | Int.MaxValue | 3.4.0 | Specifies the batch size for updating new eventlog files. This controls each scan process to be completed within a reasonable time, and such prevent the initial scan from | History.scala:58 |
| spark.history.fs.update.interval | 10s | 1.4.0 | How often(in seconds) to reload log data from storage | History.scala:52 |
| spark.history.fs.update.scanDisabledPathPatterns | Nil | 4.2.0 | Comma-separated list of regular expressions matched against log directory paths. Directories whose full path matches any pattern will not be scanned periodically. Applica | History.scala:69 |
| spark.history.kerberos.enabled | false | 1.0.1 | Indicates whether the history server should use kerberos to login. This is required if the history server is accessing HDFS files on a secure Hadoop cluster. | History.scala:278 |
| spark.history.kerberos.keytab | (none) | 1.0.1 | When ${KERBEROS_ENABLED.key}=true, specifies location of the kerberos keytab file for the History Server. | History.scala:292 |
| spark.history.kerberos.principal | (none) | 1.0.1 | When ${KERBEROS_ENABLED.key}=true, specifies kerberos principal name for the History Server. | History.scala:285 |
| spark.history.provider | "org.apache.spark.deploy.history.FsHistoryProvider" | 1.1.0 | Name of the class implementing the application history backend. | History.scala:272 |
| spark.history.retainedApplications | 50 | 1.0.0 | The number of applications to retain UI data for in the cache. If this cap is exceeded, then the oldest applications will be removed from the cache. If an application is  | History.scala:263 |
| spark.history.store.hybridStore.diskBackend | HybridStoreDiskBackend.ROCKSDB.toString | 3.3.0 | Specifies a disk-based store used in hybrid store; ROCKSDB or LEVELDB (deprecated). | History.scala:339 |
| spark.history.store.hybridStore.enabled | false | 3.1.0 | Whether to use HybridStore as the store when parsing event logs. HybridStore will first write data to an in-memory store and having a background thread that dumps data to | History.scala:319 |
| spark.history.store.hybridStore.maxMemoryUsage | 2g | 3.1.0 | Maximum memory space that can be used to create HybridStore. The HybridStore co-uses the heap memory, so the heap memory should be increased through the memory option for | History.scala:327 |
| spark.history.store.maxDiskUsage | 10g | 2.3.0 | Maximum disk usage for the local directory where the cache application history information are stored. | History.scala:131 |
| spark.history.store.path | (none) | 2.3.0 | Local directory where to cache application history information. By default this is not set, meaning all history information will be kept in memory. | History.scala:109 |
| spark.history.store.serializer | LocalStoreSerializer.JSON.toString | 3.4.0 | Serializer for writing/reading in-memory UI objects to/from disk-based KV Store; JSON or PROTOBUF. JSON serializer is the only choice before Spark 3.4.0, thus it is the d | History.scala:120 |
| spark.history.ui.acls.enable | false | 1.0.1 | Specifies whether ACLs should be checked to authorize users viewing the applications in the history server. If enabled, access control checks are performed regardless of  | History.scala:214 |
| spark.history.ui.admin.acls | Nil | 2.1.1 | Comma separated list of users that have view access to all the Spark applications in history server. | History.scala:227 |
| spark.history.ui.admin.acls.groups | Nil | 2.1.1 | Comma separated list of groups that have view access to all the Spark applications in history server. | History.scala:235 |
| spark.history.ui.maxApplications | Integer.MAX_VALUE | 2.0.1 | The number of applications to display on the history summary page. Application UIs are still available by accessing their URLs directly even if they are not displayed on  | History.scala:243 |
| spark.history.ui.port | 18080 | 1.0.0 | Web UI port to bind Spark History Server | History.scala:144 |
| spark.history.ui.title | "History Server" | 4.0.0 | Specifies the title of the History Server UI page. | History.scala:138 |

### spark.io (12)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.io.compression.codec |  | 0.8.0 | The codec used to compress internal data such as RDD partitions, event log, broadcast variables and shuffle outputs. By default, Spark provides four codecs: lz4, lzf, sna | package.scala:2129 |
| spark.io.compression.lz4.blockSize | 32k | 1.4.0 | Block size in bytes used in LZ4 compression, in the case when LZ4 compressioncodec is used. Lowering this block size will also lower shuffle memory usage when LZ4 is used | package.scala:2120 |
| spark.io.compression.lzf.parallel.enabled | true | 4.0.0 | When true, LZF compression will use multiple threads to compress data in parallel. | package.scala:2184 |
| spark.io.compression.snappy.blockSize | 32k | 1.4.0 | Block size in bytes used in Snappy compression, in the case when Snappy compression codec is used. Lowering this block size will also lower shuffle memory usage when Snap | package.scala:2111 |
| spark.io.compression.zstd.bufferPool.enabled | true | 3.2.0 | If true, enable buffer pool of ZSTD JNI library. | package.scala:2149 |
| spark.io.compression.zstd.bufferSize | 32k | 2.3.0 | Buffer size in bytes used in Zstd compression, in the case when Zstd compression codec is used. Lowering this size will lower the shuffle memory usage when Zstd is used,  | package.scala:2139 |
| spark.io.compression.zstd.level | 1 | 2.3.0 | Compression level for Zstd compression codec. Increasing the compression level will result in better compression at the expense of more CPU and memory | package.scala:2167 |
| spark.io.compression.zstd.strategy | (none) | 4.1.0 | Compression strategy for Zstd compression codec. The higher the value is, the more complex it becomes, usually resulting stronger but slower compression or higher CPU cos | package.scala:2175 |
| spark.io.compression.zstd.workers | 0 | 4.0.0 | Thread size spawned to compress in parallel when using Zstd. When the value is 0, no worker is spawned, it works in single-threaded mode. When value > 0, it triggers asyn | package.scala:2156 |
| spark.io.encryption.enabled | false | 2.1.0 |  | package.scala:1169 |
| spark.io.encryption.keygen.algorithm | "HmacSHA1" | 2.1.0 |  | package.scala:1175 |
| spark.io.encryption.keySizeBits | 128 | 2.1.0 |  | package.scala:1180 |

### spark.jars (6)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.jars | Nil | 0.9.0 |  | package.scala:2325 |
| spark.jars.excludes | Nil | 1.5.0 | Comma-separated list of groupId:artifactId, to exclude while resolving the dependencies provided in spark.jars.packages to avoid dependency conflicts. | package.scala:2803 |
| spark.jars.ivy | "~/.ivy2.5.2" | 1.3.0 | Path to specify the Ivy user directory, used for the local Ivy cache and package files from spark.jars.packages. This will override the Ivy property ivy.default.ivy.user. | package.scala:2766 |
| spark.jars.ivySettings | (none) | 2.2.0 | Path to an Ivy settings file to customize resolution of jars specified using spark.jars.packages instead of the built-in defaults, such as maven central. Additional repos | package.scala:2776 |
| spark.jars.packages | Nil | 1.5.0 | Comma-separated list of Maven coordinates of jars to include on the driver and executor classpaths. The coordinates should be groupId:artifactId:version. If spark.jars.iv | package.scala:2789 |
| spark.jars.repositories | Nil | 2.3.0 | Comma-separated list of additional remote repositories to search for the maven coordinates given with --packages or spark.jars.packages. | package.scala:2813 |

### spark.kerberos (5)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.kerberos.access.hadoopFileSystems | Nil | 3.0.0 | Extra Hadoop filesystem URLs for which to request delegation tokens. The filesystem that hosts fs.defaultFS does not need to be listed here. | package.scala:900 |
| spark.kerberos.keytab | (none) | 3.0.0 | Location of user's keytab. | package.scala:872 |
| spark.kerberos.principal | (none) | 3.0.0 | Name of the Kerberos principal. | package.scala:877 |
| spark.kerberos.relogin.period | 1m | 3.0.0 |  | package.scala:883 |
| spark.kerberos.renewal.credentials | "keytab" | 3.0.0 | Which credentials to use when renewing delegation tokens for executors. Can be either 'keytab', the default, which requires a keytab to be provided, or 'ccache', which us | package.scala:889 |

### spark.kryo (6)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.kryo.classesToRegister | Nil | 1.2.0 |  | Kryo.scala:35 |
| spark.kryo.pool | true | 3.0.0 |  | Kryo.scala:46 |
| spark.kryo.referenceTracking | true | 0.8.0 |  | Kryo.scala:51 |
| spark.kryo.registrationRequired | false | 1.1.0 |  | Kryo.scala:24 |
| spark.kryo.registrator | Nil | 0.5.0 |  | Kryo.scala:29 |
| spark.kryo.unsafe | true | 2.1.0 |  | Kryo.scala:41 |

### spark.kryoserializer (2)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.kryoserializer.buffer | 64k | 1.4.0 |  | Kryo.scala:56 |
| spark.kryoserializer.buffer.max | 64m | 1.4.0 |  | Kryo.scala:61 |

### spark.kubernetes (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.kubernetes.jars.avoidDownloadSchemes | Nil | 4.0.0 | Comma-separated list of schemes for which jars will NOT be downloaded to the driver local disk prior to be distributed to executors, only for kubernetes deployment. For u | package.scala:1585 |

### spark.locality (4)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.locality.wait | 3s | 0.5.0 |  | package.scala:812 |
| spark.locality.wait.node | (fallback to LOCALITY_WAIT) | 0.8.0 |  | package.scala:2219 |
| spark.locality.wait.process | (fallback to LOCALITY_WAIT) | 0.8.0 |  | package.scala:2215 |
| spark.locality.wait.rack | (fallback to LOCALITY_WAIT) | 0.8.0 |  | package.scala:2223 |

### spark.log (4)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.log.callerContext | (none) | 2.2.0 |  | package.scala:1260 |
| spark.log.legacyTaskNameMdc.enabled | false | 4.0.0 | When true, the MDC (Mapped Diagnostic Context) key `mdc.taskName` will be set in the log output, which is the behavior of Spark version 3.1 through Spark 3.5 releases. Wh | package.scala:168 |
| spark.log.level | (none) | 3.5.0 | When set, overrides any user-defined log settings as if calling SparkContext.setLogLevel() at Spark startup. Valid log levels include: , | package.scala:1265 |
| spark.log.structuredLogging.enabled | false | 4.0.0 | When true, Spark logs are output as structured JSON lines with added Spark Mapped Diagnostic Context (MDC), facilitating easier integration with log aggregation and analy | package.scala:157 |

### spark.master (10)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.master.rest.enabled | true | 1.3.0 |  | package.scala:2045 |
| spark.master.rest.filters | Nil | 4.0.0 | Comma separated list of filter class names to apply to the Spark Master REST API. | package.scala:2067 |
| spark.master.rest.host | (none) | 4.0.0 | Specifies the host of the Master REST API endpoint | package.scala:2050 |
| spark.master.rest.maxThreads | 200 | 4.0.0 | Maximum number of threads to use in the Spark Master REST API Server. | package.scala:2061 |
| spark.master.rest.port | 6066 | 1.3.0 |  | package.scala:2056 |
| spark.master.rest.virtualThread.enabled | true | 4.0.0 | If true, Spark master tries to use Java 21 virtual thread for REST API. | package.scala:2075 |
| spark.master.ui.historyServerUrl | (none) | 4.0.0 | The URL where Spark history server is running. Please note that this assumes that all Spark jobs share the same event log location where the history server accesses. | package.scala:2087 |
| spark.master.ui.port | 8080 | 1.1.0 |  | package.scala:2081 |
| spark.master.ui.title | (none) | 4.0.0 | Specifies the title of the Master UI page. If unset, `Spark Master at <MasterURL>` is used by default. | UI.scala:267 |
| spark.master.ui.visibleEnvVarPrefixes | Seq.empty[String] | 4.0.0 | Comma-separated list of key-prefix strings to show environment variables | UI.scala:274 |

### spark.memory (5)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.memory.fraction | 0.6 | 1.6.0 | Fraction of (heap space - 300MB) used for execution and storage. The lower this is, the more frequently spills and cached data eviction occur. The purpose of this config  | package.scala:495 |
| spark.memory.offHeap.enabled | false | 1.6.0 | If true, Spark will attempt to use off-heap memory for certain operations. If off-heap memory use is enabled, then spark.memory.offHeap.size must be positive. | package.scala:466 |
| spark.memory.offHeap.size | 0 | 1.6.0 | The absolute amount of memory which can be used for off-heap allocation, in bytes unless otherwise specified. This setting has no impact on heap memory usage, so if your  | package.scala:474 |
| spark.memory.storageFraction | 0.5 | 1.6.0 | Amount of storage memory immune to eviction, expressed as a fraction of the size of the region set aside by spark.memory.fraction. The higher this is, the less working me | package.scala:485 |
| spark.memory.unmanagedMemoryPollingInterval | 0s | 4.1.0 | Interval for polling unmanaged memory users to track their memory usage. Unmanaged memory users are components that manage their own memory outside of Spark's core memory | package.scala:506 |

### spark.metrics (5)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.metrics.appStatusSource.enabled | true | 3.0.0 | Whether Dropwizard/Codahale metrics will be reported for the status of the running spark app. | Status.scala:67 |
| spark.metrics.conf | (none) | 0.8.0 |  | package.scala:1140 |
| spark.metrics.executorMetricsSource.enabled | true | 3.0.0 | Whether to register the ExecutorMetrics source with the metrics system. | package.scala:1146 |
| spark.metrics.namespace | (none) | 2.1.0 |  | package.scala:1135 |
| spark.metrics.staticSources.enabled | true | 3.0.0 | Whether to register static sources with the metrics system. | package.scala:1153 |

### spark.modify (2)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.modify.acls | Nil | 1.1.0 |  | UI.scala:220 |
| spark.modify.acls.groups | Nil | 2.0.0 |  | UI.scala:226 |

### spark.network (6)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.network.crypto.enabled | false | 2.2.0 |  | Network.scala:31 |
| spark.network.crypto.saslFallback | true | 2.2.0 |  | Network.scala:25 |
| spark.network.maxRemoteBlockSizeFetchToMem | 200m | 3.0.0 | Remote block will be fetched to disk when size of the block is above this threshold in bytes. This is to avoid a giant request takes too much memory. Note this configurat | package.scala:1487 |
| spark.network.remoteReadNioBufferConversion | false | 2.4.0 |  | Network.scala:37 |
| spark.network.timeout | 120s | 1.3.0 |  | Network.scala:43 |
| spark.network.timeoutInterval |  | 1.3.2 |  | Network.scala:49 |

### spark.plugins (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.plugins | Nil | 3.0.0 | Comma-separated list of class names implementing org.apache.spark.api.plugin.SparkPlugin to load into the application. | package.scala:1971 |

### spark.pyspark (2)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.pyspark.driver.python | (none) | 2.1.0 |  | package.scala:1159 |
| spark.pyspark.python | (none) | 2.1.0 |  | package.scala:1164 |

### spark.python (12)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.python.daemon.killWorkerOnFlushFailure | true | 4.1.0 | When enabled, exceptions raised during output flush operations in the Python worker managed under Python daemon are not caught, causing the worker to terminate with the e | Python.scala:143 |
| spark.python.daemon.module | (none) | 2.4.0 |  | Python.scala:44 |
| spark.python.factory.idleWorkerMaxPoolSize | (none) | 4.1.0 | Maximum number of idle Python workers to keep. If unset, the number is unbounded. If set to a positive integer N, at most N idle workers are retained; least-recently used | Python.scala:132 |
| spark.python.task.killTimeout | 2s | 2.2.2 |  | Python.scala:29 |
| spark.python.unix.domain.socket.enabled | sys.env.get("PYSPARK_UDS_MODE").contains("true") | 4.1.0 | When set to true, the Python driver uses a Unix domain socket for operations like creating or collecting a DataFrame from local data, using accumulators, and executing Py | Python.scala:73 |
| spark.python.use.daemon | true | 2.3.0 |  | Python.scala:34 |
| spark.python.worker.faulthandler.enabled | false | 3.2.0 | When true, Python workers set up the faulthandler for the case when the Python worker exits unexpectedly (crashes), and shows the stack trace of the moment the Python wor | Python.scala:65 |
| spark.python.worker.idleTimeoutSeconds | 0 | 4.0.0 | The time (in seconds) Spark will wait for activity (e.g., data transfer or communication) from a Python worker before considering it potentially idle or unresponsive. Whe | Python.scala:100 |
| spark.python.worker.killOnIdleTimeout | false | 4.1.0 | Whether Spark should terminate the Python worker process when the idle timeout (as defined by $PYTHON_WORKER_IDLE_TIMEOUT_SECONDS_KEY) is reached. If enabled, Spark will  | Python.scala:113 |
| spark.python.worker.module | (none) | 2.4.0 |  | Python.scala:49 |
| spark.python.worker.reuse | true | 1.2.0 |  | Python.scala:24 |
| spark.python.worker.tracebackDumpIntervalSeconds | 0 | 4.1.0 | The interval (in seconds) for Python workers to dump their tracebacks. If it's positive, the Python worker will periodically dump the traceback into its `stderr`. The def | Python.scala:122 |

### spark.r (4)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.r.backendConnectionTimeout | 6000 | 2.1.0 |  | R.scala:21 |
| spark.r.command | (none) | 1.5.3 |  | R.scala:41 |
| spark.r.heartBeatInterval | 100 | 2.1.0 |  | R.scala:31 |
| spark.r.numRBackendThreads | 2 | 1.4.0 |  | R.scala:26 |

### spark.rdd (4)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.rdd.compress | false | 0.6.0 | Whether to compress serialized RDD partitions (e.g. for StorageLevel.MEMORY_ONLY_SER in Scala or StorageLevel.MEMORY_ONLY in Python). Can save substantial space at the co | package.scala:2280 |
| spark.rdd.limit.initialNumPartitions | 1 | 3.4.0 |  | package.scala:2297 |
| spark.rdd.limit.scaleUpFactor | 4 | 2.1.0 |  | package.scala:2304 |
| spark.rdd.parallelListingThreshold | 10 | 2.0.0 |  | package.scala:2291 |

### spark.redaction (2)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.redaction.regex | "(?i)secret/password/token/access[.]?key".r | 2.1.2 | Regex to decide which Spark configuration properties and environment variables in driver and executor environments contain sensitive information. When this regex matches  | package.scala:1302 |
| spark.redaction.string.regex | (none) | 2.2.0 | Regex to decide which parts of strings produced by Spark contain sensitive information. When this regex matches a string part, that string part is replaced by a dummy val | package.scala:1312 |

### spark.reducer (3)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.reducer.maxBlocksInFlightPerAddress | Int.MaxValue | 2.2.1 | This configuration limits the number of remote blocks being fetched per reduce task from a given host port. When a large number of blocks are being requested from a given | package.scala:1475 |
| spark.reducer.maxReqsInFlight | Int.MaxValue | 2.0.0 | This configuration limits the number of remote requests to fetch blocks at any given point. When the number of hosts in the cluster increase, it might lead to very large  | package.scala:2236 |
| spark.reducer.maxSizeInFlight | 48m | 1.4.0 | Maximum size of map outputs to fetch simultaneously from each reduce task, in MiB unless otherwise specified. Since each output requires us to create a buffer to receive  | package.scala:2227 |

### spark.resources (2)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.resources.discoveryPlugin | Nil | 3.0.0 | Comma-separated list of class names implementingorg.apache.spark.api.resource.ResourceDiscoveryPlugin to load into the application.This is for advanced users to replace t | package.scala:58 |
| spark.resources.warnings.testing | false | 3.1.0 |  | Tests.scala:74 |

### spark.rpc (7)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.rpc.askTimeout | (none) | 1.4.0 |  | Network.scala:55 |
| spark.rpc.connect.threads | 64 | 1.6.0 |  | Network.scala:61 |
| spark.rpc.io.numConnectionsPerPeer | 1 | 1.6.0 |  | Network.scala:67 |
| spark.rpc.io.threads | (none) | 1.6.0 |  | Network.scala:73 |
| spark.rpc.lookupTimeout | (none) | 1.4.0 |  | Network.scala:79 |
| spark.rpc.message.maxSize | 128 | 2.0.0 |  | Network.scala:85 |
| spark.rpc.netty.dispatcher.numThreads | (none) | 1.6.0 |  | Network.scala:91 |

### spark.scheduler (14)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.scheduler.allocation.file | (none) | 0.8.1 |  | package.scala:2368 |
| spark.scheduler.barrier.maxConcurrentTasksCheck.interval | 15s | 2.4.0 | Time in seconds to wait between a max concurrent tasks check failure and the next check. A max concurrent tasks check ensures the cluster can launch more concurrent tasks | package.scala:1891 |
| spark.scheduler.barrier.maxConcurrentTasksCheck.maxFailures | 40 | 2.4.0 | Number of max concurrent tasks check failures allowed before fail a job submission. A max concurrent tasks check ensures the cluster can launch more concurrent tasks than | package.scala:1905 |
| spark.scheduler.excludeOnFailure.unschedulableTaskSetTimeout | 120 | 3.1.0 | The timeout in seconds to wait to acquire a new executor and schedule a task before aborting a TaskSet which is unschedulable because all executors are excluded due to fa | package.scala:1881 |
| spark.scheduler.listenerbus.eventqueue.capacity | 10000 | 2.3.0 | The default capacity for event queues. Spark will try to initialize an event queue using capacity specified by `spark.scheduler.listenerbus.eventqueue.queueName.capacity` | package.scala:1083 |
| spark.scheduler.listenerbus.exitTimeout | 0 | 4.0.0 | The time that event queue waits until the dispatch thread exits when stop is invoked. This is set to 0 by default for graceful shutdown of the event queue, but allow the  | package.scala:1124 |
| spark.scheduler.maxRegisteredResourcesWaitingTime | 30s | 1.1.1 |  | package.scala:2380 |
| spark.scheduler.minRegisteredResourcesRatio | (none) | 1.1.1 |  | package.scala:2374 |
| spark.scheduler.mode | SchedulingMode.FIFO | 0.8.0 |  | package.scala:2386 |
| spark.scheduler.numCancelledJobGroupsToTrack | 1000 | 4.0.0 | The maximum number of tracked job groups that are cancelled with `cancelJobGroupAndFutureJobs`. If this maximum number is hit, the oldest job group will no longer be trac | package.scala:1920 |
| spark.scheduler.resource.profileMergeConflicts | false | 3.1.0 | If set to true, Spark will merge ResourceProfiles when different profiles are specified in RDDs that get combined into a single stage. When they are merged, Spark chooses | package.scala:2548 |
| spark.scheduler.revive.interval | (none) | 0.8.1 |  | package.scala:2408 |
| spark.scheduler.streaming.idAwareLogging.enabled | true | 4.2.0 | When true, scheduler log messages for streaming tasks include the structured streaming query ID and batch ID. | package.scala:2392 |
| spark.scheduler.streaming.idAwareLogging.queryIdLength | 5 | 4.2.0 | Maximum number of characters of the streaming query ID to include in scheduler log messages. Set to -1 to include the full query ID. | package.scala:2400 |

### spark.security (2)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.security.credentials.renewalRatio | 0.75d | 2.4.0 | Ratio of the credential's expiration time when Spark should fetch new credentials. | package.scala:1656 |
| spark.security.credentials.retryWait | 1h | 2.4.0 | How long to wait before retrying to fetch new credentials after a failure. | package.scala:1663 |

### spark.serializer (3)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.serializer | "org.apache.spark.serializer.JavaSerializer" | 0.5.0 |  | package.scala:2309 |
| spark.serializer.extraDebugInfo | true | 1.3.0 |  | package.scala:2320 |
| spark.serializer.objectStreamReset | 100 | 1.0.0 |  | package.scala:2315 |

### spark.shuffle (42)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.shuffle.accurateBlockSkewedFactor | -1.0 | 3.3.0 | A shuffle block is considered as skewed and will be accurately recorded in HighlyCompressedMapStatus if its size is larger than this factor multiplying the median shuffle | package.scala:1428 |
| spark.shuffle.accurateBlockThreshold | 100 * 1024 * 1024 | 2.2.1 | Threshold in bytes above which the size of shuffle blocks in HighlyCompressedMapStatus is accurately recorded. This helps to prevent OOM by avoiding underestimating shuff | package.scala:1419 |
| spark.shuffle.checksum.algorithm | "ADLER32" | 3.2.0 | The algorithm is used to calculate the shuffle checksum. Currently, it only supports built-in algorithms of JDK. | package.scala:1690 |
| spark.shuffle.checksum.enabled | true | 3.2.0 | Whether to calculate the checksum of shuffle data. If enabled, Spark will calculate the checksum values for each partition data within the map output file and store the v | package.scala:1679 |
| spark.shuffle.compress | true | 0.6.0 | Whether to compress shuffle output. Compression will use spark.io.compression.codec. | package.scala:1700 |
| spark.shuffle.detectCorrupt | true | 2.2.0 | Whether to detect any corruption in fetched blocks. | package.scala:1785 |
| spark.shuffle.detectCorrupt.useExtraMemory | false | 3.0.0 | If enabled, part of a compressed/encrypted stream will be de-compressed/de-crypted by using extra memory to detect early corruption. Any IOException thrown will cause the | package.scala:1792 |
| spark.shuffle.file.buffer | 32k | 1.4.0 | Size of the in-memory buffer for each shuffle file output stream, in KiB unless otherwise specified. These buffers reduce the number of disk seeks and system calls made i | package.scala:1521 |
| spark.shuffle.file.merge.buffer | (fallback to SHUFFLE_FILE_BUFFER_SIZE) | 4.0.0 | Size of the in-memory buffer for each shuffle file input stream, in KiB unless otherwise specified. These buffers use off-heap buffers and are related to the number of fi | package.scala:1533 |
| spark.shuffle.localDisk.file.output.buffer | (fallback to SHUFFLE_UNSAFE_FILE_OUTPUT_BUFFER_SIZE) | 4.0.0 | The file system for this buffer size after each partition is written in all local disk shuffle writers. In KiB unless otherwise specified. | package.scala:1551 |
| spark.shuffle.manager | "sort" | 1.1.0 |  | package.scala:1759 |
| spark.shuffle.mapOutput.dispatcher.numThreads | 8 | 2.0.0 |  | package.scala:1779 |
| spark.shuffle.mapOutput.minSizeForBroadcast | 512k | 2.0.0 | The size at which we use Broadcast to send the map output statuses to the executors. | package.scala:1772 |
| spark.shuffle.push.enabled | false | 3.2.0 | Set to true to enable push-based shuffle on the client side and this works in conjunction with the server side flag spark.shuffle.push.server.mergedShuffleFileManagerImpl | package.scala:2630 |
| spark.shuffle.push.finalize.timeout | 10s | 3.2.0 | The amount of time driver waits, after all mappers have finished for a given shuffle map stage, before it sends merge finalize requests to remote external shuffle service | package.scala:2653 |
| spark.shuffle.push.maxBlockBatchSize | 3m | 3.2.0 | The max size of a batch of shuffle blocks to be grouped into a single push request. | package.scala:2717 |
| spark.shuffle.push.maxBlockSizeToPush | 1m | 3.2.0 | The max size of an individual block to push to the remote external shuffle services. Blocks larger than this threshold are not pushed to be merged remotely. These shuffle | package.scala:2708 |
| spark.shuffle.push.maxRetainedMergerLocations | 500 | 3.2.0 | Maximum number of merger locations cached for push-based shuffle. Currently, merger locations are hosts of external shuffle services responsible for handling pushed block | package.scala:2664 |
| spark.shuffle.push.merge.finalizeThreads | 8 | 3.3.0 | Number of threads used by driver to finalize shuffle merge. Since it could potentially take seconds for a large shuffle to finalize, having multiple threads helps driver  | package.scala:2728 |
| spark.shuffle.push.mergersMinStaticThreshold | 5 | 3.2.0 | The static threshold for number of shuffle push merger locations should be available in order to enable push-based shuffle for a stage. Note this config works in conjunct | package.scala:2684 |
| spark.shuffle.push.mergersMinThresholdRatio | 0.05 | 3.2.0 | Ratio used to compute the minimum number of shuffle merger locations required for a stage based on the number of partitions for the reducer stage. For example, a reduce s | package.scala:2673 |
| spark.shuffle.push.minCompletedPushRatio | 1.0 | 3.3.0 | Fraction of map partitions that should be push complete before driver starts shuffle merge finalization during push based shuffle | package.scala:2758 |
| spark.shuffle.push.minShuffleSizeToWait | 500m | 3.3.0 | Driver will wait for merge finalization to complete only if total shuffle size is more than this threshold. If total shuffle size is less, driver will immediately finaliz | package.scala:2749 |
| spark.shuffle.push.numPushThreads | (none) | 3.2.0 | Specify the number of threads in the block pusher pool. These threads assist in creating connections and pushing blocks to remote external shuffle services. By default, t | package.scala:2699 |
| spark.shuffle.readHostLocalDisk | true | 3.0.0 | If enabled (and `${SHUFFLE_USE_OLD_FETCH_PROTOCOL.key}` is disabled, shuffle blocks requested from those block managers which are running on the same host are read from t | package.scala:1842 |
| spark.shuffle.reduceLocality.enabled | true | 1.5.0 | Whether to compute locality preferences for reduce tasks | package.scala:1765 |
| spark.shuffle.registration.maxAttempts | 3 | 2.3.0 | When we fail to register to the external shuffle service, we will retry for maxAttempts times. | package.scala:1458 |
| spark.shuffle.registration.timeout | 5000 | 2.3.0 | Timeout in milliseconds for registration to the external shuffle service. | package.scala:1451 |
| spark.shuffle.service.db.enabled | true | 3.0.0 | Whether to use db in ExternalShuffleService. Note that this only affects standalone mode. | package.scala:844 |
| spark.shuffle.service.enabled | false | 1.2.0 |  | package.scala:818 |
| spark.shuffle.service.name | "spark_shuffle" | 3.2.0 | The configured name of the Spark shuffle service the client should communicate with. This must match the name used to configure the Shuffle within the YARN NodeManager co | package.scala:863 |
| spark.shuffle.service.port | 7337 | 1.2.0 |  | package.scala:860 |
| spark.shuffle.service.removeShuffle | true | 3.3.0 | Whether to use the ExternalShuffleService for deleting shuffle blocks for deallocated executors when the shuffle is no longer needed. Without this enabled, shuffle data o | package.scala:824 |
| spark.shuffle.sort.bypassMergeThreshold | 200 | 1.1.1 | In the sort-based shuffle manager, avoid merge-sorting data if there is no map-side aggregation and there are at most this many reduce partitions | package.scala:1751 |
| spark.shuffle.sort.io.plugin.class | classOf[LocalDiskShuffleDataIO].getName | 3.0.0 | Name of the class to use for shuffle IO. | package.scala:1514 |
| spark.shuffle.sort.useRadixSort | true | 2.0.0 | Whether to use radix sort for sorting in-memory partition ids. Radix sort is much faster, but requires additional memory to be reserved memory as pointers are added. | package.scala:1816 |
| spark.shuffle.spill.compress | true | 0.9.0 | Whether to compress data spilled during shuffles. Compression will use spark.io.compression.codec. | package.scala:1708 |
| spark.shuffle.spill.diskWriteBufferSize | 1024 * 1024 | 2.3.0 | The buffer size, in bytes, to use when writing the sorted records to an on-disk file. | package.scala:1558 |
| spark.shuffle.sync | false | 0.8.0 | Whether to force outstanding writes to disk. | package.scala:1802 |
| spark.shuffle.unsafe.fastMergeEnabled | true | 1.4.0 | Whether to perform a fast spill merge. | package.scala:1809 |
| spark.shuffle.unsafe.file.output.buffer | 32k | 2.3.0 | (Deprecated since Spark 4.0, please use 'spark.shuffle.localDisk.file.output.buffer'.) | package.scala:1541 |
| spark.shuffle.useOldFetchProtocol | false | 3.0.0 | Whether to use the old protocol while doing the shuffle block fetching. It is only enabled while we need the compatibility in the scenario of new Spark version job fetchi | package.scala:1833 |

### spark.sparkr (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sparkr.r.command | "Rscript" | 1.5.3 |  | R.scala:36 |

### spark.speculation (9)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.speculation | false | 0.6.0 |  | package.scala:2414 |
| spark.speculation.efficiency.enabled | true | 3.4.0 | When set to true, spark will evaluate the efficiency of task processing through the stage task metrics or its duration, and only need to speculate the inefficient tasks.  | package.scala:2481 |
| spark.speculation.efficiency.longRunTaskFactor | 2.0 | 3.4.0 | A task will be speculated anyway as long as its duration has exceeded the value of multiplying the factor and the time threshold (either be ${SPECULATION_MULTIPLIER.key}  | package.scala:2469 |
| spark.speculation.efficiency.processRateMultiplier | 0.75 | 3.4.0 | A multiplier that used when evaluating inefficient tasks. The higher the multiplier is, the more tasks will be possibly considered as inefficient. | package.scala:2460 |
| spark.speculation.interval | 100 | 0.6.0 |  | package.scala:2420 |
| spark.speculation.minTaskRuntime | 100 | 3.2.0 | Minimum amount of time a task runs before being considered for speculation. This can be used to avoid launching speculative copies of tasks that are very short. | package.scala:2438 |
| spark.speculation.multiplier | 3 | 0.6.0 |  | package.scala:2426 |
| spark.speculation.quantile | 0.9 | 0.6.0 |  | package.scala:2432 |
| spark.speculation.task.duration.threshold | (none) | 3.0.0 | Task duration after which scheduler would try to speculative run the task. If provided, tasks would be speculatively run if current stage contains less tasks than or equa | package.scala:2446 |

### spark.sql.adaptive (17)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.adaptive.advisoryPartitionSizeInBytes | (fallback to SHUFFLE_TARGET_POSTSHUFFLE_INPUT_SIZE) | 3.0.0 | The advisory size in bytes of the shuffle partition during adaptive optimization (when ${ADAPTIVE_EXECUTION_ENABLED.key} is true). It takes effect when Spark coalesces sm | SQLConf.scala:1094 |
| spark.sql.adaptive.autoBroadcastJoinThreshold | (none) | 3.2.0 | Configures the maximum size in bytes for a table that will be broadcast to all worker nodes when performing a join. By setting this value to -1 broadcasting can be disabl | SQLConf.scala:1281 |
| spark.sql.adaptive.coalescePartitions.enabled | true | 3.0.0 | When true and '${ADAPTIVE_EXECUTION_ENABLED.key}' is true, Spark will coalesce contiguous shuffle partitions according to the target size (specified by '${ADVISORY_PARTIT | SQLConf.scala:1102 |
| spark.sql.adaptive.coalescePartitions.initialPartitionNum | (none) | 3.0.0 | The initial number of shuffle partitions before coalescing. If not set, it equals to ${SHUFFLE_PARTITIONS.key}. This configuration only has an effect when '${ADAPTIVE_EXE | SQLConf.scala:1147 |
| spark.sql.adaptive.coalescePartitions.minPartitionSize | 1MB | 3.2.0 | The minimum size of shuffle partitions after coalescing. This is useful when the adaptively calculated target size is too small during partition coalescing. | SQLConf.scala:1125 |
| spark.sql.adaptive.coalescePartitions.parallelismFirst | true | 3.2.0 | When true, Spark does not respect the target size specified by '${ADVISORY_PARTITION_SIZE_IN_BYTES.key}' (default 64MB) when coalescing contiguous shuffle partitions, but | SQLConf.scala:1111 |
| spark.sql.adaptive.customCostEvaluatorClass | (none) | 3.2.0 | The custom cost evaluator class to be used for adaptive execution. If not being set, Spark will use its own SimpleCostEvaluator by default. | SQLConf.scala:1328 |
| spark.sql.adaptive.enabled | true | 1.6.0 | When true, enable adaptive query execution, which re-optimizes the query plan in the middle of query execution, based on accurate runtime statistics. | SQLConf.scala:1050 |
| spark.sql.adaptive.forceOptimizeSkewedJoin | false | 3.3.0 | When true, force enable OptimizeSkewedJoin even if it introduces extra shuffle. | SQLConf.scala:1321 |
| spark.sql.adaptive.localShuffleReader.enabled | true | 3.0.0 | When true and '${ADAPTIVE_EXECUTION_ENABLED.key}' is true, Spark tries to use local shuffle reader to read the shuffle data when the shuffle partitioning is not needed, f | SQLConf.scala:1222 |
| spark.sql.adaptive.maxShuffledHashJoinLocalMapThreshold | 0L | 3.2.0 | Configures the maximum size in bytes per partition that can be allowed to build local hash map. If this value is not smaller than ${ADVISORY_PARTITION_SIZE_IN_BYTES.key}  | SQLConf.scala:1291 |
| spark.sql.adaptive.optimizer.excludedRules | (none) | 3.1.0 | Configures a list of rules to be disabled in the adaptive optimizer, in which the rules are specified by their rule names and separated by comma. The optimizer will log t | SQLConf.scala:1272 |
| spark.sql.adaptive.optimizeSkewsInRebalancePartitions.enabled | true | 3.2.0 | When true and '${ADAPTIVE_EXECUTION_ENABLED.key}' is true, Spark will optimize the skewed shuffle partitions in RebalancePartitions and split them to smaller ones accordi | SQLConf.scala:1302 |
| spark.sql.adaptive.rebalancePartitionsSmallPartitionFactor | 0.2 | 3.3.0 | A partition will be merged during splitting if its size is small than this factor multiply ${ADVISORY_PARTITION_SIZE_IN_BYTES.key}. | SQLConf.scala:1312 |
| spark.sql.adaptive.skewJoin.enabled | true | 3.0.0 | When true and '${ADAPTIVE_EXECUTION_ENABLED.key}' is true, Spark dynamically handles skew in shuffled join (sort-merge and shuffled hash) by splitting (and replicating if | SQLConf.scala:1231 |
| spark.sql.adaptive.skewJoin.skewedPartitionFactor | 5.0 | 3.0.0 | A partition is considered as skewed if its size is larger than this factor multiplying the median partition size and also larger than 'spark.sql.adaptive.skewJoin.skewedP | SQLConf.scala:1240 |
| spark.sql.adaptive.skewJoin.skewedPartitionThresholdInBytes | 256MB | 3.0.0 | A partition is considered as skewed if its size in bytes is larger than this threshold and also larger than '${SKEW_JOIN_SKEWED_PARTITION_FACTOR.key}' multiplying the med | SQLConf.scala:1250 |

### spark.sql.allowNamedFunctionArguments (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.allowNamedFunctionArguments | true | 3.5.0 | If true, Spark will turn on support for named parameters for all functions that has it implemented. | SQLConf.scala:659 |

### spark.sql.ansi (4)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.ansi.doubleQuotedIdentifiers | false | 3.4.0 | When true and '${ANSI_ENABLED.key}' is true, Spark SQL reads literals enclosed in double quoted (\ | SQLConf.scala:5199 |
| spark.sql.ansi.enabled | !sys.env.get("SPARK_ANSI_SQL_MODE").contains("false") | 3.0.0 | When true, Spark SQL uses an ANSI compliant dialect instead of being Hive compliant. For example, Spark will throw an exception at runtime instead of returning null resul | SQLConf.scala:5180 |
| spark.sql.ansi.enforceReservedKeywords | false | 3.3.0 | When true and '${ANSI_ENABLED.key}' is true, the Spark SQL parser enforces the ANSI reserved keywords and forbids SQL queries that use reserved keywords as alias names an | SQLConf.scala:5191 |
| spark.sql.ansi.relationPrecedence | false | 3.4.0 | When true and '${ANSI_ENABLED.key}' is true, JOIN takes precedence over comma when combining relation. For example, `t1, t2 JOIN t3` should result to `t1 X (t2 X t3)`. If | SQLConf.scala:5216 |

### spark.sql.autoBroadcastJoinThreshold (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.autoBroadcastJoinThreshold | 10MB | 1.1.0 | Configures the maximum size in bytes for a table that will be broadcast to all worker nodes when performing a join. By setting this value to -1 broadcasting can be disabl | SQLConf.scala:949 |

### spark.sql.avro (6)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.avro.compression.codec | "snappy" | 2.4.0 | Compression codec used in writing of AVRO files. Supported codecs: uncompressed, deflate, snappy, bzip2, xz and zstandard. Default codec is snappy. | SQLConf.scala:5620 |
| spark.sql.avro.deflate.level | CodecFactory.DEFAULT_DEFLATE_LEVEL | 2.4.0 | Compression level for the deflate codec used in writing of AVRO files. Valid value must be in the range of from 1 to 9 inclusive or -1. The default value is -1 which corr | SQLConf.scala:5628 |
| spark.sql.avro.filterPushdown.enabled | true | 3.1.0 | When true, enable filter pushdown to Avro datasource. | SQLConf.scala:6169 |
| spark.sql.avro.xz.level | CodecFactory.DEFAULT_XZ_LEVEL | 4.0.0 | Compression level for the xz codec used in writing of AVRO files. Valid value must be in the range of from 1 to 9 inclusive The default value is 6. | SQLConf.scala:5637 |
| spark.sql.avro.zstandard.bufferPool.enabled | false | 4.0.0 | If true, enable buffer pool of ZSTD JNI library when writing of AVRO files | SQLConf.scala:5652 |
| spark.sql.avro.zstandard.level | CodecFactory.DEFAULT_ZSTANDARD_LEVEL | 4.0.0 | Compression level for the zstandard codec used in writing of AVRO files. | SQLConf.scala:5646 |

### spark.sql.binaryOutputStyle (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.binaryOutputStyle | (none) | 4.0.0 | The output style used display binary data. Valid values are 'UTF-8', 'BASIC', 'BASE64', 'HEX', and 'HEX_DISCRETE'. | SQLConf.scala:2130 |

### spark.sql.broadcastTimeout (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.broadcastTimeout |  | 1.3.0 | Timeout in seconds for the broadcast wait time in broadcast joins. | SQLConf.scala:1971 |

### spark.sql.bucketing (2)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.bucketing.coalesceBucketsInJoin.enabled | false | 3.1.0 | When true, if two bucketed tables with the different number of buckets are joined, the side with a bigger number of buckets will be coalesced to have the same number of b | SQLConf.scala:6435 |
| spark.sql.bucketing.coalesceBucketsInJoin.maxBucketRatio | 4 | 3.1.0 | The ratio of the number of two buckets being coalesced should be less than or equal to this value for bucket coalescing to be applied. This configuration only has an effe | SQLConf.scala:6448 |

### spark.sql.cache (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.cache.serializer | "org.apache.spark.sql.execution.columnar.DefaultCachedBatchSerializer" | 3.1.0 | The name of a class that implements org.apache.spark.sql.columnar.CachedBatchSerializer. It will be used to translate SQL data into a format that can more efficiently be  | StaticSQLConf.scala:145 |

### spark.sql.cbo (6)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.cbo.enabled | false | 2.2.0 | Enables CBO for estimation of plan statistics when set true. | SQLConf.scala:4092 |
| spark.sql.cbo.joinReorder.dp.star.filter | false | 2.2.0 | Applies star-join filter heuristics to cost based join enumeration. | SQLConf.scala:4133 |
| spark.sql.cbo.joinReorder.dp.threshold | 12 | 2.2.0 | The maximum number of joined nodes allowed in the dynamic programming algorithm. | SQLConf.scala:4113 |
| spark.sql.cbo.joinReorder.enabled | false | 2.2.0 | Enables join reorder in CBO. | SQLConf.scala:4106 |
| spark.sql.cbo.planStats.enabled | false | 3.0.0 | When true, the logical plan will fetch row counts and column statistics from catalog. | SQLConf.scala:4099 |
| spark.sql.cbo.starSchemaDetection | false | 2.2.0 | When true, it enables join reordering based on star schema detection. | SQLConf.scala:4139 |

### spark.sql.charAsVarchar (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.charAsVarchar | false | 3.3.0 | When true, Spark replaces CHAR type with VARCHAR type in CREATE/REPLACE/ALTER TABLE commands, so that newly created/updated tables will not have CHAR type columns/fields. | SQLConf.scala:6542 |

### spark.sql.chunkBase64String (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.chunkBase64String.enabled | true | 3.5.2 | Whether to truncate string generated by the `Base64` function. When true, base64 strings generated by the base64 function are chunked into lines of at most 76 characters. | SQLConf.scala:5224 |

### spark.sql.classic (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.classic.shuffleDependency.fileCleanup.enabled | Utils.isTesting | 4.1.0 | When enabled, shuffle files will be cleaned up at the end of classic SQL executions. Note that this cleanup may cause stage retries and regenerate shuffle files if the sa | SQLConf.scala:4293 |

### spark.sql.cli (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.cli.print.header | false | 3.2.0 | When set to true, spark-sql CLI prints the names of the columns in query output. | SQLConf.scala:6585 |

### spark.sql.collation (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.collation.allowInMapKeys | false | 4.0.0 | Allow for non-UTF8_BINARY collated strings inside of map's keys | SQLConf.scala:1158 |

### spark.sql.columnNameOfCorruptRecord (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.columnNameOfCorruptRecord | "_corrupt_record" | 1.2.0 | The name of internal column for storing raw/un-parsed JSON and CSV records that fail to parse. | SQLConf.scala:1964 |

### spark.sql.connect (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.connect.shuffleDependency.fileCleanup.enabled | (fallback to SHUFFLE_DEPENDENCY_FILE_CLEANUP_ENABLED) | 4.1.0 | When enabled, shuffle files will be cleaned up at the end of Spark Connect SQL executions. | SQLConf.scala:4302 |

### spark.sql.csv (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.csv.filterPushdown.enabled | true | 3.0.0 | When true, enable filter pushdown to CSV datasource. | SQLConf.scala:6157 |

### spark.sql.datetime (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.datetime.java8API.enabled | false | 3.0.0 | If the configuration property is set to true, java.time.Instant and java.time.LocalDate classes of Java 8 API are used as external types for Catalyst's TimestampType and  | SQLConf.scala:5865 |

### spark.sql.debug (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.debug.maxToStringFields | 25 | 3.0.0 | Maximum number of fields of sequence-like entries can be converted to strings in debug output. Any elements beyond the limit will be dropped and replaced by a placeholder | SQLConf.scala:5811 |

### spark.sql.defaultCacheStorageLevel (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.defaultCacheStorageLevel | StorageLevelMapper.MEMORY_AND_DISK | 4.0.0 | The default storage level of `dataset.cache()`, `catalog.cacheTable()` and sql query `CACHE TABLE t`. | SQLConf.scala:2312 |

### spark.sql.defaultCatalog (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.defaultCatalog | SESSION_CATALOG_NAME | 3.0.0 | Name of the default catalog. This will be the current catalog if users have not explicitly set the current catalog yet. | SQLConf.scala:5903 |

### spark.sql.defaultPath (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.defaultPath | "" | 4.2.0 | Default SQL PATH used when no SET PATH has been issued in the session; this is also the value to which `SET PATH = DEFAULT_PATH` expands. Accepts the full SET PATH gramma | SQLConf.scala:2503 |

### spark.sql.dropTableOnView (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.dropTableOnView.enabled | true | 4.2.0 | When true, DROP TABLE command will work on VIEW as well. | SQLConf.scala:2330 |

### spark.sql.error (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.error.messageFormat | ErrorMessageFormat.PRETTY | 3.4.0 | When PRETTY, the error message consists of textual representation of error class, message and query context. Stack traces are only shown for internal errors (SQLSTATE XX* | SQLConf.scala:6796 |

### spark.sql.event (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.event.truncate.length | Int.MaxValue | 3.0.0 | Threshold of SQL length beyond which it will be truncated before adding to event. Defaults to no truncation. If set to 0, callsite will be logged instead. | StaticSQLConf.scala:222 |

### spark.sql.execution (34)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.execution.arrow.compression.codec | "none" | 4.1.0 | Compression codec used to compress Arrow IPC data when transferring data between JVM and Python processes (e.g., toPandas, toArrow). This can significantly reduce memory  | SQLConf.scala:4640 |
| spark.sql.execution.arrow.compression.zstd.level | 3 | 4.1.0 | Compression level for Zstandard (zstd) codec when compressing Arrow IPC data. This config is only used when spark.sql.execution.arrow.compression.codec is set to 'zstd'.  | SQLConf.scala:4654 |
| spark.sql.execution.arrow.enabled | true | 2.3.0 | (Deprecated since Spark 3.0, please set 'spark.sql.execution.arrow.pyspark.enabled'.) | SQLConf.scala:4399 |
| spark.sql.execution.arrow.fallback.enabled | true | 2.4.0 | (Deprecated since Spark 3.0, please set 'spark.sql.execution.arrow.pyspark.fallback.enabled'.) | SQLConf.scala:4566 |
| spark.sql.execution.arrow.localRelationThreshold | 48MB | 3.4.0 | When converting Arrow batches to Spark DataFrame, local collections are used in the driver side if the byte size of Arrow batches is smaller than this threshold. Otherwis | SQLConf.scala:4442 |
| spark.sql.execution.arrow.maxRecordsPerBatch | 10000 | 2.3.0 | When using Apache Arrow, limit the maximum number of records that can be written to a single ArrowRecordBatch in memory. If set to zero or negative there is no limit. See | SQLConf.scala:4581 |
| spark.sql.execution.arrow.pyspark.enabled | (fallback to ARROW_EXECUTION_ENABLED) | 3.0.0 | When true, make use of Apache Arrow for columnar data transfers in PySpark. This optimization applies to: 1. pyspark.sql.DataFrame.toPandas. 2. pyspark.sql.SparkSession.c | SQLConf.scala:4406 |
| spark.sql.execution.arrow.pyspark.fallback.enabled | (fallback to ARROW_FALLBACK_ENABLED) | 3.0.0 | When true, optimizations enabled by '${ARROW_PYSPARK_EXECUTION_ENABLED.key}' will fallback automatically to non-optimized implementations if an error occurs. | SQLConf.scala:4574 |
| spark.sql.execution.arrow.pyspark.selfDestruct.enabled | false | 3.2.0 | (Experimental) When true, make use of Apache Arrow's self-destruct and split-blocks options for columnar data transfers in PySpark, when converting from Arrow to Pandas.  | SQLConf.scala:4418 |
| spark.sql.execution.arrow.pyspark.validateSchema.enabled | false | 4.1.0 | When true, validate the schema of Arrow batches returned by mapInArrow, mapInPandas and DataSource against the expected schema to ensure that they are compatible. | SQLConf.scala:4766 |
| spark.sql.execution.arrow.pythonUDF.columnarInput.enabled | true | 4.2.0 | When true, Arrow-based Python UDFs (pandas UDFs) can accept columnar input directly from upstream operators that produce Arrow-backed ColumnarBatch (e.g., DataSource V2 c | SQLConf.scala:4666 |
| spark.sql.execution.arrow.sparkr.enabled | false | 3.0.0 | When true, make use of Apache Arrow for columnar data transfers in SparkR. This optimization applies to: 1. createDataFrame when its input is an R DataFrame 2. collect 3. | SQLConf.scala:4552 |
| spark.sql.execution.arrow.transformWithStateInPySpark.maxStateRecordsPerBatch | 10000 | 4.0.0 | When using TransformWithState in PySpark (both Python Row and Pandas), limit the maximum number of state records that can be written to a single ArrowRecordBatch in memor | SQLConf.scala:4679 |
| spark.sql.execution.arrow.useLargeVarTypes | false | 3.5.0 | When using Apache Arrow, use large variable width vectors for string and binary types. Regular string and binary types have a 2GiB limit for a column in a single record b | SQLConf.scala:4691 |
| spark.sql.execution.interruptOnCancel | true | 4.0.0 | When true, all running tasks will be interrupted if one cancels a query. | SQLConf.scala:1983 |
| spark.sql.execution.pandas.inferPandasDictAsMap | false | 4.0.0 | When true, spark.createDataFrame will infer dict from Pandas DataFrame as a MapType. When false, spark.createDataFrame infers dict from Pandas DataFrame as a StructType w | SQLConf.scala:6633 |
| spark.sql.execution.pandas.structHandlingMode | legacy | 3.5.0 | The conversion mode of struct type when creating pandas DataFrame. When \, 1. when Arrow optimization is disabled, convert to Row object, 2. when Arrow optimization is en | SQLConf.scala:4729 |
| spark.sql.execution.pandas.udf.buffer.size | (fallback to BUFFER_SIZE) | 3.0.0 | Same as `${BUFFER_SIZE.key}` but only applies to Pandas UDF executions. If it is not set, the fallback is `${BUFFER_SIZE.key}`. Note that Pandas execution requires more t | SQLConf.scala:4719 |
| spark.sql.execution.pyspark.binaryAsBytes | true | 4.1.0 | When true, BinaryType is consistently mapped to bytes in PySpark. When false, restores the PySpark behavior before 4.1.0. Before 4.1.0, BinaryType is mapped to bytearray  | SQLConf.scala:4429 |
| spark.sql.execution.pyspark.udf.daemonKillWorkerOnFlushFailure | (fallback to Python.PYTHON_DAEMON_KILL_WORKER_ON_FLUSH_FAILURE) | 4.1.0 | Same as ${Python.PYTHON_DAEMON_KILL_WORKER_ON_FLUSH_FAILURE.key} for Python execution with DataFrame and SQL. It can change during runtime. | SQLConf.scala:4526 |
| spark.sql.execution.pyspark.udf.faulthandler.enabled | (fallback to Python.PYTHON_WORKER_FAULTHANLDER_ENABLED) | 4.0.0 | Same as ${Python.PYTHON_WORKER_FAULTHANLDER_ENABLED.key} for Python execution with DataFrame and SQL. It can change during runtime. | SQLConf.scala:4494 |
| spark.sql.execution.pyspark.udf.hideTraceback.enabled | false | 4.0.0 | When true, only show the message of the exception from Python UDFs, hiding the stack trace. If this is enabled, simplifiedTraceback has no effect. | SQLConf.scala:4746 |
| spark.sql.execution.pyspark.udf.idleTimeoutSeconds | (fallback to Python.PYTHON_WORKER_IDLE_TIMEOUT_SECONDS) | 4.0.0 | Same as ${Python.PYTHON_WORKER_IDLE_TIMEOUT_SECONDS.key} for Python execution with DataFrame and SQL. It can change during runtime. | SQLConf.scala:4502 |
| spark.sql.execution.pyspark.udf.killOnIdleTimeout | (fallback to Python.PYTHON_WORKER_KILL_ON_IDLE_TIMEOUT) | 4.1.0 | Same as ${Python.PYTHON_WORKER_KILL_ON_IDLE_TIMEOUT.key} for Python execution with DataFrame and SQL. It can change during runtime. | SQLConf.scala:4510 |
| spark.sql.execution.pyspark.udf.simplifiedTraceback.enabled | !Utils.isTesting | 3.1.0 | When true, the traceback from Python UDFs is simplified. It hides the Python worker, (de)serialization, etc from PySpark in tracebacks, and only shows the exception messa | SQLConf.scala:4755 |
| spark.sql.execution.pyspark.udf.tracebackDumpIntervalSeconds | (fallback to Python.PYTHON_WORKER_TRACEBACK_DUMP_INTERVAL_SECONDS) | 4.1.0 | Same as ${Python.PYTHON_WORKER_TRACEBACK_DUMP_INTERVAL_SECONDS.key} for Python execution with DataFrame and SQL. It can change during runtime. | SQLConf.scala:4518 |
| spark.sql.execution.python.udf.buffer.size | (fallback to BUFFER_SIZE) | 4.0.0 | Same as `${BUFFER_SIZE.key}` but only applies to Python UDF executions. If it is not set, the fallback is `${BUFFER_SIZE.key}`. | SQLConf.scala:4711 |
| spark.sql.execution.python.udf.maxRecordsPerBatch | 100 | 4.0.0 | When using Python UDFs, limit the maximum number of records that can be batched for serialization/deserialization. | SQLConf.scala:4701 |
| spark.sql.execution.pythonUDF.arrow.concurrency.level | (none) | 4.0.0 | The level of concurrency to execute Arrow-optimized Python UDF. This can be useful if Python UDFs use I/O intensively. | SQLConf.scala:4783 |
| spark.sql.execution.pythonUDF.arrow.enabled | true | 3.4.0 | Enable Arrow optimization in regular Python UDFs. This optimization can only be enabled when the given function takes at least one argument. | SQLConf.scala:4775 |
| spark.sql.execution.pythonUDF.pandas.intToDecimalCoercionEnabled | false | 4.1.0 | When true, convert int to Decimal python objects before converting Pandas.Series to Arrow array during serialization.Disabled by default, impacts performance. | SQLConf.scala:4803 |
| spark.sql.execution.pythonUDF.pandas.preferIntExtensionDtype | false | 4.2.0 | When true, convert integers to Pandas ExtensionDtype (e.g. pandas.Int64Dtype) for Pandas UDF execution. Otherwise, depends on the behavior of pyarrow.Array.to_pandas on e | SQLConf.scala:4812 |
| spark.sql.execution.pythonUDTF.arrow.enabled | true | 3.5.0 | Enable Arrow optimization for Python UDTFs. | SQLConf.scala:4821 |
| spark.sql.execution.topKSortFallbackThreshold | ByteArrayMethods.MAX_ROUNDED_ARRAY_LENGTH | 2.4.0 | In SQL queries with a SORT followed by a LIMIT like 'SELECT x FROM t ORDER BY y LIMIT m', if m is under this threshold, do a top-K sort in memory, otherwise do a global s | SQLConf.scala:5495 |

### spark.sql.extendedExplainProviders (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.extendedExplainProviders | (none) | 4.0.0 | A comma-separated list of classes that implement the org.apache.spark.sql.ExtendedExplainGenerator trait. If provided, Spark will print extended plan information from the | SQLConf.scala:684 |

### spark.sql.extensions (2)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.extensions | (none) | 2.2.0 | A comma-separated list of classes that implement Function1[SparkSessionExtensions, Unit] used to configure Spark Session extensions. The classes must have a no-args const | StaticSQLConf.scala:125 |
| spark.sql.extensions.test.loadFromCp | true |  | Flag that determines if we should load extensions from the classpath using the SparkSessionExtensionsProvider mechanism. This is a test only flag. | StaticSQLConf.scala:139 |

### spark.sql.fileSource (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.fileSource.insert.enforceNotNull | false | 4.2.0 | When true, Spark enforces NOT NULL constraints when inserting data into file-based data source tables (e.g., Parquet, ORC, JSON), consistent with the behavior for other d | SQLConf.scala:5171 |

### spark.sql.files (7)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.files.ignoreCorruptFiles | false | 2.1.1 | Whether to ignore corrupt files. If true, the Spark jobs will continue to run when encountering corrupted files and the contents that have been read will still be returne | SQLConf.scala:2745 |
| spark.sql.files.ignoreInvalidPartitionPaths | false | 4.0.0 | Whether to ignore invalid partition paths that do not match <column>=<value>. When the option is enabled, table with two partition directories 'table/invalid' and 'table/ | SQLConf.scala:2763 |
| spark.sql.files.ignoreMissingFiles | false | 2.3.0 | Whether to ignore missing files. If true, the Spark jobs will continue to run when encountering missing files and the contents that have been read will still be returned. | SQLConf.scala:2754 |
| spark.sql.files.maxPartitionBytes | 128MB | 2.0.0 | The maximum number of bytes to pack into a single partition when reading files. This configuration is effective only when using file-based sources such as Parquet, JSON a | SQLConf.scala:2706 |
| spark.sql.files.maxPartitionNum | (none) | 3.5.0 | The suggested (not guaranteed) maximum number of split file partitions. If it is set, Spark will rescale each partition to make the number of partitions is close to this  | SQLConf.scala:2735 |
| spark.sql.files.maxRecordsPerFile | 0 | 2.2.0 | Maximum number of records to write out to a single file. If this value is zero or negative, there is no limit. | SQLConf.scala:2771 |
| spark.sql.files.minPartitionNum | (none) | 3.1.0 | The suggested (not guaranteed) minimum number of split file partitions. If not set, the default value is `${LEAF_NODE_DEFAULT_PARALLELISM.key}`. This configuration is eff | SQLConf.scala:2725 |

### spark.sql.function (3)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.function.concatBinaryAsString | false | 2.3.0 | When this option is set to false and all inputs are binary, `functions.concat` returns an output as binary. Otherwise, it returns as a string. | SQLConf.scala:4974 |
| spark.sql.function.eltOutputAsString | false | 2.3.0 | When this option is set to false and all inputs are binary, `elt` returns an output as binary. Otherwise, it returns as a string. | SQLConf.scala:4981 |
| spark.sql.function.protobufExtensions.enabled | false | 4.2.0 | When true, the from_protobuf and to_protobuf operators will support proto2 extensions when a binary file descriptor set is provided. This property will have no effect for | SQLConf.scala:7412 |

### spark.sql.groupByAliases (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.groupByAliases | true | 2.2.0 | When true, aliases in a select list can be used in group by clauses. When false, an analysis exception is thrown in the case. | SQLConf.scala:2358 |

### spark.sql.groupByOrdinal (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.groupByOrdinal | true | 2.0.0 | When true, the ordinal numbers in group by clauses are treated as the position in the select list. When false, the ordinal numbers are ignored. | SQLConf.scala:2351 |

### spark.sql.hive (7)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.hive.dropPartitionByName.enabled | false | 3.4.0 | When true, Spark will get partition name rather than partition object to drop partition, which can improve the performance of drop partition. | SQLConf.scala:1855 |
| spark.sql.hive.filesourcePartitionFileCacheSize | 250 * 1024 * 1024 | 2.1.1 | When nonzero, enable caching of partition file metadata in memory. All tables share a cache that can use up to specified num bytes for file metadata. This conf only has a | SQLConf.scala:1917 |
| spark.sql.hive.manageFilesourcePartitions | true | 2.1.1 | When true, enable metastore partition management for file source tables as well. This includes both datasource and converted Hive tables. When partition management is ena | SQLConf.scala:1906 |
| spark.sql.hive.metastorePartitionPruning | true | 1.5.0 | When true, some predicates will be pushed down into the Hive metastore so that unmatching partitions can be eliminated earlier. | SQLConf.scala:1863 |
| spark.sql.hive.metastorePartitionPruningFallbackOnException | false | 3.3.0 | Whether to fallback to get all partitions from Hive metastore and perform partition pruning on Spark client side, when encountering MetaException from the metastore. Note | SQLConf.scala:1885 |
| spark.sql.hive.metastorePartitionPruningFastFallback | false | 3.3.0 | When this config is enabled, if the predicates are not supported by Hive or Spark does fallback due to encountering MetaException from the metastore, Spark will instead p | SQLConf.scala:1895 |
| spark.sql.hive.thriftServer.singleSession | false | 1.6.0 | When set to true, Hive Thrift server is running in a single session mode. All the JDBC/ODBC connections share the temporary views, function registries, SQL configuration  | StaticSQLConf.scala:117 |

### spark.sql.icu (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.icu.caseMappings.enabled | true | 4.0.0 | When enabled we use the ICU library (instead of the JVM) to implement case mappings for strings under UTF8_BINARY collation. | SQLConf.scala:1200 |

### spark.sql.inMemoryColumnarStorage (5)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.inMemoryColumnarStorage.batchSize | 10000 | 1.1.1 | Controls the size of batches for columnar caching. Larger batch sizes can improve memory utilization and compression, but risk OOMs when caching data. | SQLConf.scala:843 |
| spark.sql.inMemoryColumnarStorage.compressed | true | 1.0.1 | When set to true Spark SQL will automatically select a compression codec for each column based on statistics of the data. | SQLConf.scala:836 |
| spark.sql.inMemoryColumnarStorage.enableVectorizedReader | true | 2.3.1 | Enables vectorized reader for columnar caching. | SQLConf.scala:887 |
| spark.sql.inMemoryColumnarStorage.hugeVectorReserveRatio | 1.2 | 4.0.0 | When spark.sql.inMemoryColumnarStorage.hugeVectorThreshold <= 0 or the required memory is smaller than spark.sql.inMemoryColumnarStorage.hugeVectorThreshold, spark reserv | SQLConf.scala:851 |
| spark.sql.inMemoryColumnarStorage.hugeVectorThreshold | -1 | 4.0.0 | When the required memory is larger than this, spark reserves required memory * ${VECTORIZED_HUGE_VECTOR_RESERVE_RATIO.key} memory next time and release this column vector | SQLConf.scala:862 |

### spark.sql.insertIntoReplaceOn (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.insertIntoReplaceOn.enabled | true | 4.2.0 | Enable the SQL syntax INSERT INTO ... REPLACE ON (...). The command atomically inserts new rows into a table after deleting all existing rows that match the new rows acco | SQLConf.scala:5106 |

### spark.sql.insertIntoReplaceUsing (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.insertIntoReplaceUsing.enabled | true | 4.2.0 | Enable the SQL syntax INSERT INTO ... REPLACE USING (...). The command atomically inserts new rows into a table after deleting all existing rows that match the new rows a | SQLConf.scala:5127 |

### spark.sql.json (2)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.json.filterPushdown.enabled | true | 3.1.0 | When true, enable filter pushdown to JSON datasource. | SQLConf.scala:6163 |
| spark.sql.json.useUnsafeRow | false | 4.0.0 | When set to true, use UnsafeRow to represent struct result in the JSON parser. It can be overwritten by the JSON option `useUnsafeRow`. | SQLConf.scala:6194 |

### spark.sql.jsonGenerator (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.jsonGenerator.ignoreNullFields | true | 3.0.0 | Whether to ignore null fields when generating JSON objects in JSON data source and JSON functions such as to_json. If false, it generates null for null fields in JSON obj | SQLConf.scala:3792 |

### spark.sql.leafNodeDefaultParallelism (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.leafNodeDefaultParallelism | (none) | 3.2.0 | The default parallelism of Spark SQL leaf nodes that produce data, such as the file scan node, the local data scan node, the range node, etc. The default value of this co | SQLConf.scala:991 |

### spark.sql.mapKeyDedupPolicy (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.mapKeyDedupPolicy | MapKeyDedupPolicy.EXCEPTION | 3.0.0 | The policy to deduplicate map keys in builtin function: CreateMap, MapFromArrays, MapFromEntries, StringToMap, MapConcat and TransformKeys. When EXCEPTION, the query fail | SQLConf.scala:5932 |

### spark.sql.maven (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.maven.additionalRemoteRepositories |  | 3.0.0 | A comma-delimited string config of the optional additional remote Maven mirror repositories. This is only used for downloading Hive jars in IsolatedClientLoader if the de | SQLConf.scala:6024 |

### spark.sql.maxBroadcastTableSize (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.maxBroadcastTableSize | 8L << 30 | 4.1.0 | The maximum table size in bytes that can be broadcast in broadcast joins. | SQLConf.scala:1977 |

### spark.sql.maxMetadataStringLength (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.maxMetadataStringLength | 100 | 3.1.0 | Maximum number of characters to output for a metadata string. e.g. file location in `DataSourceScanExec`, every value will be abbreviated if exceed length. | SQLConf.scala:5831 |

### spark.sql.maxPlanStringLength (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.maxPlanStringLength |  | 3.0.0 | Maximum number of characters to output for a plan string. If the plan is longer, further output will be truncated. The default setting always generates a full plan. Set t | SQLConf.scala:5819 |

### spark.sql.maxSinglePartitionBytes (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.maxSinglePartitionBytes | 128m | 3.4.0 | The maximum number of bytes allowed for a single partition. Otherwise, The planner will introduce shuffle to improve parallelism. | SQLConf.scala:933 |

### spark.sql.metadataCacheTTLSeconds (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.metadataCacheTTLSeconds | -1 | 3.1.0 | Time-to-live (TTL) value for the metadata caches: partition file metadata cache and session catalog cache. This configuration only has an effect when this value having a  | StaticSQLConf.scala:276 |

### spark.sql.operatorPipeSyntaxEnabled (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.operatorPipeSyntaxEnabled | true | 4.0.0 | If true, enable operator pipe syntax for Apache Spark SQL. This uses the operator pipe marker /> to indicate separation between clauses of SQL in a manner that describes  | SQLConf.scala:6947 |

### spark.sql.optimizer (19)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.optimizer.avoidCollapseUDFWithExpensiveExpr | true | 4.0.0 | Whether to avoid collapsing projections that would duplicate expensive expressions in UDFs. | SQLConf.scala:3825 |
| spark.sql.optimizer.avoidDoubleFilterEval | true | 4.2.0 | When true avoid pushing expensive (UDF, etc.) filters down if it could result indouble evaluation. This was the behaviour prior to 3.X. | SQLConf.scala:555 |
| spark.sql.optimizer.collapseProjectAlwaysInline | false | 3.3.0 | Whether to always collapse two adjacent projections and inline expressions even if it causes extra duplication. | SQLConf.scala:3817 |
| spark.sql.optimizer.dynamicPartitionPruning.enabled | true | 3.0.0 | When true, we will generate predicate for partition column when it's used as join key | SQLConf.scala:694 |
| spark.sql.optimizer.enableCsvExpressionOptimization | true | 3.2.0 | Whether to optimize CSV expressions in SQL optimizer. It includes pruning unnecessary columns from from_csv. | SQLConf.scala:3810 |
| spark.sql.optimizer.enableJsonExpressionOptimization | true | 3.1.0 | Whether to optimize JSON expressions in SQL optimizer. It includes pruning unnecessary columns from from_json, simplifying from_json + to_json, to_json + named_struct(fro | SQLConf.scala:3801 |
| spark.sql.optimizer.excludedRules | (none) | 2.4.0 | Configures a list of rules to be disabled in the optimizer, in which the rules are specified by their rule names and separated by comma. It is not guaranteed that all the | SQLConf.scala:562 |
| spark.sql.optimizer.mergeSubplans.filterPropagation.enabled | true | 4.2.0 | When set to true, subquery plans that differ only in their filter conditions can be merged by propagating filters up to enclosing non-grouping aggregates. | SQLConf.scala:6759 |
| spark.sql.optimizer.mergeSubplans.filterPropagation.throughJoin.enabled | false | 4.2.0 | When set to true, filter attributes can propagate through Join nodes during subplan merging, allowing subplans that differ only in their filter conditions and share a com | SQLConf.scala:6783 |
| spark.sql.optimizer.pushDownJoinThroughUnion.enabled | false | 4.2.0 | When true, pushes down Join through Union when the right side is small enough to broadcast. This can improve performance by allowing each Union branch to directly perform | SQLConf.scala:817 |
| spark.sql.optimizer.runtime.bloomFilter.applicationSideScanSizeThreshold | 10GB | 3.3.0 | Byte size threshold of the Bloom filter application side plan's aggregated scan size. Aggregated scan byte size of the Bloom filter application side needs to be over this | SQLConf.scala:756 |
| spark.sql.optimizer.runtime.bloomFilter.creationSideThreshold | 10MB | 3.3.0 | Size threshold of the bloom filter creation side plan. Estimated size needs to be under this value to try to inject bloom filter. | SQLConf.scala:748 |
| spark.sql.optimizer.runtime.bloomFilter.enabled | true | 3.3.0 | When true and if one side of a shuffle join has a selective predicate, we attempt to insert a bloom filter in the other side to reduce the amount of shuffle data. | SQLConf.scala:740 |
| spark.sql.optimizer.runtime.bloomFilter.expectedNumItems | 1000000L | 3.3.0 | The default number of expected items for the runtime bloomfilter | SQLConf.scala:765 |
| spark.sql.optimizer.runtime.bloomFilter.maxNumBits | 67108864L | 3.3.0 | The max number of bits to use for the runtime bloom filter | SQLConf.scala:787 |
| spark.sql.optimizer.runtime.bloomFilter.maxNumItems | 4000000L | 3.3.0 | The max allowed number of expected items for the runtime bloom filter | SQLConf.scala:772 |
| spark.sql.optimizer.runtime.bloomFilter.numBits | 8388608L | 3.3.0 | The default number of bits to use for the runtime bloom filter | SQLConf.scala:780 |
| spark.sql.optimizer.runtime.rowLevelOperationGroupFilter.enabled | true | 3.4.0 | Enables runtime filtering for group-based and delta-based row-level operations. Data sources may prune entire file groups at runtime when planning a row-level operation s | SQLConf.scala:794 |
| spark.sql.optimizer.runtimeFilter.number.threshold | 10 | 3.3.0 | The total number of injected runtime filters (non-DPP) for a single query. This is to prevent driver OOMs with too many Bloom filters. | SQLConf.scala:731 |

### spark.sql.orc (8)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.orc.aggregatePushdown | false | 3.3.0 | If true, aggregates will be pushed down to ORC for optimization. Support MIN, MAX and COUNT as aggregate expression. For MIN/MAX, support boolean, integer, float and date | SQLConf.scala:1838 |
| spark.sql.orc.columnarReaderBatchSize | 4096 | 2.4.0 | The number of rows to include in a orc vectorized reader batch. The number should be carefully chosen to minimize overhead and avoid OOMs in reading data. | SQLConf.scala:1811 |
| spark.sql.orc.columnarWriterBatchSize | 1024 | 3.4.0 | The number of rows to include in a orc vectorized writer batch. The number should be carefully chosen to minimize overhead and avoid OOMs in writing data. | SQLConf.scala:1818 |
| spark.sql.orc.compression.codec | "zstd" | 2.3.0 | Sets the compression codec used when writing ORC files. If either `compression` or `orc.compress` is specified in the table-specific options/properties, the precedence wo | SQLConf.scala:1785 |
| spark.sql.orc.enableNestedColumnVectorizedReader | true | 3.2.0 | Enables vectorized orc decoding for nested column. | SQLConf.scala:1826 |
| spark.sql.orc.enableVectorizedReader | true | 2.3.0 | Enables vectorized orc decoding. | SQLConf.scala:1805 |
| spark.sql.orc.filterPushdown | true | 1.4.0 | When true, enable filter pushdown for ORC files. | SQLConf.scala:1832 |
| spark.sql.orc.mergeSchema | false | 3.0.0 | When true, the Orc data source merges schemas collected from all data files, otherwise the schema is picked from a random data file. | SQLConf.scala:1847 |

### spark.sql.orderByOrdinal (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.orderByOrdinal | true | 2.0.0 | When true, the ordinal numbers are treated as the position in the select list. When false, the ordinal numbers in order/sort by clause are ignored. | SQLConf.scala:2344 |

### spark.sql.parquet (18)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.parquet.aggregatePushdown | false | 3.3.0 | If true, aggregates will be pushed down to Parquet for optimization. Support MIN, MAX and COUNT as aggregate expression. For MIN/MAX, support boolean, integer, float and  | SQLConf.scala:1633 |
| spark.sql.parquet.binaryAsString | false | 1.1.1 | Some other Parquet-producing systems, in particular Impala and older versions of Spark SQL, do not differentiate between binary data and strings when writing out the Parq | SQLConf.scala:1512 |
| spark.sql.parquet.columnarReaderBatchSize | 4096 | 2.4.0 | The number of rows to include in a parquet vectorized reader batch. The number should be carefully chosen to minimize overhead and avoid OOMs in reading data. | SQLConf.scala:1710 |
| spark.sql.parquet.compression.codec | "snappy" | 1.1.1 | Sets the compression codec used when writing Parquet files. If either `compression` or `parquet.compression` is specified in the table-specific options/properties, the pr | SQLConf.scala:1552 |
| spark.sql.parquet.enableNestedColumnVectorizedReader | true | 3.3.0 | Enables vectorized Parquet decoding for nested columns (e.g., struct, list, map). Requires ${PARQUET_VECTORIZED_READER_ENABLED.key} to be enabled. | SQLConf.scala:1673 |
| spark.sql.parquet.enableVectorizedReader | true | 2.0.0 | Enables vectorized parquet decoding. | SQLConf.scala:1666 |
| spark.sql.parquet.fieldId.read.enabled | false | 3.3.0 | Field ID is a native field of the Parquet schema spec. When enabled, Parquet readers will use field IDs (if present) in the requested Spark schema to look up Parquet fiel | SQLConf.scala:1756 |
| spark.sql.parquet.fieldId.read.ignoreMissing | false | 3.3.0 | When the Parquet file doesn't have any field IDs but the Spark read schema is using field IDs to read, we will silently return nulls when this flag is enabled, or error o | SQLConf.scala:1765 |
| spark.sql.parquet.fieldId.write.enabled | true | 3.3.0 | Field ID is a native field of the Parquet schema spec. When enabled, Parquet writers will populate the field Id metadata (if present) in the Spark schema to the Parquet s | SQLConf.scala:1718 |
| spark.sql.parquet.filterPushdown | true | 1.2.0 | Enables Parquet filter push-down optimization when set to true. | SQLConf.scala:1565 |
| spark.sql.parquet.inferTimestampNTZ.enabled | true | 3.4.0 | When enabled, Parquet timestamp columns with annotation isAdjustedToUTC = false are inferred as TIMESTAMP_NTZ type during schema inference. Otherwise, all the Parquet tim | SQLConf.scala:1774 |
| spark.sql.parquet.int96AsTimestamp | true | 1.3.0 | Some Parquet-producing systems, in particular Impala, store Timestamp into INT96. Spark would also store Timestamp as INT96 because we need to avoid precision lost of the | SQLConf.scala:1521 |
| spark.sql.parquet.int96TimestampConversion | false | 2.3.0 | This controls whether timestamp adjustments should be applied to INT96 data when converting to timestamps, for data written by Impala. This is necessary because Impala st | SQLConf.scala:1530 |
| spark.sql.parquet.mergeSchema | false | 1.5.0 | When true, the Parquet data source merges schemas collected from all data files, otherwise the schema is picked from the summary file or a random data file if no summary  | SQLConf.scala:1495 |
| spark.sql.parquet.outputTimestampType | ParquetOutputTimestampType.INT96 | 2.3.0 | Sets which Parquet timestamp type to use when Spark writes data to Parquet files. INT96 is a non-standard but commonly used timestamp type in Parquet. TIMESTAMP_MICROS is | SQLConf.scala:1542 |
| spark.sql.parquet.recordLevelFilter.enabled | false | 2.3.0 | If true, enables Parquet's native record-level filtering using the pushed down filters. This configuration only has an effect when '${PARQUET_FILTER_PUSHDOWN_ENABLED.key} | SQLConf.scala:1700 |
| spark.sql.parquet.respectSummaryFiles | false | 1.5.0 | When true, we make assumption that all part-files of Parquet are consistent with summary files and we will ignore them when merging schema. Otherwise, if this is false, w | SQLConf.scala:1503 |
| spark.sql.parquet.writeLegacyFormat | false | 1.6.0 | If true, data will be written in a way of Spark 1.4 and earlier. For example, decimal values will be written in Apache Parquet's fixed-length byte array format, which oth | SQLConf.scala:1642 |

### spark.sql.parser (2)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.parser.quotedRegexColumnNames | false | 2.3.0 | When true, quoted Identifiers (using backticks) in SELECT statement are interpreted as regular expressions. | SQLConf.scala:4364 |
| spark.sql.parser.singleCharacterPipeOperator.enabled | true | 4.2.0 | When true, the single character pipe token '/' can be used as an alternative to '/>' for SQL pipe operators. When false, only '/>' is recognized as a pipe operator, and ' | SQLConf.scala:4372 |

### spark.sql.path (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.path.enabled | false | 4.2.0 | When true, enables the SQL Standard PATH feature: SET PATH, path-based routine resolution, and CURRENT_PATH(). When false, SET PATH is rejected and resolution uses the de | SQLConf.scala:2493 |

### spark.sql.pipelines (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.pipelines.maxFlowRetryAttempts | 2 | 4.1.0 | Maximum number of times a flow can be retried | SQLConf.scala:7278 |

### spark.sql.pivotMaxValues (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.pivotMaxValues | 10000 | 1.6.0 | When doing a pivot without specifying values for the pivot column this is the maximum number of (distinct) values that will be collected without error. | SQLConf.scala:2532 |

### spark.sql.planner (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.planner.pythonExecution.memory | (none) | 4.0.0 | Specifies the memory allocation for executing Python code in Spark driver, in MiB. When set, it caps the memory for Python execution to the specified amount. If not set,  | SQLConf.scala:4851 |

### spark.sql.preserveCharVarcharTypeInfo (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.preserveCharVarcharTypeInfo | false | 4.0.0 | When true, Spark does not replace CHAR/VARCHAR types the STRING type, which is the default behavior of Spark 3.0 and earlier versions. This means the length checks for CH | SQLConf.scala:6550 |

### spark.sql.pyspark (7)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.pyspark.dataSource.profiler | (none) | 4.2.0 | Configure the Python Data Source profiler by enabling or disabling it with the option to choose between \ and \ types, or unsetting the config disables the profiler. This | SQLConf.scala:4472 |
| spark.sql.pyspark.inferNestedDictAsStruct.enabled | false | 3.3.0 | PySpark's SparkSession.createDataFrame infers the nested dict as a map by default. When it set to true, it infers the nested dict as a struct. | SQLConf.scala:6626 |
| spark.sql.pyspark.jvmStacktrace.enabled | Utils.isTesting | 3.0.0 | When true, it shows the JVM stacktrace in the user-facing PySpark exception together with Python stacktrace. By default, it is disabled to hide JVM stacktrace and shows a | SQLConf.scala:4461 |
| spark.sql.pyspark.plotting.max_rows | 1000 | 4.0.0 | The visual limit on plots. If set to 1000 for top-n-based plots (pie, bar, barh), the first 1000 data points will be used for plotting. For sampled-based plots (scatter,  | SQLConf.scala:4543 |
| spark.sql.pyspark.toJSON.returnDataFrame | false | 4.2.0 | When true, DataFrame.toJSON in PySpark Classic returns a Dataframe instead of RDD. | SQLConf.scala:4454 |
| spark.sql.pyspark.udf.profiler | (none) | 4.0.0 | Configure the Python/Pandas UDF profiler by enabling or disabling it with the option to choose between \ and \ types, or unsetting the config disables the profiler. This  | SQLConf.scala:4483 |
| spark.sql.pyspark.worker.logging.enabled | false | 4.1.0 | When set to true, this configuration enables comprehensive logging within Python worker processes that execute User-Defined Functions (UDFs), User-Defined Table Functions | SQLConf.scala:4534 |

### spark.sql.queryExecutionListeners (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.queryExecutionListeners | (none) | 2.3.0 | List of class names implementing QueryExecutionListener that will be automatically added to newly created sessions. The classes should have either a no-arg constructor, o | StaticSQLConf.scala:155 |

### spark.sql.readSideCharPadding (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.readSideCharPadding | true | 3.4.0 | When true, Spark applies string padding when reading CHAR type columns/fields, in addition to the write-side padding. This config is true by default to better enforce CHA | SQLConf.scala:6568 |

### spark.sql.redaction (2)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.redaction.options.regex | "(?i)url".r | 2.2.2 | Regex to decide which keys in a Spark SQL command's options map contain sensitive information. The values of options whose names that match this regex will be redacted in | SQLConf.scala:4929 |
| spark.sql.redaction.string.regex | (fallback to org.apache.spark.internal.config.STRING_REDACTION_PATTERN) | 2.3.0 | Regex to decide which parts of strings produced by Spark contain sensitive information. When this regex matches a string part, that string part is replaced by a dummy val | SQLConf.scala:4939 |

### spark.sql.repl (3)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.repl.eagerEval.enabled | false | 2.4.0 | Enables eager evaluation or not. When true, the top K rows of Dataset will be displayed if and only if the REPL supports the eager evaluation. Currently, the eager evalua | SQLConf.scala:5549 |
| spark.sql.repl.eagerEval.maxNumRows | 20 | 2.4.0 | The max number of rows that are returned by eager evaluation. This only takes effect when ${REPL_EAGER_EVAL_ENABLED.key} is set to true. The valid range of this config is | SQLConf.scala:5560 |
| spark.sql.repl.eagerEval.truncate | 20 | 2.4.0 | The max number of characters for each cell that is returned by eager evaluation. This only takes effect when ${REPL_EAGER_EVAL_ENABLED.key} is set to true. | SQLConf.scala:5569 |

### spark.sql.scripting (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.scripting.enabled | true | 4.0.0 | SQL Scripting feature is under development and its use should be done under this feature flag. SQL Scripting enables users to write procedural SQL including control flow  | SQLConf.scala:4948 |

### spark.sql.session (3)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.session.localRelationCacheThreshold | 1024 * 1024 | 3.5.0 | The threshold for the size in bytes of local relations to be cached at the driver side after serialization. | SQLConf.scala:6828 |
| spark.sql.session.localRelationChunkSizeRows | 10000 | 4.1.0 | The chunk size in number of rows when splitting ChunkedCachedLocalRelation.data into batches. A new chunk is created when either spark.sql.session.localRelationChunkSizeB | SQLConf.scala:6847 |
| spark.sql.session.timeZone | (computed) | 2.2.0 | The ID of session local timezone in the format of either region-based zone IDs or zone offsets. Region IDs must have the form 'area/city', such as 'America/Los_Angeles'.  | SQLConf.scala:4157 |

### spark.sql.shuffle (3)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.shuffle.orderIndependentChecksum.enabled | true | 4.1.0 | Whether to calculate order independent checksum for the shuffle data or not. If enabled, Spark will calculate a checksum that is independent of the input row order for ea | SQLConf.scala:1008 |
| spark.sql.shuffle.orderIndependentChecksum.enableFullRetryOnMismatch | true | 4.1.0 | Whether to retry all tasks of a consumer stage when we detect checksum mismatches with its producer stages. | SQLConf.scala:1023 |
| spark.sql.shuffle.partitions | 200 | 1.1.0 | The default number of partitions to use when shuffling data for joins or aggregations. | SQLConf.scala:1000 |

### spark.sql.shuffleDependency (2)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.shuffleDependency.fileCleanup.enabled | Utils.isTesting | 4.0.0 | (Deprecated since Spark 4.1, please set 'spark.sql.connect.shuffleDependency.fileCleanup.enabled'.) | SQLConf.scala:4285 |
| spark.sql.shuffleDependency.skipMigration.enabled | Utils.isTesting | 4.0.0 | When enabled, shuffle dependencies for a Spark Connect SQL execution are marked at the end of the execution, and they will not be migrated during decommissions. | SQLConf.scala:4277 |

### spark.sql.shuffledHashJoinFactor (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.shuffledHashJoinFactor | 3 | 3.3.0 | The shuffle hash join can be selected if the data size of small side multiplied by this factor is still smaller than the large side. | SQLConf.scala:956 |

### spark.sql.sources (19)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.sources.bucketing.autoBucketedScan.enabled | true | 3.1.0 | When true, decide whether to do bucketed scan on input tables based on query plan automatically. Do not use bucketed scan if 1. query does not have operators to utilize b | SQLConf.scala:2290 |
| spark.sql.sources.bucketing.enabled | true | 2.0.0 | When false, we will treat bucketed table as normal table | SQLConf.scala:2144 |
| spark.sql.sources.bucketing.maxBuckets | 100000 | 2.4.0 | The maximum number of buckets allowed. | SQLConf.scala:2282 |
| spark.sql.sources.default | "parquet" | 1.3.0 | The default data source to use in input/output. | SQLConf.scala:2073 |
| spark.sql.sources.disabledJdbcConnProviderList | "" | 3.1.0 | Configures a list of JDBC connection providers, which are disabled. The list contains the name of the JDBC connection providers separated by comma. | StaticSQLConf.scala:301 |
| spark.sql.sources.parallelPartitionDiscovery.threshold | 32 | 1.5.0 | The maximum number of paths allowed for listing files at driver side. If the number of detected paths exceeds this value during partition discovery, it tries to list the  | SQLConf.scala:2400 |
| spark.sql.sources.partitionColumnTypeInference.enabled | true | 1.5.0 | When true, automatically infer the data types for partitioned columns. | SQLConf.scala:2138 |
| spark.sql.sources.partitionOverwriteMode | PartitionOverwriteMode.STATIC | 2.3.0 | When INSERT OVERWRITE a partitioned data source table, we currently support 2 modes: static and dynamic. In static mode, Spark deletes all the partitions that match the p | SQLConf.scala:5089 |
| spark.sql.sources.v2.bucketing.allowCompatibleTransforms.enabled | false | 4.0.0 | Whether to allow storage-partition join in the case where the partition transforms are compatible but not identical. This config requires both ${V2_BUCKETING_ENABLED.key} | SQLConf.scala:2207 |
| spark.sql.sources.v2.bucketing.allowJoinKeysSubsetOfPartitionKeys.enabled | false | 4.0.0 | Whether to allow storage-partition join in the case where join keys are a subset of the partition keys of the source tables. At planning time, Spark will group the partit | SQLConf.scala:2195 |
| spark.sql.sources.v2.bucketing.enabled | true | 3.3.0 | Similar to ${BUCKETING_ENABLED.key}, this config is used to enable bucketing for V2 data sources. When turned on, Spark will recognize the specific distribution reported  | SQLConf.scala:2150 |
| spark.sql.sources.v2.bucketing.partiallyClusteredDistribution.enabled | false | 3.4.0 | During a storage-partitioned join, whether to allow input partitions to be partially clustered, when both sides of the join are of KeyedPartitioning. At planning time, Sp | SQLConf.scala:2172 |
| spark.sql.sources.v2.bucketing.partition.filter.enabled | false | 4.0.0 | Whether to filter partitions when running storage-partition join. When enabled, partitions without matches on the other side can be omitted for scanning, if allowed by th | SQLConf.scala:2219 |
| spark.sql.sources.v2.bucketing.partitionKeyOrdering.enabled | false | 4.2.0 | When enabled, Spark derives output ordering from the partition key expressions of a V2 data source that reports a KeyedPartitioning but does not report explicit ordering  | SQLConf.scala:2240 |
| spark.sql.sources.v2.bucketing.preserveKeyOrderingOnCoalesce.enabled | false | 4.2.0 | When enabled, Spark preserves sort orders over partition key expressions when GroupPartitionsExec coalesces multiple input partitions into one output partition. Because a | SQLConf.scala:2252 |
| spark.sql.sources.v2.bucketing.preserveOrderingOnCoalesce.enabled | false | 4.2.0 | When turned on, GroupPartitionsExec will use sorted merge to preserve full ordering (as opposed to the key-derived ordering preserved by ${V2_BUCKETING_PRESERVE_KEY_ORDER | SQLConf.scala:2266 |
| spark.sql.sources.v2.bucketing.pushPartValues.enabled | true | 3.4.0 | Whether to pushdown common partition values when ${V2_BUCKETING_ENABLED.key} is enabled. When turned on, if both sides of a join are of KeyedPartitioning and if they shar | SQLConf.scala:2160 |
| spark.sql.sources.v2.bucketing.shuffle.enabled | false | 4.0.0 | During a storage-partitioned join, whether to allow to shuffle only one side. When only one side is KeyedPartitioning, if the conditions are met, spark will only shuffle  | SQLConf.scala:2185 |
| spark.sql.sources.v2.bucketing.sorting.enabled | false | 4.0.0 | When turned on, Spark will recognize the specific distribution reported by a V2 data source through SupportsReportPartitioning, and will try to avoid a shuffle if possibl | SQLConf.scala:2230 |

### spark.sql.stackTracesInDataFrameContext (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.stackTracesInDataFrameContext | 1 | 4.0.0 | The number of non-Spark stack traces in the captured DataFrame query context. | SQLConf.scala:7071 |

### spark.sql.statistics (4)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.statistics.fallBackToHdfs | false | 2.0.0 | When true, it will fall back to HDFS if the table statistics are not available from table metadata. This is useful in determining if a table is small enough to use broadc | SQLConf.scala:4022 |
| spark.sql.statistics.histogram.enabled | false | 2.3.0 | Generates histograms when computing column statistics if enabled. Histograms can provide better estimation accuracy. Currently, Spark only supports equi-height histogram. | SQLConf.scala:4043 |
| spark.sql.statistics.size.autoUpdate.enabled | false | 2.3.0 | Enables automatic update for table size once table's data is changed. Note that if the total number of files of the table is very large, this can be expensive and slow do | SQLConf.scala:4073 |
| spark.sql.statistics.updatePartitionStatsInAnalyzeTable.enabled | false | 4.0.0 | When this config is enabled, Spark will also update partition statistics in analyze table command (i.e., ANALYZE TABLE .. COMPUTE STATISTICS [NOSCAN]). Note the command w | SQLConf.scala:4082 |

### spark.sql.storeAssignmentPolicy (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.storeAssignmentPolicy | StoreAssignmentPolicy.ANSI | 3.0.0 | When inserting a value into a column with different data type, Spark will perform type coercion. Currently, we support 3 policies for the type coercion rules: ANSI, legac | SQLConf.scala:5152 |

### spark.sql.streaming (21)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.streaming.checkpointLocation | (none) | 2.0.0 | The default location for storing checkpoint data for streaming queries. | SQLConf.scala:3102 |
| spark.sql.streaming.continuous.epochBacklogQueueSize | 10000 | 3.0.0 | The max number of entries to be stored in queue to wait for late epochs. If this parameter is exceeded by the size of the queue, stream will stop with an error. | SQLConf.scala:5000 |
| spark.sql.streaming.disabledV2Writers | "" | 2.3.1 | A comma-separated list of fully qualified data source register class names for which StreamWriteSupport is disabled. Writes to these sources will fall back to the V1 Sink | SQLConf.scala:5042 |
| spark.sql.streaming.fileSource.cleaner.numThreads | 1 | 3.0.0 | Number of threads used in the file source completed file cleaner. | SQLConf.scala:3891 |
| spark.sql.streaming.forceDeleteTempCheckpointLocation | false | 3.0.0 | When true, enable temporary checkpoint locations force delete. | SQLConf.scala:3109 |
| spark.sql.streaming.metricsEnabled | false | 2.0.2 | Whether Dropwizard/Codahale metrics will be reported for active streaming queries. | SQLConf.scala:3939 |
| spark.sql.streaming.multipleWatermarkPolicy |  | 2.4.0 | Policy to calculate the global watermark value when there are multiple watermark operators in a streaming query. The default value is 'min' which chooses the minimum wate | SQLConf.scala:3748 |
| spark.sql.streaming.noDataMicroBatches.enabled | true | 2.4.1 | Whether streaming micro-batch engine will execute batches without data for eager state management for stateful streaming queries. | SQLConf.scala:3930 |
| spark.sql.streaming.numRecentProgressUpdates | 100 | 2.1.1 | The number of progress updates to retain for a streaming query | SQLConf.scala:3946 |
| spark.sql.streaming.sessionWindow.merge.sessions.in.local.partition | false | 3.2.0 | When true, streaming session window sorts and merge sessions in local partition prior to shuffle. This is to reduce the rows to shuffle, but only beneficial when there're | SQLConf.scala:3385 |
| spark.sql.streaming.stateStore.commitValidation.enabled | true | 4.1.0 | When true, Spark will validate that all StateStore instances have committed for stateful streaming queries using foreachBatch. This helps detect cases where user-defined  | SQLConf.scala:3290 |
| spark.sql.streaming.stateStore.encodingFormat | "unsaferow" | 4.0.0 | The encoding format used for stateful operators to store information in the state store | SQLConf.scala:3198 |
| spark.sql.streaming.stateStore.stateSchemaCheck | true | 3.1.0 | When true, Spark will validate the state schema against schema on existing state and fail query if it's incompatible. | SQLConf.scala:2890 |
| spark.sql.streaming.stopActiveRunOnRestart | true | 3.0.0 | Running multiple runs of the same streaming query concurrently is not supported. If we find a concurrent active run for a streaming query (in the same or different SparkS | SQLConf.scala:3351 |
| spark.sql.streaming.stopTimeout | 0 | 3.0.0 | How long to wait in milliseconds for the streaming execution thread to stop when calling the streaming query's stop() method. 0 or negative values wait indefinitely. | SQLConf.scala:3914 |
| spark.sql.streaming.streamingQueryListeners | (none) | 2.4.0 | List of class names implementing StreamingQueryListener that will be automatically added to newly created sessions. The classes should have either a no-arg constructor, o | StaticSQLConf.scala:164 |
| spark.sql.streaming.transformWithState.stateSchemaVersion | 3 | 4.0.0 | The version of the state schema used by the transformWithState operator | SQLConf.scala:3165 |
| spark.sql.streaming.ui.enabled | true | 3.0.0 | Whether to run the Structured Streaming Web UI for the Spark application when the Spark Web UI is enabled. | StaticSQLConf.scala:254 |
| spark.sql.streaming.ui.retainedProgressUpdates | 100 | 3.0.0 | The number of progress updates to retain for a streaming query for Structured Streaming UI. | StaticSQLConf.scala:262 |
| spark.sql.streaming.ui.retainedQueries | 100 | 3.0.0 | The number of inactive queries to retain for Structured Streaming UI. | StaticSQLConf.scala:270 |
| spark.sql.streaming.validateEventTimeWatermarkColumn | true | 4.2.0 | When true, check that eventTime in withWatermark is a top-level column. | SQLConf.scala:3765 |

### spark.sql.thriftServer (2)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.thriftServer.interruptOnCancel | (fallback to INTERRUPT_ON_CANCEL) | 3.2.0 | When true, all running tasks will be interrupted if one cancels a query. When false, all running tasks will remain until finished. | SQLConf.scala:2005 |
| spark.sql.thriftServer.queryTimeout | 0L | 3.1.0 | Set a query duration timeout in seconds in Thrift Server. If the timeout is set to a positive value, a running query will be cancelled automatically when the timeout is e | SQLConf.scala:2012 |

### spark.sql.thriftserver (4)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.thriftserver.scheduler.pool | (none) | 1.1.1 | Set a Fair Scheduler pool for a JDBC client session. | SQLConf.scala:1990 |
| spark.sql.thriftserver.shuffleDependency.fileCleanup.enabled | Utils.isTesting | 4.2.0 | When enabled, shuffle files will be cleaned up at the end of Thrift server SQL executions. | SQLConf.scala:4309 |
| spark.sql.thriftserver.ui.retainedSessions | 200 | 1.4.0 | The number of SQL client sessions kept in the JDBC/ODBC web UI history. | SQLConf.scala:2031 |
| spark.sql.thriftserver.ui.retainedStatements | 200 | 1.4.0 | The number of SQL statements kept in the JDBC/ODBC web UI history. | SQLConf.scala:2025 |

### spark.sql.timeTravelTimestampKey (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.timeTravelTimestampKey | "timestampAsOf" | 4.0.0 | The option name to specify the time travel timestamp when reading a table. | SQLConf.scala:6933 |

### spark.sql.timeTravelVersionKey (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.timeTravelVersionKey | "versionAsOf" | 4.0.0 | The option name to specify the time travel table version when reading a table. | SQLConf.scala:6940 |

### spark.sql.timestampType (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.timestampType | TimestampTypes.TIMESTAMP_LTZ | 3.4.0 | Configures the default timestamp type of Spark SQL, including SQL DDL, Cast clause, type literal and the schema inference of data sources. Setting the configuration as ${ | SQLConf.scala:5853 |

### spark.sql.transposeMaxValues (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.transposeMaxValues | 500 | 4.0.0 | When doing a transpose without specifying values for the index column this is the maximum number of values that will be transposed without error. | SQLConf.scala:2539 |

### spark.sql.tvf (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.tvf.allowMultipleTableArguments.enabled | false | 3.5.0 | When true, allows multiple table arguments for table-valued functions, receiving the cartesian product of all the rows of these tables. | SQLConf.scala:4382 |

### spark.sql.udt (2)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.udt.allowCreatingUDTFromString | true | 4.1.3 | When true, Spark loads and instantiates the UserDefinedType class named in a schema string (for example the schema stored in Parquet/ORC file metadata) while inferring or | SQLConf.scala:254 |
| spark.sql.udt.allowedDynamicUDTClasses | Nil | 4.1.3 | When '${SqlApiConfHelper.ALLOW_CREATING_UDT_FROM_STRING}' is false, UserDefinedType classes listed here (by fully qualified class name) may still be loaded and instantiat | SQLConf.scala:267 |

### spark.sql.ui (2)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.ui.explainMode | "formatted" | 3.1.0 | Configures the query explain mode used in the Spark SQL UI. The value can be 'simple', 'extended', 'codegen', 'cost', or 'formatted'. The default value is 'formatted'. | SQLConf.scala:5874 |
| spark.sql.ui.retainedExecutions | 1000 | 1.5.0 | Number of executions to retain in the Spark UI. | StaticSQLConf.scala:174 |

### spark.sql.variable (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.variable.substitute | true | 2.0.0 | This enables substitution using syntax like `${var}`, `${system:var}`, and `${env:var}`. | SQLConf.scala:3552 |

### spark.sql.warehouse (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.warehouse.dir | Utils.resolveURI("spark-warehouse").toString | 2.0.0 | The default location for managed databases and tables. | StaticSQLConf.scala:35 |

### spark.sql.window (2)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.window.segmentTree.blockSize | 65536 | 4.2.0 | Block size, in rows, for the block-chunked segment tree used by moving window frames. Each leaf of the tree aggregates this many consecutive rows. Smaller values reduce p | SQLConf.scala:4223 |
| spark.sql.window.segmentTree.enabled | false | 4.2.0 | Use block-chunked segment tree for moving aggregate window frames whose functions are all DeclarativeAggregate without FILTER/DISTINCT. | SQLConf.scala:4203 |

### spark.sql.xml (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.sql.xml.variant.respectInferSchema | true | 4.1.0 | Kill switch for the SPARK-56554 fix. When true (default), the XML to Variant parser honors the 'inferSchema' option: if 'inferSchema' is false, primitive leaf values (tex | SQLConf.scala:7358 |

### spark.stage (3)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.stage.ignoreDecommissionFetchFailure | true | 3.4.0 | Whether ignore stage fetch failure caused by executor decommission when count ${STAGE_MAX_CONSECUTIVE_ATTEMPTS.key} | package.scala:2601 |
| spark.stage.maxAttempts | Int.MaxValue | 3.5.0 | Specify the max attempts for a stage - the spark job will be aborted if any of its stages is resubmitted multiple times beyond the max retries limitation. The maximum num | package.scala:2868 |
| spark.stage.maxConsecutiveAttempts | 4 | 2.2.0 | Number of consecutive stage attempts allowed before a stage is aborted. | package.scala:2594 |

### spark.standalone (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.standalone.submit.waitAppCompletion | false | 3.1.0 | In standalone cluster mode, controls whether the client waits to exit until the application completes. If set to true, the client process will stay alive polling the driv | package.scala:2559 |

### spark.storage (22)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.storage.blockManagerHeartbeatTimeoutMs | (none) | 0.7.0 |  | package.scala:685 |
| spark.storage.blockManagerMasterDriverHeartbeatTimeoutMs | 10m | 3.2.0 | A timeout used for block manager master's driver heartbeat endpoint. | package.scala:678 |
| spark.storage.blockManagerTimeoutIntervalMs | 60s | 0.7.3 |  | package.scala:672 |
| spark.storage.cachedPeersTtl | 60 * 1000 | 1.1.1 |  | package.scala:555 |
| spark.storage.cleanupFilesAfterExecutorExit | true | 2.4.0 | Whether or not cleanup the files not served by the external shuffle service on executor exits. | package.scala:692 |
| spark.storage.decommission.enabled | false | 3.1.0 | Whether to decommission the block manager when decommissioning executor | package.scala:567 |
| spark.storage.decommission.fallbackStorage.cleanUp | false | 3.2.0 | If true, Spark cleans up its fallback storage data once individual shuffles are freed (interval configured via spark.cleaner.periodicGC.interval), and during shutting dow | package.scala:618 |
| spark.storage.decommission.fallbackStorage.path | (none) | 3.1.0 | The location for fallback storage during block manager decommissioning. For example, `s3a://spark-storage/`. In case of empty, fallback storage is disabled. The storage w | package.scala:627 |
| spark.storage.decommission.rddBlocks.enabled | true | 3.1.0 | Whether to transfer RDD blocks during block manager decommissioning. | package.scala:590 |
| spark.storage.decommission.shuffleBlocks.enabled | true | 3.1.0 | Whether to transfer shuffle blocks during block manager decommissioning. Requires a migratable shuffle resolver (like sort based shuffle) | package.scala:574 |
| spark.storage.decommission.shuffleBlocks.maxDiskSize | (none) | 3.2.0 | Maximum disk space to use to store shuffle blocks before rejecting remote shuffle blocks. Rejecting remote shuffle blocks means that an executor will not receive any shuf | package.scala:639 |
| spark.storage.decommission.shuffleBlocks.maxThreads | 8 | 3.1.0 | Maximum number of threads to use in migrating shuffle files. | package.scala:582 |
| spark.storage.exceptionOnPinLeak | false | 1.6.2 |  | package.scala:666 |
| spark.storage.localDiskByExecutors.cacheSize | 1000 | 3.0.0 | The max number of executors for which the local dirs are stored. This size is both applied for the driver and both for the executors side to avoid having an unbounded sto | package.scala:1851 |
| spark.storage.maxReplicationFailures | 1 | 1.1.1 |  | package.scala:561 |
| spark.storage.memoryMapThreshold | 2m | 0.9.2 | Size in bytes of a block above which Spark memory maps when reading a block from disk. This prevents Spark from memory mapping very small blocks. In general, memory mappi | package.scala:533 |
| spark.storage.replication.policy |  | 2.1.0 |  | package.scala:544 |
| spark.storage.replication.proactive | true | 2.2.0 | Enables proactive block replication for RDD blocks. Cached RDD block replicas lost due to executor failures are replenished if there are any existing available replicas.  | package.scala:523 |
| spark.storage.replication.topologyFile | (none) | 2.1.0 |  | package.scala:660 |
| spark.storage.replication.topologyMapper |  | 2.1.0 |  | package.scala:550 |
| spark.storage.shuffleManager.initWaitingTimeout | 30s | 4.2.0 | Maximum time to wait for the ShuffleManager to be initialized when receiving shuffle migration requests. If the ShuffleManager is not initialized within this timeout, the | package.scala:650 |
| spark.storage.unrollMemoryThreshold | 1024 * 1024 | 1.1.0 | Initial memory to request before unrolling any block | package.scala:516 |

### spark.streaming (7)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.streaming.dynamicAllocation.enabled | false | 3.0.0 |  | Streaming.scala:25 |
| spark.streaming.dynamicAllocation.maxExecutors | Int.MaxValue | 3.0.0 |  | Streaming.scala:45 |
| spark.streaming.dynamicAllocation.minExecutors | (none) | 3.0.0 |  | Streaming.scala:37 |
| spark.streaming.dynamicAllocation.scalingDownRatio | 0.3 | 3.0.0 |  | Streaming.scala:69 |
| spark.streaming.dynamicAllocation.scalingInterval | 60 | 3.0.0 |  | Streaming.scala:53 |
| spark.streaming.dynamicAllocation.scalingUpRatio | 0.9 | 3.0.0 |  | Streaming.scala:61 |
| spark.streaming.dynamicAllocation.testing | false | 3.0.0 |  | Streaming.scala:31 |

### spark.submit (3)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.submit.callSystemExitOnMainExit | false | 4.1.0 | If true, SparkSubmit will call System.exit() to initiate JVM shutdown once the user's main method has exited. This can be useful in cases where non-daemon JVM threads mig | package.scala:2359 |
| spark.submit.deployMode | "client" | 1.5.0 |  | package.scala:2347 |
| spark.submit.pyFiles | Nil | 1.0.1 |  | package.scala:2352 |

### spark.task (7)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.task.cpus | 1 | 0.5.0 |  | package.scala:724 |
| spark.task.maxDirectResultSize | 1L << 20 | 2.0.0 |  | package.scala:933 |
| spark.task.maxFailures | 4 | 0.8.0 |  | package.scala:941 |
| spark.task.reaper.enabled | false | 2.0.3 |  | package.scala:947 |
| spark.task.reaper.killTimeout | -1 | 2.0.3 |  | package.scala:953 |
| spark.task.reaper.pollingInterval | 10s | 2.0.3 |  | package.scala:959 |
| spark.task.reaper.threadDump | true | 2.0.3 |  | package.scala:965 |

### spark.taskMetrics (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.taskMetrics.trackUpdatedBlockStatuses | false | 2.3.0 | Enable tracking of updatedBlockStatuses in the TaskMetrics. Off by default since tracking the block statuses can use a lot of memory and its not used anywhere within spar | package.scala:1505 |

### spark.test (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.test.noStageRetry | false | 1.2.0 |  | Tests.scala:49 |

### spark.testing (11)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.testing | (none) | 1.0.1 |  | Tests.scala:37 |
| spark.testing.dynamicAllocation.schedule.enabled | true | 3.1.0 |  | Tests.scala:32 |
| spark.testing.injectShuffleFetchFailures | false |  | Injecting fetch failures for shuffle stages by providing an invalid BlockManager location for the first stage attempt. Testing only flag! | Tests.scala:43 |
| spark.testing.memory | Runtime.getRuntime.maxMemory | 1.6.0 |  | Tests.scala:26 |
| spark.testing.nCoresPerExecutor | 2 | 3.0.0 |  | Tests.scala:69 |
| spark.testing.nExecutorsPerHost | 4 | 3.0.0 |  | Tests.scala:64 |
| spark.testing.nHosts | 5 | 3.0.0 |  | Tests.scala:59 |
| spark.testing.reservedMemory | (none) | 1.6.0 |  | Tests.scala:54 |
| spark.testing.resourceProfileManager | false | 3.1.0 |  | Tests.scala:80 |
| spark.testing.skipESSRegister | false | 4.0.0 | None of Spark testing modes (local, local-cluster) enables shuffle service. So it is hard to test ${SHUFFLE_SERVICE_ENABLED.key} when you only want to test this flag but  | Tests.scala:95 |
| spark.testing.skipValidateCores | false | 3.1.0 |  | Tests.scala:90 |

### spark.ui (36)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.ui.allowFramingFrom | (none) | 1.6.0 |  | UI.scala:58 |
| spark.ui.consoleProgress.update.interval | 200 | 2.1.0 |  | UI.scala:34 |
| spark.ui.contentSecurityPolicy.enabled | false | 4.2.0 | Whether to set the HTTP Content-Security-Policy (CSP) response header for the Spark UI. When enabled, CSP restricts the sources from which the browser is allowed to load  | UI.scala:140 |
| spark.ui.custom.executor.log.url | (none) | 3.0.0 | Specifies custom spark executor log url for supporting external log service instead of using cluster managers' application log urls in the Spark UI. Spark will support so | UI.scala:243 |
| spark.ui.dagGraph.retainedRootRDDs | Int.MaxValue | 2.1.0 |  | Status.scala:61 |
| spark.ui.enabled | true | 1.1.1 | Whether to run the web UI for the Spark application. | UI.scala:39 |
| spark.ui.filters | Nil | 1.0.0 | Comma separated list of filter class names to apply to the Spark Web UI. | UI.scala:51 |
| spark.ui.groupSQLSubExecutionEnabled | true | 3.4.0 | Whether to group sub executions together in SQL UI when they belong to the same root execution | UI.scala:281 |
| spark.ui.heapHistogramEnabled | true | 3.5.0 | Whether to show a link for executor heap histogram in Executor page. | UI.scala:107 |
| spark.ui.killEnabled | true | 1.0.0 | Allows jobs and stages to be killed from the web UI. | UI.scala:89 |
| spark.ui.liveUpdate.minFlushPeriod | 1s | 2.4.2 | Minimum time elapsed before stale UI data is flushed. This avoids UI staleness when incoming task events are not fired frequently. | Status.scala:34 |
| spark.ui.liveUpdate.period | 100ms | 2.3.0 |  | Status.scala:29 |
| spark.ui.port | 4040 | 0.7.0 | Port for your application's dashboard, which shows memory and workload data. | UI.scala:45 |
| spark.ui.proxyRedirectUri | (none) | 3.0.0 | Proxy address to use when responding with HTTP redirects. | UI.scala:237 |
| spark.ui.requestHeaderSize | 8k | 2.2.3 | Value for HTTP request header size in bytes. | UI.scala:149 |
| spark.ui.retainedDeadExecutors | 100 | 2.0.0 |  | Status.scala:56 |
| spark.ui.retainedJobs | 1000 | 1.2.0 |  | Status.scala:41 |
| spark.ui.retainedStages | 1000 | 0.9.0 |  | Status.scala:46 |
| spark.ui.retainedTasks | 100000 | 2.0.1 |  | Status.scala:51 |
| spark.ui.reverseProxy | false | 2.1.0 | Enable running Spark Master as reverse proxy for worker and application UIs. In this mode, Spark master will reverse proxy the worker and application UIs to enable access | UI.scala:63 |
| spark.ui.reverseProxyUrl | (none) | 2.1.0 | This is the URL where your proxy is running. This URL is for proxy which is running in front of Spark Master. This is useful when running proxy for authentication e.g. OA | UI.scala:75 |
| spark.ui.showConsoleProgress | false | 1.2.1 | When true, show the progress bar in the console. | UI.scala:27 |
| spark.ui.showErrorStacks | true | 4.2.0 | Whether to display stack traces in the UI error pages. | UI.scala:296 |
| spark.ui.store.path | (none) | 3.4.0 | Local directory where to cache application information for live UI. By default this is not set, meaning all application information will be kept in memory. | Status.scala:74 |
| spark.ui.strictTransportSecurity | (none) | 2.3.0 | Value for HTTP Strict Transport Security Response Header | UI.scala:133 |
| spark.ui.threadDump.flamegraphEnabled | true | 4.0.0 | Whether to render the Flamegraph for executor thread dumps | UI.scala:101 |
| spark.ui.threadDumpsEnabled | true | 1.2.0 | Whether to show a link for executor thread dumps in Stages and Executor pages. | UI.scala:95 |
| spark.ui.timeline.executors.maximum | 250 | 3.2.0 |  | UI.scala:186 |
| spark.ui.timeline.jobs.maximum | 500 | 3.2.0 |  | UI.scala:176 |
| spark.ui.timeline.stages.maximum | 500 | 3.2.0 |  | UI.scala:181 |
| spark.ui.timeline.tasks.maximum | 1000 | 1.4.0 |  | UI.scala:171 |
| spark.ui.timelineEnabled | true | 3.4.0 | Whether to display event timeline data on UI pages. | UI.scala:165 |
| spark.ui.view.acls | Nil | 1.0.0 |  | UI.scala:196 |
| spark.ui.view.acls.groups | Nil | 2.0.0 |  | UI.scala:202 |
| spark.ui.xContentTypeOptions.enabled | true | 2.3.0 | Set to 'true' for setting X-Content-Type-Options HTTP response header to 'nosniff' | UI.scala:127 |
| spark.ui.xXssProtection | 1; mode=block | 2.3.0 | Value for HTTP X-XSS-Protection response header | UI.scala:121 |

### spark.user (1)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.user.groups.mapping | "org.apache.spark.security.ShellBasedGroupsMappingProvider" | 2.0.0 |  | UI.scala:232 |

### spark.worker (11)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.worker.cleanup.appDataTtl | 7 * 24 * 3600 | 1.0.0 |  | Worker.scala:72 |
| spark.worker.cleanup.enabled | true | 1.0.0 |  | Worker.scala:62 |
| spark.worker.cleanup.interval | 60 * 30 | 1.0.0 |  | Worker.scala:67 |
| spark.worker.decommission.signal | PWR | 3.2.0 | The signal that used to trigger the worker to start decommission. | Worker.scala:104 |
| spark.worker.driverTerminateTimeout | 10s | 2.1.2 |  | Worker.scala:57 |
| spark.worker.preferConfiguredMasterAddress | false | 2.2.1 |  | Worker.scala:77 |
| spark.worker.timeout | 60 | 0.6.2 |  | Worker.scala:35 |
| spark.worker.ui.compressedLogFileLengthCacheSize | 100 | 2.0.2 |  | Worker.scala:98 |
| spark.worker.ui.port | (none) | 1.1.0 |  | Worker.scala:82 |
| spark.worker.ui.retainedDrivers | 1000 | 1.5.0 |  | Worker.scala:92 |
| spark.worker.ui.retainedExecutors | 1000 | 1.5.0 |  | Worker.scala:87 |

### spark.yarn (3)

| key | default | since | doc | source |
|---|---|---|---|---|
| spark.yarn.dist.forceDownloadSchemes | Nil | 2.3.0 | Comma-separated list of schemes for which resources will be downloaded to the local disk prior to being added to YARN's distributed cache. For use in cases where the YARN | package.scala:1597 |
| spark.yarn.kerberos.renewal.excludeHadoopFileSystems | Nil | 3.2.0 | The list of Hadoop filesystem URLs whose hosts will be excluded from delegation token renewal at resource scheduler. Currently this is known to work under YARN, so YARN R | package.scala:909 |
| spark.yarn.stagingDir | (none) | 2.0.0 | Staging directory used while submitting applications. | package.scala:2535 |

