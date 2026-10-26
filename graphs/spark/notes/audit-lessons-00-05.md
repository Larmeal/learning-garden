# Audit of lessons 00-05 (Spark 4.2.0)

Method: claims in the lesson text were checked against the Spark source (commit 32f72996,
tag v4.2.0) and against real behavior with PySpark 4.2.0 from this project's venv on the
author's Windows machine. Scripts used live in the session scratchpad, not in this repo.
Lesson files are read only here: nothing in `site/` was changed.

## Confirmed (no change needed)

| Lesson | Claim | Evidence |
|---|---|---|
| 05 | `spark.sql.shuffle.partitions` defaults to 200 | `SQLConf.scala:1000` (createWithDefault(200)); runtime conf = 200 |
| 05 | AQE may coalesce small partitions at run time | `spark.sql.adaptive.enabled` default true (`SQLConf.scala:1050`), `coalescePartitions.enabled` default true (`SQLConf.scala:1102`). Run: groupBy result has 1 partition with AQE on, 200 with AQE off |
| 05 | `explain()` of a groupBy shows `Exchange hashpartitioning(...)` | Run: `Exchange hashpartitioning(_groupingexpression, 200), ENSURE_REQUIREMENTS`. A plain `filter` plan has no Exchange |
| 01 | local[*] gives defaultParallelism equal to core count | Run: `local[*] 16 4.2.0`, os.cpu_count() = 16 |
| 00 | `spark.range(1_000_000)` has 16 partitions (splits=16 in explain) | Run: 16, and `Range (0, 1000000, step=1, splits=16)` in the plan |
| 01 | PySpark talks to the JVM through Py4J | Run: session class is `pyspark.sql.session.SparkSession` (classic), writes fail with Py4JJavaError |
| 02 | ANSI mode is the default in Spark 4, so cast("abc" as int) raises | `SQLConf.scala:5180`: default is true unless env `SPARK_ANSI_SQL_MODE=false`. Run: error contains CAST_INVALID_INPUT |
| 02 | With ANSI off the result is NULL | Run: `1`, `NULL`. See the caveat below |
| 02 | `cache()` is lazy | Run: `is_cached` is True right after `cache()`, data is materialized by the first action (storage level Disk Memory Deserialized 1x) |
| 03 | `F.col("x") == None` filters out every row, `isNull()` works | Run: 0 rows vs 1 row |
| 03 | The jp/sg/th aggregation table with NULL | Run output identical to the lesson |
| 03 | `show()` prints 20 rows by default | `python/pyspark/sql/dataframe.py:941` (n=20), Scala `Dataset.scala:467` |
| 04 | write.mode values error (default), overwrite, append, ignore | Standard SaveMode set; not re-run |
| 04 | PySpark 4.2.0 bundles Hadoop 3.5.0 | venv jars: `hadoop-client-api-3.5.0.jar`, `hadoop-client-runtime-3.5.0.jar` |
| 04 | Windows parquet write fails with `NativeIO$Windows.access0` UnsatisfiedLinkError; `HADOOP_HOME/bin` has only winutils.exe | Run: write fails with UnsatisfiedLinkError mentioning NativeIO; `C:\Spark\winutils\bin` contains only winutils.exe. The cause (missing hadoop.dll) is still untested, as the lesson says |

## Suggestions (accuracy or clarity, optional)

1. Lesson 02, ANSI note: "if you turn the mode off the result is NULL" is only true when
   `spark.sql.ansi.enabled` is changed **before** the DataFrame is defined. Run: after the
   DataFrame was created with ANSI on, setting it to false and calling `show()` still raises
   (the cast mode is fixed at analysis time). A reader who tries the experiment in the other
   order will be confused.
2. Lesson 05, step 3: the observed number can be added. On a 16 core machine with a tiny
   range, the final plan after AQE has 1 partition; with `spark.sql.adaptive.enabled=false`
   it has 200. Also `explain()` starts with `AdaptiveSparkPlan isFinalPlan=false` when AQE is
   on, which readers will see and may wonder about (chapter 6 can explain it).
3. Lesson 04 Windows note: mentions Hadoop 3.5.0 correctly. If you ever get `hadoop.dll`,
   record the result, since the note says the cause is unconfirmed.

## Not checked

- Interactive components (ShuffleDemo, SkewDemo, LazyLab, QueryLab, PruneLab, FormatLab,
  ArchitectureLab, ErrorTiming): only the text around them was read.
- The quiz pages of lessons 00-04 (moved to separate pages in a recent commit).
- Lesson 00 table of CSV vs Parquet read amounts (concept, not run).
