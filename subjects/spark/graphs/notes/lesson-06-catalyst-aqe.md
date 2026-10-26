# Evidence note: lesson 06 "Catalyst, AQE, explain()"

Spark 4.2.0, source checkout `E:\Development\Project\open-source\spark` at commit 32f72996 (not modified).
Behavior runs: PySpark 4.2.0 from `E:\Development\Project\learning\.venv`, `local[*]`, 16 cores
(`defaultParallelism` = 16), ANSI default on. Scripts lived in the session scratchpad, not in this repo.
Paths below are relative to the Spark checkout unless marked "run". `sql/` prefixes are kept in full.
Abbreviations: `SQLConf` = `sql/catalyst/src/main/scala/org/apache/spark/sql/internal/SQLConf.scala`,
`QE` = `sql/core/src/main/scala/org/apache/spark/sql/execution/QueryExecution.scala`,
`ASPE` = `sql/core/src/main/scala/org/apache/spark/sql/execution/adaptive/AdaptiveSparkPlanExec.scala`,
`Opt` = `sql/catalyst/src/main/scala/org/apache/spark/sql/catalyst/optimizer/Optimizer.scala`.

Lesson context read: stub `catalyst-aqe.mdx` (order 6, phase B, level 4, requires lazy-evaluation and
dataframe-sql, stage seed, bullets: logical/optimized/physical plans, predicate pushdown + column pruning,
read `explain()` formatted, AQE coalesce / join strategy / skew, Tungsten short). `execution-model.mdx`
(lesson 05) already taught job/stage/task, `Exchange hashpartitioning`, 200 shuffle partitions, "AQE may
coalesce", and promised "salting and AQE are in chapter 7" (performance-tuning). `dataframe-sql` already
says both APIs go to the same optimizer "Catalyst, chapter 6". Audit of lessons 00-05 (`subjects/spark/graphs/notes/audit-lessons-00-05.md`)
already noted that readers will see `AdaptiveSparkPlan isFinalPlan=false` and chapter 6 should explain it.
Tone: Thai prose, short sections, tables, a "try it in this repo" block with `get_spark(...)`, `explain()`.

---------------------------------------------------------------------------------------------------

## 1. Scope: claims this lesson should teach, in order

1. A query goes through fixed phases: parse, analyze, optimize (Catalyst logical rules), plan (physical),
   prepare for execution. Each phase is lazy and cached inside one `QueryExecution`. (Section 3, section 2.1)
2. `explain(True)` prints four plans: Parsed (unresolved, with a quote mark on names), Analyzed (types and
   `#id` attribute ids resolved), Optimized (after rules), Physical (operators that run). (2.1)
3. Optimizer rules are rewrites in batches, run once or until nothing changes. Examples with proof from
   the plan-change log: constant folding, boolean simplification, view/alias removal, predicate pushdown,
   column pruning, project collapse. (2.2, 2.3)
4. Predicate pushdown and column pruning down to the scan: `PushedFilters` and `ReadSchema` in a file scan.
   Filter pushed through join (and inferred to the other side). (2.3, 2.4)
5. Join choice: rule-based `ReorderJoin` avoids cross products; cost-based reorder is OFF by default;
   physical join is chosen by size (`spark.sql.autoBroadcastJoinThreshold`, 10MB) or by hint. (2.5)
6. Reading `explain("formatted")`: numbered operator tree on top, numbered detail blocks below; `*` /
   `codegen id` marks whole-stage codegen (Tungsten short). Other modes: simple, extended, codegen, cost. (2.1, 2.9)
7. AQE defaults and what it is: `spark.sql.adaptive.enabled=true`; the plan is cut at shuffles into query
   stages, the stages run, real sizes are read, and the rest is re-optimized. (2.6, 3.3)
8. `AdaptiveSparkPlan isFinalPlan=false` before the action, `isFinalPlan=true` plus "Final Plan" and
   "Initial Plan" after the same DataFrame ran. Only the DataFrame object that ran is updated. (2.6)
9. Coalescing small shuffle partitions: observed 200 (AQE off) vs 1 (AQE on) for a tiny groupBy; knobs and
   defaults. (2.7)
10. Runtime join strategy change: sort-merge join to broadcast hash join + local shuffle read, with the
    "many empty partitions" exception. (2.8)
11. Skew join: config names and defaults; observed `SortMergeJoin(skew=true)` and 23 vs 8 vs 1 partitions. (2.8)
12. Tungsten, briefly: whole-stage codegen (`*(n)`), `UnsafeRow` binary rows, off-heap off by default. (2.9)

---------------------------------------------------------------------------------------------------

## 2. Verified facts, source references, and real output

### 2.1 The four plans and explain modes

Facts
- `explain` in PySpark prints (returns None): `python/pyspark/sql/classic/dataframe.py:227-282`. Argument forms:
  none -> "simple"; `True` -> "extended"; `False` -> "simple"; a string -> that mode (`explain("formatted")`
  or `explain(mode="formatted")`); passing both `extended` and `mode` is an error (lines 230-233, 272-282).
  The JVM side: `QE:488-507` (`SimpleMode`, `ExtendedMode`, `CodegenMode`, `CostMode`, `FormattedMode`).
- The four sections of extended mode are written by `QE:509-531` (`writePlans`): Parsed (`logical`), Analyzed
  (`analyzed`), Optimized (`optimizedPlan`), Physical (`executedPlan`).
- Run: `explain()` triggers 0 Spark jobs (job count 0 after defining the DataFrame and after two explain calls;
  2 jobs only after `collect()` with AQE on).

Run, query: `spark.range(1000).withColumn("x", F.col("id")*2 + (1+2)).filter("id > 10 AND 1 = 1")`
(note: Python computed `1+2` itself, so the 3 is not a Catalyst fold here; the `1 = 1` removal is Catalyst):

```
== Parsed Logical Plan ==
'Filter (('id > 10) AND (1 = 1))
+- Project [id#0L, ((id#0L * cast(2 as bigint)) + cast(3 as bigint)) AS x#1L]
   +- Range (0, 1000, step=1, splits=Some(16))

== Analyzed Logical Plan ==
id: bigint, x: bigint
Filter ((id#0L > cast(10 as bigint)) AND (1 = 1))
+- Project [id#0L, ((id#0L * cast(2 as bigint)) + cast(3 as bigint)) AS x#1L]
   +- Range (0, 1000, step=1, splits=Some(16))

== Optimized Logical Plan ==
Project [id#0L, ((id#0L * 2) + 3) AS x#1L]
+- Filter (id#0L > 10)
   +- Range (0, 1000, step=1, splits=Some(16))

== Physical Plan ==
*(1) Project [id#0L, ((id#0L * 2) + 3) AS x#1L]
+- *(1) Filter (id#0L > 10)
   +- *(1) Range (0, 1000, step=1, splits=16)
```

What to point out: the quote in `'Filter ('id` means unresolved; `cast(10 as bigint)` appears after analysis
(type coercion); `1 = 1` is gone and `cast(2 as bigint)` became `2` after optimization; the Filter moved
below the Project (pushdown).

`explain("formatted")` for the same query (run):

```
== Physical Plan ==
* Project (3)
+- * Filter (2)
   +- * Range (1)


(1) Range [codegen id : 1]
Output [1]: [id#0L]
Arguments: Range (0, 1000, step=1, splits=Some(16))

(2) Filter [codegen id : 1]
Input [1]: [id#0L]
Condition : (id#0L > 10)

(3) Project [codegen id : 1]
Output [2]: [id#0L, ((id#0L * 2) + 3) AS x#1L]
Input [1]: [id#0L]
```

Formatted mode prints ONLY the physical plan (tree with numbers, then one block per operator). It does not
print Parsed/Analyzed/Optimized; use `explain(True)` for those. Plain `explain()` prints only the physical
plan in the compact form `*(1) Project [...]`.

Naming trap (run): a scan is `Scan csv` in formatted mode but `FileScan csv` in the tree/extended mode for the
same query (formatted uses node name, tree uses simpleString).

SQL and DataFrame give the same optimized plan (run, same query written both ways, expression ids stripped):
optimized plans were identical (`SAME_OPTIMIZED True`):

```
Aggregate [country#N], [country#N, sum(amt#N) AS total#N]
+- Project [country#N, amt#N]
   +- Filter (isnotnull(amt#N) AND (amt#N > 5.0))
      +- LogicalRDD [id#N, country#N, amt#N], false
```
but the Parsed plans differ (SQL: `'Filter ('amt > 5)` over `'UnresolvedRelation [o]`; DataFrame: already
resolved `Filter (amt#N > cast(5 as double))` over `SubqueryAlias o`, because DataFrame transformations analyze
eagerly). Supports the line in lesson 02/03 "both go to the same optimizer".

### 2.2 Optimizer rules with proof of who did what

Run, SQL: `CREATE TEMP VIEW v AS SELECT id, id*2 AS dbl FROM nums` (nums = range(1000)), then
`SELECT id + (1 + 2) AS x FROM v WHERE 1 = 1 AND id > 10`. Optimized result:

```
Project [(id#0L + 3) AS x#2L]
+- Filter (id#0L > 10)
   +- Range (0, 1000, step=1, splits=Some(16))
```
Rule trace (`spark.sql.planChangeLog.level=WARN`, batch "Operator Optimization before Inferring Filters",
order of effective rules in the log):

| step | rule | effect shown in log |
|---|---|---|
| 0 | `FinishAnalysis` (batch "Finish Analysis") | removed `SubqueryAlias v`, `View`, `SubqueryAlias nums`, `View` nodes |
| 1 | `PushDownPredicates` | Filter moved from above two Projects to directly above Range |
| 2 | `ColumnPruning` | dropped unused `dbl` column from the Projects |
| 3 | `CollapseProject` | merged the stacked Projects into one |
| 4 | `ConstantFolding` | `cast((1 + 2) as bigint)` -> `3`; `1 = 1` -> `true` |
| 5 | `BooleanSimplification` | `true AND (id > 10)` -> `id > 10` |
| 6 | `SimplifyCasts` | removed no-op `cast(id as bigint)` (id is already bigint) |

Teaching point: `1 = 1` is removed by two rules in a row (fold, then simplify), not one. The whole trace is a
good "optimizer is a pipeline of small rewrites" illustration.

Source for rules (line = `object` definition): `ConstantFolding` `sql/catalyst/.../optimizer/expressions.scala:50`;
`BooleanSimplification` `expressions.scala:392`; `SimplifyCasts` `expressions.scala:1155`; `ColumnPruning`
`Opt:1077`; `CollapseProject` `Opt:1232`; `PruneFilters` `Opt:2041`; `PushDownPredicates` `Opt:2078`
(chains `CombineFilters` `Opt:1925`, `PushPredicateThroughNonJoin` `Opt:2094`, `PushPredicateThroughJoin`
`Opt:2355`); `InferFiltersFromConstraints` `Opt:1771`; `ReorderJoin` `sql/catalyst/.../optimizer/joins.scala:45`;
`CostBasedJoinReorder` `sql/catalyst/.../optimizer/CostBasedJoinReorder.scala:36`. These match
`subjects/spark/graphs/index/rules.md`. `FinishAnalysis` is listed in `Opt:177` as `Batch("Finish Analysis", FixedPoint(1), FinishAnalysis)`.

ANSI mode does NOT change the optimized plan text of casts (run, ANSI true vs false, both): analyzed plan
shows `cast(s#0 as int)` and `cast(12 as int) + 1` folds to `13` in both modes; `try_cast(s#0 as int)` shows
as `try_cast`. The difference is at run time: ANSI on -> `CAST_INVALID_INPUT` error for 'abc'; ANSI off ->
`[Row(i=1), Row(i=None)]`. Also visible only in generated code: `explain("codegen")` of `a_id + 1` contains
`MathUtils.addExact(...)` with ANSI on and no `addExact` with ANSI off (run, string search). The mode is
fixed when the DataFrame is analyzed: set ANSI true, build the DF, set ANSI false, `collect()` still raised
CAST_INVALID_INPUT (run). Default: `SQLConf:5180`, `createWithDefault(!sys.env.get("SPARK_ANSI_SQL_MODE").contains("false"))`.
Type-coercion rule set depends on ANSI: `Analyzer.scala:506-510` (`AnsiTypeCoercion` vs `TypeCoercion`).

### 2.3 Predicate pushdown and column pruning down to the scan

CSV written by Python's `csv` module (no Spark write), read with
`spark.read.option("header",True).option("inferSchema",True).csv(path)`, view `orders` (4 columns id, name,
amount, country, 1000 rows). Query `SELECT name FROM orders WHERE amount > 100 AND country = 'th'`:

```
== Optimized Logical Plan ==
Project [name#18]
+- Filter ((isnotnull(amount#19) AND isnotnull(country#20)) AND ((amount#19 > 100.0) AND (country#20 = th)))
   +- Relation [id#17,name#18,amount#19,country#20] csv

== Physical Plan ==
*(1) Project [name#18]
+- *(1) Filter (((isnotnull(amount#19) AND isnotnull(country#20)) AND (amount#19 > 100.0)) AND (country#20 = th))
   +- FileScan csv [name#18,amount#19,country#20] Batched: false, DataFilters: [isnotnull(amount#19), isnotnull(country#20), (amount#19 > 100.0), (country#20 = th)], Format: CSV, Location: InMemoryFileIndex(1 paths)[file:/...t.csv], PartitionFilters: [], PushedFilters: [IsNotNull(amount), IsNotNull(country), GreaterThan(amount,100.0), EqualTo(country,th)], ReadSchema: struct<name:string,amount:double,country:string>
```
Formatted mode block for the scan:
```
(1) Scan csv
Output [3]: [name#18, amount#19, country#20]
Batched: false
PushedFilters: [IsNotNull(amount), IsNotNull(country), GreaterThan(amount,100.0), EqualTo(country,th)]
ReadSchema: struct<name:string,amount:double,country:string>
```
Observations: (a) `ReadSchema` has 3 of 4 columns: `id` pruned (column pruning). (b) `PushedFilters` lists
source-level filters, including `IsNotNull` that `InferFiltersFromConstraints` added. (c) The `Filter`
operator is STILL in the plan above the scan, so pushdown does not mean "Spark will not re-check"; for
CSV the pushed filters are a hint to the reader. (UNVERIFIED for Parquet/ORC on this machine: parquet write
fails here, no pyarrow. Do not claim row-group skipping from this note.) (d) SQL optimizer also turned
`amount > 100` into `amount > 100.0` (literal cast folded).
Source: pushdown into file scans is `FileSourceStrategy` (`sql/core/.../datasources/FileSourceStrategy.scala:64`),
listed in the planner strategies at `sql/core/src/main/scala/org/apache/spark/sql/execution/SparkPlanner.scala:38-58`
(line 45 `FileSourceStrategy`). Scan description fields `ReadSchema` / `PushedFilters` come from
`sql/core/.../execution/DataSourceScanExec.scala:205-206`.

Predicate pushdown through a join (run, views a and c are `range(1000)`, AQE off):
`SELECT * FROM a JOIN c ON a_id = c_id WHERE a_id > 990`
```
== Optimized Logical Plan ==
Join Inner, (a_id#1L = c_id#3L)
:- Project [id#0L AS a_id#1L]
:  +- Filter (id#0L > 990)
:     +- Range (0, 1000, step=1, splits=Some(16))
+- Project [id#2L AS c_id#3L]
   +- Filter (id#2L > 990)
      +- Range (0, 1000, step=1, splits=Some(16))
```
The filter was written once on `a_id` and ended up on BOTH sides (join equality makes `c_id > 990` implied;
that inference is `InferFiltersFromConstraints`, `Opt:1771`, batch "Infer Filters" `Opt:167`).

Trap found while building examples: a filter on a derived key column is also inferred onto the other join
side. In one test, `right` filtered by `(id % 1000000) = 0` made the LEFT side get the same filter, so both
sides became tiny. If the lesson needs "one side unknown size", use a non-deterministic filter such as
`F.rand(42) < 0.000002`, which is never inferred or pushed.

### 2.4 Statistics and `explain("cost")` (optional)
Run: `explain("cost")` prints the Optimized Logical Plan with `Statistics(sizeInBytes=7.8 KiB, rowCount=1.00E+3)`
on Range and `Statistics(sizeInBytes=7.8 KiB)` on Filter/Project (no row count above the leaf since CBO is off).
`spark.sql.cbo.enabled` default false (`SQLConf:4091-4096`), `spark.sql.cbo.joinReorder.enabled` default
false (`SQLConf:4105-4110`); `CostBasedJoinReorder.apply` returns the plan unchanged unless both are true
(`CostBasedJoinReorder.scala:38-40`). Also `spark.sql.cbo.planStats.enabled` false (`SQLConf:4098-4103`).

### 2.5 Join reordering, broadcast choice

Join reordering (rule based, always on): run, AQE off, views a,b,c = range(1000):
`SELECT * FROM a, b, c WHERE a.a_id = c.c_id AND b.b_id = c.c_id`
```
Parsed:     Filter ((a.a_id = c.c_id) AND (b.b_id = c.c_id)) over Join Inner(Join Inner(a, b), c)   [a x b has no condition]
Optimized:
Project [a_id#1L, b_id#3L, c_id#5L]
+- Join Inner, (b_id#3L = c_id#5L)
   :- Join Inner, (a_id#1L = c_id#5L)
   :  :- Project [id#0L AS a_id#1L] ... Range
   :  +- Project [id#4L AS c_id#5L] ... Range
   +- Project [id#2L AS b_id#3L] ... Range
```
The plan-change log with rule filter `ReorderJoin` shows `ReorderJoin` itself did it (input: Filter over
`Join Inner(Join Inner(a,b),c)`; output: `Join Inner (b=c)` over `Join Inner (a=c)`). It avoids a cartesian
product between a and b; it does not use sizes. `ReorderJoin` is in the operator-optimization rule list at
`Opt:106`, definition `joins.scala:45`. Cost-based reorder needs CBO (off by default, 2.4).

Physical join choice. Source comment (the decision list): `sql/core/src/main/scala/org/apache/spark/sql/execution/SparkStrategies.scala:219-236`
(`object JoinSelection` starts at line 181): with no hint: 1 broadcast hash join if a side is small enough;
2 shuffled hash join if one side is much smaller and `spark.sql.join.preferSortMergeJoin` is false; 3 sort
merge join if keys are sortable; 4 cartesian; 5 broadcast nested loop. Hint order (lines 219-227): broadcast,
sort-merge, shuffle-hash, shuffle-replicate-NL. Size test: `canBroadcastBySize`,
`sql/catalyst/.../optimizer/joins.scala:367-375` (uses `spark.sql.autoBroadcastJoinThreshold`, or for runtime
stats `spark.sql.adaptive.autoBroadcastJoinThreshold` if set). Default `spark.sql.autoBroadcastJoinThreshold`
= 10MB (`SQLConf:949-954`; run: `10485760b`). `spark.sql.adaptive.autoBroadcastJoinThreshold` default is
unset (`SQLConf:1280-1290`; run: `None`).

Run, AQE off, `big = range(5_000_000)` joined to `small = range(100)` on k:
```
*(2) Project [k#1L]
+- *(2) BroadcastHashJoin [k#1L], [k#3L], Inner, BuildRight, false, false
   :- *(2) Project [id#0L AS k#1L]
   :  +- *(2) Range (0, 5000000, step=1, splits=16)
   +- BroadcastExchange HashedRelationBroadcastMode(List(input[0, bigint, false]),false), [plan_id=27]
      +- *(1) Project [id#2L AS k#3L]
         +- *(1) Range (0, 100, step=1, splits=16)
```
Same join with `spark.sql.autoBroadcastJoinThreshold=-1` (run):
```
*(5) Project [k#1L]
+- *(5) SortMergeJoin [k#1L], [k#3L], Inner
   :- *(2) Sort [k#1L ASC NULLS FIRST], false, 0
   :  +- Exchange hashpartitioning(k#1L, 200), ENSURE_REQUIREMENTS, [plan_id=68]
   :     +- *(1) Project [id#0L AS k#1L]
   :        +- *(1) Range (0, 5000000, step=1, splits=16)
   +- *(4) Sort [k#3L ASC NULLS FIRST], false, 0
      +- Exchange hashpartitioning(k#3L, 200), ENSURE_REQUIREMENTS, [plan_id=74]
         +- *(3) Project [id#2L AS k#3L]
            +- *(3) Range (0, 100, step=1, splits=16)
```
and with the hint `big.join(F.broadcast(small), "k")` and threshold still -1: BroadcastHashJoin again (run).
Takeaway: broadcast = no Exchange on the big side; sort merge = Exchange + Sort on both.

### 2.6 AQE: what it is, defaults, `isFinalPlan`

Defaults (source line of `createWithDefault`/definition, and value read from a live session):

| config | default | source | run value |
|---|---|---|---|
| `spark.sql.adaptive.enabled` | true | `SQLConf:1050-1055` | `true` |
| `spark.sql.adaptive.coalescePartitions.enabled` | true | `SQLConf:1101-1108` | `true` |
| `spark.sql.adaptive.advisoryPartitionSizeInBytes` | 64MB (falls back to deprecated `spark.sql.adaptive.shuffle.targetPostShuffleInputSize`, 64MB) | `SQLConf:1093-1099`, fallback `SQLConf:1041-1048` | `67108864b` |
| `spark.sql.adaptive.coalescePartitions.parallelismFirst` | true | `SQLConf:1110-1123` | `true` |
| `spark.sql.adaptive.coalescePartitions.minPartitionSize` | 1MB | `SQLConf:1125-1131` | `1048576b` |
| `spark.sql.adaptive.coalescePartitions.initialPartitionNum` | unset (= `spark.sql.shuffle.partitions`) | `SQLConf:1146-1156` | n/a |
| `spark.sql.adaptive.skewJoin.enabled` | true | `SQLConf:1230-1237` | `true` |
| `spark.sql.adaptive.skewJoin.skewedPartitionFactor` | 5.0 | `SQLConf:1239-1247` | `5.0` |
| `spark.sql.adaptive.skewJoin.skewedPartitionThresholdInBytes` | 256MB | `SQLConf:1249-1257` | `268435456b` |
| `spark.sql.adaptive.localShuffleReader.enabled` | true | `SQLConf:1221-1228` | `true` |
| `spark.sql.autoBroadcastJoinThreshold` | 10MB | `SQLConf:949-954` | `10485760b` |
| `spark.sql.adaptive.autoBroadcastJoinThreshold` | unset | `SQLConf:1280-1290` | `None` |
| `spark.sql.adaptive.nonEmptyPartitionRatioForBroadcastJoin` (internal) | 0.2 | `SQLConf:1259-1269` | n/a |
| `spark.sql.shuffle.partitions` | 200 | `SQLConf:1000-1005` | `200` |
| `spark.sql.optimizer.maxIterations` (internal) | 100 | `SQLConf:571-576` | n/a |
| `spark.sql.analyzer.maxIterations` (internal) | 100 | `SQLConf:372-377` | n/a |
| `spark.sql.ansi.enabled` | true unless env `SPARK_ANSI_SQL_MODE=false` | `SQLConf:5180-5190` | `true` |
| `spark.sql.cbo.enabled` / `spark.sql.cbo.joinReorder.enabled` | false / false | `SQLConf:4091`, `4105` | `false`, `false` |

Configs read from a Python session come back as strings with a unit suffix, e.g. `67108864b`. The advisory
size is a bytes value (64MB), not 128MB. Docstring of enabled: "re-optimizes the query plan in the middle of
query execution, based on accurate runtime statistics" (`SQLConf:1051-1052`).

When AQE is NOT applied (trap): `InsertAdaptiveSparkPlan` (`sql/core/.../adaptive/InsertAdaptiveSparkPlan.scala:44`)
wraps a plan only if it has exchanges, needs exchanges (a non-Unspecified `requiredChildDistribution`), has a
subquery, or `spark.sql.adaptive.forceApply` is true (`InsertAdaptiveSparkPlan.scala:99-124`, `SQLConf:1066-1074`,
internal, default false). Commands are skipped (lines 52-58), stateful streaming is skipped (lines 62-70).
Run: `spark.range(100).filter("id > 5").explain()` has NO `AdaptiveSparkPlan`:
```
*(1) Filter (id#39L > 5)
+- *(1) Range (0, 100, step=1, splits=16)
```
So "AQE on" does not put `AdaptiveSparkPlan` at the top of every plan; only plans with a shuffle (or subquery).

Where it sits: `AdaptiveSparkPlanExec` is a leaf node inserted as the FIRST rule of `preparations`
(`QE:402-405`; `QE:754-756` comment "AdaptiveSparkPlanExec is a leaf node. If inserted, all the following
rules will be no-op as the original plan is hidden behind it"). `case class AdaptiveSparkPlanExec` `ASPE:69`.

`isFinalPlan` before and after (run). Query: `spark.range(1_000_000).groupBy((F.col("id") % 3).alias("k")).count()`.

Before any action, `df.explain()`:
```
== Physical Plan ==
AdaptiveSparkPlan isFinalPlan=false
+- HashAggregate(keys=[_groupingexpression#5L], functions=[count(1)])
   +- Exchange hashpartitioning(_groupingexpression#5L, 200), ENSURE_REQUIREMENTS, [plan_id=15]
      +- HashAggregate(keys=[_groupingexpression#5L], functions=[partial_count(1)])
         +- Project [(id#0L % 3) AS _groupingexpression#5L]
            +- Range (0, 1000000, step=1, splits=16)
```
(`explain("formatted")` here shows `AdaptiveSparkPlan (6)` ... and the last block `Arguments: isFinalPlan=false`.)

After `df.collect()` on the SAME `df`, `df.explain()`:
```
== Physical Plan ==
AdaptiveSparkPlan isFinalPlan=true
+- == Final Plan ==
   ResultQueryStage 1
   +- *(2) HashAggregate(keys=[_groupingexpression#5L], functions=[count(1)])
      +- AQEShuffleRead coalesced
         +- ShuffleQueryStage 0
            +- Exchange hashpartitioning(_groupingexpression#5L, 200), ENSURE_REQUIREMENTS, [plan_id=25]
               +- *(1) HashAggregate(keys=[_groupingexpression#5L], functions=[partial_count(1)])
                  +- *(1) Project [(id#0L % 3) AS _groupingexpression#5L]
                     +- *(1) Range (0, 1000000, step=1, splits=16)
+- == Initial Plan ==
   HashAggregate(keys=[_groupingexpression#5L], functions=[count(1)])
   +- Exchange hashpartitioning(_groupingexpression#5L, 200), ENSURE_REQUIREMENTS, [plan_id=15]
      +- HashAggregate(keys=[_groupingexpression#5L], functions=[partial_count(1)])
         +- Project [(id#0L % 3) AS _groupingexpression#5L]
            +- Range (0, 1000000, step=1, splits=16)
```
`explain("formatted")` after: the ShuffleQueryStage line carries real stats:
`ShuffleQueryStage (5), Statistics(sizeInBytes=1152.0 B, rowCount=48)` (48 = 16 map tasks x 3 keys after partial
aggregation) and `AQEShuffleRead (6), coalesced`.
Source: `isFinalPlan` printed by `stringArgs` `ASPE:434`; flag set false at `ASPE:212`/`269` and true at `ASPE:389`;
the "Final Plan"/"Current Plan" + "Initial Plan" headers at `ASPE:472-491`. Edge case: if the current plan
equals the initial plan (nothing changed), only ONE plan is printed, with no headers (`ASPE:458-471`).
Also in 4.2 the last stage is a `ResultQueryStage` (`ASPE:345`, `ASPE:394`), not present in older material.

Trap (run): the flip happens only on the DataFrame object that ran. Calling `df2.count()` or `df3.show()` on
a DataFrame creates a NEW query (count adds an aggregate; show adds a limit), so `df2.explain()` afterwards
still says `isFinalPlan=false` (confirmed for both `count()` and `show()`). `df.rdd.getNumPartitions()` and
`df.collect()` DO execute the plan and update it (rdd call: 1 partition seen, 2.7).
Also run: with AQE on, ONE action produced 2 Spark jobs (first job: the shuffle map stage, 16 tasks; second job:
the result stage, 1 task, with the map stage shown as reused). With AQE off the same query is 1 job with
stages of 16 and 200 tasks.

### 2.7 Coalescing shuffle partitions: observed counts

Run, same groupBy query, partitions of the final result via `df.rdd.getNumPartitions()`:

| setting | observed partitions | stage tasks |
|---|---|---|
| AQE on (all defaults) | 1 | result stage 1 task (job 2) |
| `spark.sql.adaptive.enabled=false` | 200 (plan shows `Exchange hashpartitioning(..., 200)` with no AdaptiveSparkPlan) | result stage 200 tasks |
| AQE on, `coalescePartitions.enabled=false` | 200 | n/a |
| AQE on, `coalescePartitions.parallelismFirst=false` | 1 | n/a |
| AQE on, advisory=1b, minPartitionSize=1b | 3 (only 3 of the 200 shuffle partitions hold data: keys 0,1,2) | n/a |

Why 1 with defaults (source): target size = `max(min(totalBytes / minNumPartitions, advisory), minPartitionSize)`
(`sql/core/.../adaptive/ShufflePartitionsUtil.scala:60-62`). With `parallelismFirst` true, `minNumPartitions` =
`sparkContext.defaultParallelism` (16 here; `CoalesceShufflePartitions.scala:59-69`). Total shuffle bytes were
1152 B, 1152/16 = 72 B, then raised to `minPartitionSize` 1MB, so everything merges into 1 partition. The rule is
`CoalesceShufflePartitions` (`CoalesceShufflePartitions.scala:34`, entry `apply` lines 46-127), run among the
query-stage optimizer rules (`ASPE:137-145`). It is skipped entirely if `coalescePartitions.enabled` is false
(line 47-49). Supported shuffle origins at lines 38-40 (ENSURE_REQUIREMENTS, REPARTITION_BY_COL,
REBALANCE_*). Note: a user `repartition(10)` (REPARTITION_BY_NUM) is not in this list, so it is not coalesced
(UNVERIFIED by run; read from `supportedShuffleOrigins`).
Caveat for the lesson: the number depends on core count (`defaultParallelism` = 16 here). On another machine
with big data the same rule would keep ~64MB partitions or more. State "observed on a 16 core machine with
~1KB of shuffle data".

### 2.8 AQE changes the join and handles skew

Runtime SMJ to BHJ (run, AQE on, defaults). left = `range(5_000_000)` as k; right = `range(5_000_000)`
grouped by `id % 5` with count, renamed k. Static estimate is large, so the initial plan is `SortMergeJoin`
with an `Exchange` on both sides. After `collect()` (final plan, from the `AdaptiveSparkPlanExec` log):
```
ResultQueryStage 3
+- *(4) Project [k#1L, count#4L]
   +- *(4) BroadcastHashJoin [k#1L], [k#3L], Inner, BuildRight, false, false
      :- AQEShuffleRead local
      :  +- ShuffleQueryStage 0
      :     +- Exchange hashpartitioning(k#1L, 200), ENSURE_REQUIREMENTS, [plan_id=50]
      :        +- *(1) Project [id#0L AS k#1L]
      :           +- *(1) Range (0, 5000000, step=1, splits=16)
      +- BroadcastQueryStage 2
         +- BroadcastExchange HashedRelationBroadcastMode(List(input[0, bigint, true]),false), [plan_id=110]
            +- *(3) HashAggregate(keys=[_groupingexpression#7L], functions=[count(1)], output=[k#3L, count#4L])
               +- AQEShuffleRead coalesced
                  +- ShuffleQueryStage 1 ...
```
The left side was already shuffled; AQE kept that shuffle but read it with a LOCAL shuffle reader
(`AQEShuffleRead local`, rule `OptimizeShuffleWithLocalRead`, `OptimizeShuffleWithLocalRead.scala:36`;
config `localShuffleReader.enabled` default true) and broadcast the small side. The log line "Plan changed"
was emitted by `AdaptiveSparkPlanExec` (accepted new plan when cost <= old cost, `ASPE:364-379`).
Runtime size check uses the runtime-stats flag in `canBroadcastBySize` (`joins.scala:367-375`) and
`QueryStageExec.scala:89` (`isRuntime = true`).

Trap (run): a variant did NOT convert. When BOTH join children are directly materialized shuffle stages and
the small side's non-empty partition ratio is below 0.2 (4 rows in 200 partitions), AQE stays on
`SortMergeJoin` (`AQEShuffleRead coalesced` on both sides). Setting
`spark.sql.adaptive.nonEmptyPartitionRatioForBroadcastJoin=0` made the same query become a
`BroadcastHashJoin` (run). Cause in source: `DynamicJoinSelection.scala:38` adds `NO_BROADCAST_HASH` to a
side with "many empty partitions" (class comment lines 30-34, `hasManyEmptyPartitions` lines 40-44); batch "Dynamic Join Selection"
in `AQEOptimizer.scala:44`. Do not promise "small side always gets broadcast under AQE".

Skew join (run). Setup: `autoBroadcastJoinThreshold=-1`, `spark.sql.shuffle.partitions=8`, left 400,000 rows with
90% on key 0 (string payload), right 50 keys.

| setting | final partitions | final plan |
|---|---|---|
| defaults (256MB threshold) | 1 | `SortMergeJoin`, both sides `AQEShuffleRead coalesced` |
| `skewedPartitionThresholdInBytes=50KB`, `advisoryPartitionSizeInBytes=100KB`, `coalescePartitions.enabled=false` | 23 | `SortMergeJoin(skew=true)`, left `AQEShuffleRead skewed`, right `AQEShuffleRead` (replicated) |
| same, plus `skewJoin.enabled=false` | 8 | plain `SortMergeJoin`, no `AQEShuffleRead` |

Source: skew detection `OptimizeSkewedJoin` (`sql/core/.../adaptive/OptimizeSkewedJoin.scala:57`), threshold =
`max(skewedPartitionThresholdInBytes, median size * skewedPartitionFactor)` (lines 65-68); doc comment lines 36-56
(a skewed partition is split by map ranges and the matching other-side partition is replicated; if both sides
are skewed it becomes a cartesian of splits). Applies to sort-merge and shuffled-hash joins (`SQLConf:1232-1234`).
It is a query-stage-preparation rule, `ASPE:131`. Defaults are in the table of 2.6. Trap: skew handling needs
a shuffled join; a broadcast join has no shuffle to split. The default threshold of 256MB means small test data
never triggers it, so any demo has to lower the thresholds (config names above).

### 2.9 Tungsten, short

- Whole-stage codegen is on: `spark.sql.codegen.wholeStage` default true (`SQLConf:2553-2559`, internal).
  `*(n)` before an operator in the physical plan means it runs inside whole-stage-codegen stage n
  (`WholeStageCodegenExec` `sql/core/.../execution/WholeStageCodegenExec.scala:643`; prefix printed at line 838:
  `"* "` in formatted mode, `s"*($codegenStageId) "` otherwise). Inserted by `CollapseCodegenStages` (line 914),
  which is in `preparations` (`QE:776`). Operators outside a codegen stage (`Exchange`, `BroadcastExchange`, `AQEShuffleRead`, stage wrappers) appear
  without `*` in every run above. In formatted mode each
  operator block shows `[codegen id : n]`. `explain("codegen")` prints the generated Java (run: 1 WholeStageCodegen
  subtree, class `GeneratedIteratorForCodegenStage1`).
- Rows are `UnsafeRow`, a binary format: `[null-tracking bit set] [values, one 8-byte word per field] [variable
  length portion]`, backed by raw memory (`sql/catalyst/src/main/java/org/apache/spark/sql/catalyst/expressions/UnsafeRow.java:50`).
- Off-heap memory is off by default: `spark.memory.offHeap.enabled` false (`core/src/main/scala/org/apache/spark/internal/config/package.scala:466-472`).
- UNVERIFIED: any speed-up numbers for Tungsten or codegen (not measured). Do not quote a multiplier.

---------------------------------------------------------------------------------------------------

## 3. How the pipeline runs (file and line)

### 3.1 `QueryExecution` phases (all `lazy`, held in `LazyTry`)

Entry: `class QueryExecution(sparkSession, logical, ...)` `QE:67-76` (`logical` is the Parsed plan).

| phase | member | what it does | line |
|---|---|---|---|
| analyzed | `analyzed` (`lazyAnalyzed`) | `analyzer.executeAndCheck(...)` inside `executePhase(ANALYSIS)` | `QE:192-213` |
| commandExecuted | `commandExecuted` | eagerly runs Command nodes (e.g. writes inside CTAS) | `QE:215-225` |
| normalized | `normalized` | `QueryExecution.normalize(...)` | `QE:280-287` |
| withCachedData | `withCachedData` | `cacheManager.useCachedData(plan)` swaps in `cache()`d data; also `assertAnalyzed`, `assertSupported` | `QE:289-307` |
| optimizedPlan | `optimizedPlan` | `sessionState.optimizer.executeAndTrack(withCachedData.clone(), tracker)` inside `executePhase(OPTIMIZATION)` | `QE:311-331` |
| sparkPlan | `sparkPlan` | `QueryExecution.createSparkPlan(planner, optimizedPlan.clone())`, takes `planner.plan(ReturnAnswer(plan)).next()` (first candidate) | `QE:335-349`, `QE:806-812` |
| executedPlan | `executedPlan` | `prepareForExecution(preparations, sparkPlan.clone())` | `QE:353-372`, `QE:788-799` |

`preparations` (order matters): `InsertAdaptiveSparkPlan` first, then `CoalesceBucketsInJoin`,
`PlanDynamicPruningFilters`, `PlanSubqueries`, `RemoveRedundantProjects`, `EnsureRequirements` (this inserts
`Exchange`/`Sort`), ... `CollapseCodegenStages`, `ReuseExchangeAndSubquery` (`QE:402-405`, `QE:750-782`).
Explain wiring: `QE:464-507`; extended text `QE:509-531`.
The planner's strategy list (which strategy turns which logical node into which physical node):
`SparkPlanner.scala:38-58` (`LogicalQueryStageStrategy` first, then `DataSourceV2Strategy`, `FileSourceStrategy`,
`DataSourceStrategy`, `SpecialLimits`, `Aggregation`, `Window`, `JoinSelection`, `InMemoryScans`, `BasicOperators`, ...).
Parsing itself is before `QueryExecution`: the `logical` argument is already the parsed plan (verified only
by the constructor signature; I did not trace `SparkSession.sql`).
Note a naming trap: there is no member called `parsedPlan`; the Parsed section of explain prints `logical`.

### 3.2 RuleExecutor, batches, strategies

- `RuleExecutor` loop: `sql/catalyst/src/main/scala/org/apache/spark/sql/catalyst/rules/RuleExecutor.scala:215-325`
  (`batches.foreach`, repeat the rules in the batch until the plan stops changing `curPlan.fastEquals(lastPlan)`
  at line 312, or `iteration > batch.strategy.maxIterations` at line 286).
- Strategies: `abstract class Strategy` line 137; `case object Once` (maxIterations = 1) line 150;
  `case class FixedPoint(maxIterations, errorOnExceed = false, ...)` lines 156-159. Running past the max logs a
  warning, and throws only if `errorOnExceed` (analyzer sets true, optimizer false) or in tests
  (`RuleExecutor.scala:295-302`).
- Optimizer max iterations: `Optimizer.fixedPoint = FixedPoint(conf.optimizerMaxIterations, ...)` `Opt:73-76`,
  default 100 (`SQLConf:571-576`). Analyzer: `fixedPoint = FixedPoint(conf.analyzerMaxIterations, errorOnExceed = true, ...)`
  `Analyzer.scala:446-450` (`sql/catalyst/src/main/scala/org/apache/spark/sql/catalyst/analysis/Analyzer.scala`), default 100
  (`SQLConf:372-377`).

Optimizer batches (`Opt:100-291`, `defaultBatches`; the live optimizer is `SparkOptimizer`, which extends it
and adds batches around it, `sql/core/.../execution/SparkOptimizer.scala:52-99`). Name, strategy, line of the
`Batch(` call:

| # | batch | strategy | line |
|---|---|---|---|
| 1 | Finish Analysis | FixedPoint(1) | `Opt:177` |
| 2 | Rewrite With expression | FixedPoint(100) | `Opt:180` |
| 3 | Eliminate Distinct | Once | `Opt:184` |
| 4 | Inline CTE | Once | `Opt:190` |
| 5 | Union | FixedPoint(100) | `Opt:192` |
| 6 | LocalRelation early | FixedPoint(100) | `Opt:201` |
| 7 | Pullup Correlated Expressions | Once | `Opt:207` |
| 8 | Subquery | FixedPoint(1) | `Opt:213` |
| 9 | Replace Operators | FixedPoint(100) | `Opt:216` |
| 10 | Aggregate | FixedPoint(100) | `Opt:228` |
| 11 | Operator Optimization before Inferring Filters | FixedPoint(100) | `Opt:165` (rule list `Opt:101-162`, ~60 rules incl. `PushDownPredicates`, `ColumnPruning`, `CollapseProject`, `ConstantFolding`, `BooleanSimplification`) |
| 12 | Infer Filters | Once | `Opt:167` |
| 13 | Operator Optimization after Inferring Filters | FixedPoint(100) | `Opt:170` |
| 14 | Push extra predicate through join | FixedPoint(100) | `Opt:172` |
| 15 | Clean Up Temporary CTE Info | Once | `Opt:232` |
| 16 | Pre CBO Rules | Once | `Opt:235` |
| 17 | Early Filter and Projection Push-Down | Once | `Opt:239` (SparkOptimizer fills it: `SchemaPruning`, `V2ScanRelationPushDown`, `PruneFileSourcePartitions`, ... `SparkOptimizer.scala:37-47`) |
| 18 | Update CTE Relation Stats | Once | `Opt:240` |
| 19 | Join Reorder | FixedPoint(1) | `Opt:243` (`CostBasedJoinReorder`, no-op unless CBO flags are on) |
| 20 | Push Down Join Through Union | Once | `Opt:249` |
| 21 | Eliminate Sorts | Once | `Opt:251` |
| 22 | Decimal Optimizations | FixedPoint(100) | `Opt:254` |
| 23 | Distinct Aggregate Rewrite | Once | `Opt:258` |
| 24 | Object Expressions Optimization | FixedPoint(100) | `Opt:261` |
| 25 | LocalRelation | FixedPoint(100) | `Opt:266` |
| 26 | Optimize One Row Plan | FixedPoint(100) | `Opt:272` |
| 27 | Check Cartesian Products | Once | `Opt:274` |
| 28 | RewriteSubquery | Once | `Opt:276` |
| 29 | NormalizeFloatingNumbers | Once | `Opt:286` |
| 30 | ReplaceUpdateFieldsExpression | Once | `Opt:287` |

Extra batches added by `SparkOptimizer` (`SparkOptimizer.scala:52-99`): Optimize Metadata Only Query (Once, line 55),
PartitionPruning (Once, 56), InjectRuntimeFilter (FixedPoint(1), 62), MergeSubplans (Once, 64), Pushdown Filters
from PartitionPruning (fixedPoint, 67), Cleanup filters that cannot be pushed down (Once, 69), Extract Python
UDFs (Once, 75; note: Python UDF extraction happens here, relevant to the UDF lesson), Infer window group limit
(Once, 92), User Provided Optimizers (fixedPoint, 98), Replace CTE with Repartition (Once, 99).
Note "Operator Optimization before/after Inferring Filters" use the SAME rule set twice (`operatorOptimizationRuleSet`)
with "Infer Filters" in between. The `Once` batches "Infer Filters", "PartitionPruning", "RewriteSubquery",
"Extract Python UDFs" are excluded from the idempotence check in tests (`Opt:66-71`).

Analyzer batches (`Analyzer.scala`): early batches `Analyzer.scala:512-537`: Substitution (fixedPoint, 513),
Apply Limit All (Once, 523), Disable Hints (Once, 524), Hints (fixedPoint, 526), Simple Sanity Check (Once, 530),
Keep Legacy Outputs (Once, 532), Unresolve Relations (Once, 534). Then `batches` `Analyzer.scala:539-639`:
Resolution (fixedPoint, 539; contains `ResolveRelations`, `ResolveReferences`, type coercion, `ResolveFunctions`-like
rules), Remove TempResolvedColumn (Once, 613), Post-Hoc Resolution (Once, 614), Remove Unresolved Hints (Once, 617),
Nondeterministic (Once, 619), ScalaUDF Null Handling (fixedPoint, 621), UDF (Once, 629), Subquery (Once, 631),
Cleanup (fixedPoint, 633), HandleSpecialCommand (Once, 635), Remove watermark for batch query (Once, 637),
ResolveUnresolvedHaving (Once, 639). Run trace of analysis for `SELECT ... FROM v`: effective rules
`ResolveRelations`, `ResolveReferences`, `AnsiTypeCoercion$AnsiCombinedTypeCoercionRule`, `ResolveUpCast`,
`ResolveTimeZone`, all in "Resolution". A single-pass analyzer exists but is off:
`spark.sql.analyzer.singlePassResolver.enabled` default false (`SQLConf:380-393`), and `executeAndCheck`
goes through `HybridAnalyzer` (`Analyzer.scala:367`); I did not trace what HybridAnalyzer does when the flag is off (UNVERIFIED, skip in lesson).

### 3.3 Where AQE re-plans

- `AdaptiveSparkPlanExec` `ASPE:69`. Class comment lines ~52-68: the plan is cut into query stages at exchanges; when
  a stage finishes, "the rest query is re-optimized and planned based on the latest statistics".
- Initial plan: `ASPE:203-208` (`initialPlan` = post-planner rules then `queryStagePreparationRules`, which hold
  `EnsureRequirements` and `OptimizeSkewedJoin`, `ASPE:110-133`).
- Main loop `withFinalPlanUpdate` `ASPE:268-396`: create stages (`createQueryStages`, line 543; `createNonResultQueryStages`,
  line 598) -> start `stage.materialize()` for new stages, broadcast stages first (lines 293-322) -> block on
  `events.take()` for the next finished stage (line 328) -> `replaceWithQueryStagesInLogicalPlan` (line 357) ->
  `reOptimize` (line 364) -> compare cost, adopt new plan if `newCost < origCost` or equal-cost-but-different
  (lines 367-379) -> create more stages (line 386) -> after the last, `_isFinalPlan = true` (line 389).
- `reOptimize` `ASPE:805-835`: `logicalPlan.invalidateStatsCache()`, `optimizer.execute(logicalPlan)` (the AQE
  logical optimizer), `planner.plan(ReturnAnswer(optimized)).next()`, then physical rules again
  (`preprocessingRules ++ queryStagePreparationRules`).
- Runtime logical optimizer `AQEOptimizer.scala:31-84`, batches (lines 39-47): Propagate Empty Relations
  (fixedPoint, 40), Dynamic Join Selection (Once, 44), Eliminate Limits (fixedPoint, 45), Optimize One Row Plan
  (fixedPoint, 46), User Provided Runtime Optimizers (fixedPoint, 47).
- Per-stage physical rules `queryStageOptimizerRules` `ASPE:137-145`: `PlanAdaptiveDynamicPruningFilters`,
  `ReuseAdaptiveSubquery`, `OptimizeSkewInRebalancePartitions`, `CoalesceShufflePartitions`, `OptimizeShuffleWithLocalRead`;
  applied in `optimizeQueryStage` `ASPE:160-193`.
- Cost model: `SimpleCostEvaluator` by default (`ASPE:100-105`; custom class via `spark.sql.adaptive.customCostEvaluatorClass`,
  `SQLConf:1327-1328`). Cost = the number of `ShuffleExchangeLike` nodes in the plan
  (`sql/core/.../adaptive/simpleCosting.scala:42-65`; when `spark.sql.adaptive.forceOptimizeSkewedJoin` is true, skew
  joins are also counted, in the high 32 bits). So AQE adopts a re-planned plan only if it has fewer shuffles, or the same
  number and a different plan (`ASPE:369-370`).
- The SQL UI plan is updated by `onUpdatePlan` (`ASPE:859-873`) (read from KG summary and signature; not run).

---------------------------------------------------------------------------------------------------

## 4. Misconceptions and traps (each backed above)

1. "explain() runs the query" / "explain shows what happened". It runs 0 jobs. Under AQE it shows
   `isFinalPlan=false` and the plan can still change. (2.1, 2.6)
2. "After an action the DataFrame's explain shows the final plan." Only if that action ran on the same
   DataFrame object (`collect()`, `rdd`). `count()`, `show()` create a different query, so the original still
   says `isFinalPlan=false`. (2.6)
3. "AQE adds AdaptiveSparkPlan to every plan." No: a plan with no exchange/subquery (e.g. range + filter) has
   none. (2.6)
4. "The Physical Plan in the Initial Plan section is wrong because it says 200 partitions." The Initial Plan
   keeps `Exchange hashpartitioning(..., 200)`; the Final Plan keeps the same Exchange line but adds
   `AQEShuffleRead coalesced`. The actual partition count is not printed on the Exchange line; read `coalesced`
   and the stage stats. (2.6, 2.7)
5. "Pushdown means the Filter disappears." The `Filter` node stays above the scan; `PushedFilters` shows what the
   source was told. (2.3)
6. "`explain(True)` = Parsed/Analyzed/Optimized/Physical; `formatted` = even more." Formatted prints physical only.
   Parsed shows unresolved names with a quote. (2.1)
7. "Catalyst reorders joins by size." Default `ReorderJoin` only fixes conditions/cartesian; cost-based reorder is
   off (`cbo.enabled=false`). Broadcast choice is by `autoBroadcastJoinThreshold` (10MB), or hint. (2.4, 2.5)
8. "Any small side gets broadcast by AQE." Not when its non-empty partition ratio < 0.2. (2.8)
9. "Skew join works out of the box on small data." Threshold is 256MB and factor 5x median: demos must lower
   `skewedPartitionThresholdInBytes` and `advisoryPartitionSizeInBytes`. (2.8)
10. "ANSI mode changes the plan." The plan text is the same; `cast` and `+` behave differently at run time, and
    the mode is captured when the DataFrame is analyzed (not when the action runs). Codegen has `addExact`
    under ANSI. (2.2)
11. "Partition counts are universal." The 1 vs 200 result depends on `defaultParallelism` (16 here) and on data
    size; say "observed". (2.7)
12. Expression ids (`#0L`, `#5L`) differ between runs and between queries; teach readers to ignore the numbers.
    Also `plan_id=15` values change.
13. Environment: this machine has a system SPARK_HOME for 3.5.0; always use `get_spark(...)`. Parquet write fails
    on this Windows machine (NativeIO), so file-scan examples here use CSV; label them as CSV.
14. Colliding Spark UI ports (4040 busy -> 4041) printed as a WARN when another session is open. Harmless.

---------------------------------------------------------------------------------------------------

## 5. Quiz (answers verified above)

1. Q: You call `df.explain()` right after building a groupBy query with AQE on, then you run `df.count()` and call
   `df.explain()` again. What does the second print say for `isFinalPlan`, and why?
   A: Still `isFinalPlan=false`. `df.count()` builds and runs a new DataFrame (an extra aggregate), so the
   original `df` never executed. Only `df.collect()` or `df.rdd` on the same object would flip it to true.
   (2.6)
2. Q: In a physical plan, what does the first operator line of `explain("formatted")` tell you that the top of
   `explain(True)` does not, and which of the two prints the Parsed Logical Plan?
   A: `explain(True)` prints Parsed, Analyzed, Optimized and Physical plans; `formatted` prints only the physical
   plan as a numbered tree plus a detail block per operator. So only `explain(True)` shows the Parsed plan. (2.1)
3. Q: A query on a CSV view selects 1 of 4 columns and filters two columns. Which two fields in the scan node show
   column pruning and predicate pushdown, and does the `Filter` node disappear?
   A: `ReadSchema` (3 columns read: the selected one and the two filtered) and `PushedFilters`; the `Filter`
   node stays in the plan. (2.3)
4. Q: Name the AQE config that decides the target size when small shuffle partitions are merged, and its default.
   With only 1152 bytes of shuffle data on a 16 core machine and defaults, how many partitions did the result
   have with AQE on vs off?
   A: `spark.sql.adaptive.advisoryPartitionSizeInBytes`, 64MB. 1 partition with AQE on, 200 with AQE off
   (target is raised to `minPartitionSize` 1MB). (2.6, 2.7)
5. Q: A join of a large table and a small table shows `SortMergeJoin` in the initial plan under AQE. Name two
   different reasons the final plan could still be `SortMergeJoin`, one about the threshold and one about
   partitions.
   A: (a) the small side is larger than the broadcast threshold (`spark.sql.autoBroadcastJoinThreshold` 10MB; the
   runtime check uses `spark.sql.adaptive.autoBroadcastJoinThreshold` if set); (b) the small side is spread over
   very few non-empty partitions (ratio below `nonEmptyPartitionRatioForBroadcastJoin` 0.2), which makes AQE avoid
   a broadcast hash join. (2.8)

Optional extra questions (also verified): which batch holds the rules that make `1 = 1` disappear and how many
iterations can it run (Operator Optimization, FixedPoint up to `spark.sql.optimizer.maxIterations`=100, 3.2);
is cost-based join reordering on by default (no, `spark.sql.cbo.enabled=false`, 2.4); does the `isFinalPlan` flag
appear in plans with no shuffle (no `AdaptiveSparkPlan` at all, 2.6).

---------------------------------------------------------------------------------------------------

## 6. UNVERIFIED / not covered

- Parquet/ORC pushdown behavior (row-group skipping, `PushedFilters` with `Batched: true`) on this machine:
  cannot write parquet, no pyarrow. Only CSV scan output is verified.
- Whether `repartition(n)` output is ever coalesced by AQE (`supportedShuffleOrigins` read, not run).
- What `HybridAnalyzer` does when the single-pass flag is off.
- Speed claims for Tungsten / whole-stage codegen / AQE (nothing timed).
- Spark UI SQL tab rendering of the AQE plan (not run; port 4040 was busy during runs).
- Dynamic partition pruning, runtime filters (`PartitionPruning`, `InjectRuntimeFilter` batches exist in
  `SparkOptimizer.scala:56-63` but were not exercised).
- Behavior on a real cluster (all runs are `local[*]`, 16 cores); partition counts will differ.
