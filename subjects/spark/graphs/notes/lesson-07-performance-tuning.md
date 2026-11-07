# Evidence note: lesson 07 "Performance tuning" (Spark 4.2.0)

Source checkout: E:\Development\Project\open-source\spark, commit 32f72996 (tag v4.2.0, read only).
Behavior runs: PySpark 4.2.0 from the project venv, Windows, `local[*]` with 16 cores unless stated
(`defaultParallelism` = 16). All data is in memory (`spark.range`). No parquet, no network.
Paths below are relative to the Spark checkout unless they start with `E:\`. Line numbers were
re-read in the source on this commit. `SQLConf.scala` = `sql/catalyst/src/main/scala/org/apache/spark/sql/internal/SQLConf.scala`.
Config line numbers point to the `buildConf(...)`/`ConfigBuilder(...)` line (same convention as
`subjects/spark/graphs/index/configs.md`); the default sits 3-8 lines below.

Marking: VERIFIED = source line re-read and/or behavior observed in a run. UNVERIFIED = not checked,
do not state as fact.

Scope of neighbors (read before writing): lesson 05 (`execution-model.mdx`) already covers job/stage/task,
narrow vs wide, why shuffle is expensive, and shows `SkewDemo`; it defers "salting and AQE" to chapter 7.
Lesson 06 (`catalyst-aqe.mdx`, still a seed) plans to cover AQE: coalesce small partitions, change join
strategy, skew join. So lesson 07 and lesson 06 overlap on AQE. Suggest lesson 07 treats AQE as a tool
(what it changes, which knob to turn, how to confirm in the plan) and leaves the "how Catalyst/AQE works"
story to lesson 06. Lesson 05 already told the reader that `spark.sql.shuffle.partitions` is 200 and AQE may
coalesce; lesson 07 can add the observed numbers.

Graph coverage note: `.ua/knowledge-graph.json` has nodes for OptimizeSkewedJoin, SortShuffleManager,
SortShuffleWriter, ExternalSorter, ShuffleExternalSorter, UnsafeShuffleWriter, BypassMergeSortShuffleWriter,
TaskSetManager, CoalesceShufflePartitions, BroadcastExchangeExec, SparkStrategies. It has NO nodes for
UnsafeExternalSorter, TaskMemoryManager (only `Task.setTaskMemoryManager`), CacheManager, InMemoryRelation,
InMemoryTableScanExec, UnifiedMemoryManager, SortExec. Those were read directly from source.
OptimizeSkewedJoin node line ranges in the graph match the file (65-68, 75-83, 111-199, 257-284).

---------------------------------------------------------------------------------------------------

## 1. Scope: the claims the lesson should teach, in order

1. Tuning starts from the plan and the Spark UI: count the `Exchange` nodes, check partition counts, then change one thing. (recap of lesson 05, keep short)
2. `spark.sql.shuffle.partitions` = 200 is a fixed guess. Too many tiny tasks cost real time; AQE coalescing fixes most of it at run time, but an explicit `repartition(n)` is never coalesced.
3. Join strategy is chosen by `JoinSelection` in a fixed order: hints first, then size threshold (broadcast), then shuffle hash (rarely), then sort-merge, then cartesian, then broadcast nested loop.
4. `autoBroadcastJoinThreshold` (10 MB) compares against an ESTIMATED size with `<=`, per side after column pruning; broadcast works only for some join types and sides.
5. Join hints (BROADCAST, MERGE, SHUFFLE_HASH, SHUFFLE_REPLICATE_NL) override the threshold, have a fixed priority, and are silently ignored when not applicable.
6. AQE can turn a sort-merge join into a broadcast join at run time because it uses real shuffle sizes, while the static estimate of a filtered table stays large.
7. Data skew: one key goes to one partition. AQE `OptimizeSkewedJoin` splits skewed partitions of joins only, under two conditions (factor 5 x median AND 256 MB). Manual salting works for aggregations and for cases AQE cannot handle.
8. `repartition` = shuffle (Exchange), `coalesce` = no shuffle (`Coalesce` node), and coalesce(1) before heavy work shrinks the parallelism of the whole stage.
9. `cache()`/`persist()` are lazy, keyed by the normalized plan, default storage level is memory and disk; check with `InMemoryTableScan`; cached shuffle output keeps its original (uncoalesced) partition count.
10. Spill: when execution memory is short, sorters and hash aggregates write to disk; look for "Spill (Memory)" / "Spill (Disk)" in the Stage page and "spill size" in the SQL tab. Spill is slower, not an error.
11. Shuffle writers: bypass-merge-sort (<= 200 partitions, no map-side combine), serialized/unsafe, or the general sort writer. With the SQL default of 200 partitions you are exactly at the bypass boundary.
12. Locality levels and `spark.locality.wait` (3 s): the scheduler waits for a local slot before accepting a worse one. (source only, cluster concept)
13. Anti-patterns with evidence: `collect()` of big data, Python UDF instead of built-ins, thousands of tiny partitions, several `count(distinct)` in one aggregation.

(13 items; if the lesson must stay at 12, merge 11 and 12 into an "under the hood" box.)

---------------------------------------------------------------------------------------------------

## 2. Claims with evidence

### Claim 1. Read the plan first

- Fact: `explain()` shows `Exchange` for each shuffle; with AQE on, the plan before an action starts with `AdaptiveSparkPlan isFinalPlan=false` and the plan after the action has `isFinalPlan=true` with `== Final Plan ==` and `== Initial Plan ==` sections.
- Observed: run `aqe1.py`, before action `AdaptiveSparkPlan isFinalPlan=false`; after `collect()`, `AdaptiveSparkPlan isFinalPlan=true`, `ResultQueryStage`/`ShuffleQueryStage`/`AQEShuffleRead` nodes appear in the final plan.
- Gotcha for demos: the DataFrame object must be the SAME object you ran the action on; `df.explain()` on a rebuilt DataFrame shows `isFinalPlan=false` again. Verified: `q.collect(); q.explain()` shows the final plan.
- Gotcha: `spark.range(n).groupBy("id")` (grouping on the range id itself) gives NO shuffle in the plan (observed: `groupBy("k").count()` on a renamed range returned 16 partitions with AQE on and off, the same as the scan), because Range reports a partitioning that already satisfies the grouping. Use a computed key like `id % 7` or `(id * 7919) % 1000003` so that an Exchange appears. Source for the reason: UNVERIFIED (I did not read `RangeExec.outputPartitioning`); only the observation is verified.

### Claim 2. `spark.sql.shuffle.partitions` and AQE coalescing

- Fact: default 200, must be > 0. `SQLConf.scala:1000` (`createWithDefault(200)` at 1005).
- Fact: AQE enabled by default `SQLConf.scala:1050`; `coalescePartitions.enabled` default true `1102`; `coalescePartitions.parallelismFirst` default true `1111`; `minPartitionSize` default 1MB `1125`; `advisoryPartitionSizeInBytes` falls back to the deprecated `adaptive.shuffle.targetPostShuffleInputSize` = 64MB `1094`/`1042`; `coalescePartitions.initialPartitionNum` default none (then equals shuffle.partitions) `1147`.
- Fact: with AQE and coalescing both on, the number of shuffle partitions requested at planning is `initialPartitionNum` if set, else `shuffle.partitions`: `SQLConf.scala:7790-7796`.
- Fact: `CoalesceShufflePartitions` only touches shuffles whose origin is ENSURE_REQUIREMENTS, REPARTITION_BY_COL, REBALANCE_*: `sql/core/src/main/scala/org/apache/spark/sql/execution/adaptive/CoalesceShufflePartitions.scala:38-40`. An explicit `repartition(n)` (origin REPARTITION_BY_NUM) is NOT coalesced.
- Fact: with `parallelismFirst=true` the minimum partition count is `sparkContext.defaultParallelism`, else 1 (`CoalesceShufflePartitions.scala:59-69`); advisory size is used as the target (`:134-142`).
- Observed (run `aqe1.py`, `aqe2.py`, 2M-row range, 16 cores). `rdd.getNumPartitions()` of the result:

  | case | partitions |
  |---|---|
  | `groupBy(id % 7).count()`, AQE off | 200 |
  | same, AQE on (defaults) | 1 |
  | same, AQE on, `coalescePartitions.enabled=false` | 200 |
  | `groupBy((id*7919) % 1000003).sum`, 3M rows, AQE off | 200 |
  | same, AQE on defaults (parallelismFirst=true) | 17 |
  | same, parallelismFirst=false (advisory 64MB) | 1 |
  | same, parallelismFirst=false, advisory 1MB | 28 |
  | same, `initialPartitionNum=1000` | 16 |
  | same, `shuffle.partitions=50` | 17 |
  | `df.repartition(200)` with AQE on | 200 (kept) |

  Final plan shows `AQEShuffleRead coalesced` above `ShuffleQueryStage` (see Claim 1).
- Cost of too many partitions, observed (run `part1.py`, AQE off, tiny groupBy on 100k rows, median of 5 runs, this machine): `shuffle.partitions` 2 -> 0.207 s, 200 -> 0.489 s, 2000 -> 1.174 s. The number is machine specific; the trend is the point. Task count in the final stage equals the partition count by construction.
- Related (file reading, UNVERIFIED in a run): `spark.sql.files.maxPartitionBytes` default 128MB `SQLConf.scala:2706` (scan partition size); `openCostInBytes` is internal. Without parquet we could not show scan partitioning. Tell the author not to claim a scan partition count demo.

### Claim 3. Join selection order (`JoinSelection`)

Source: `sql/core/src/main/scala/org/apache/spark/sql/execution/SparkStrategies.scala`, `object JoinSelection` at line 181; class comment 150-179 lists the algorithms and their limits.

Equi-join, comment `:219-236`, code `:238-330`:
- With hints (`:321-329`): `createBroadcastHashJoin(true)` -> if MERGE hint, `createSortMergeJoin` -> `createShuffleHashJoin(true)` -> if SHUFFLE_REPLICATE_NL hint, `createCartesianProduct` -> else `createJoinWithoutHint()`.
- Without hints (`createJoinWithoutHint`, `:305-319`): `createBroadcastHashJoin(false)` -> `createShuffleHashJoin(false)` -> `createSortMergeJoin()` -> `createCartesianProduct()` -> fallback `BroadcastNestedLoopJoinExec` (buildSide = smaller side).
- `createBroadcastHashJoin` and `createShuffleHashJoin` need `hashJoinSupported(keys)` (`:240`; `joins.scala:406` binary-stable key types). Sort-merge needs sortable keys (`:286-293`, `RowOrdering.isOrderable`). Cartesian only for InnerLike joins (`:295-303`).
- Null-aware anti join (NOT IN subquery with one column): broadcast only, `:331-334`.

Non-equi join, comment `:336-350`, code `:352-420`: hints -> broadcast nested loop; else small side -> BNLJ; else cartesian (inner-like); else BNLJ anyway ("could be very slow or OOM").

Broadcast conditions (`sql/catalyst/src/main/scala/org/apache/spark/sql/catalyst/optimizer/joins.scala`):
- `canBroadcastBySize` `:367-375`: `stats.sizeInBytes >= 0 && stats.sizeInBytes <= threshold`; for runtime (AQE) stats it uses `spark.sql.adaptive.autoBroadcastJoinThreshold` if set, else the normal one (`:369-370`).
- Which side may be the broadcast side per join type: `canBuildBroadcastLeft` (InnerLike, RightOuter) `:377`, `canBuildBroadcastRight` (InnerLike, LeftOuter, LeftSingle, LeftSemi, LeftAnti, ExistenceJoin) `:384`. FullOuter cannot broadcast.
- `autoBroadcastJoinThreshold` default 10MB (`createWithDefaultString("10MB")`), `SQLConf.scala:949`; -1 disables. Runtime value prints as `10485760b`.

Shuffle hash join conditions (without hint), `joins.scala:318-359`, helpers `:538-560`:
- (`!spark.sql.join.preferSortMergeJoin` AND small side `sizeInBytes < autoBroadcastJoinThreshold * numShufflePartitions` AND small side x `spark.sql.shuffledHashJoinFactor` <= other side) for that side, plus a join-type check (`canBuildShuffledHashJoinLeft/Right`, `:391`).
- `preferSortMergeJoin` is INTERNAL, default true, `SQLConf.scala:900`. `shuffledHashJoinFactor` default 3, `SQLConf.scala:956`. So by default shuffle hash join is never chosen without a hint.
- The `forceApplyShuffledHashJoin` escape is test-only (`joins.scala:558-560`).
- Note `canBuildLocalHashMapBySize` multiplies the threshold by the shuffle partition count: with threshold -1 it can never be true (negative), so SHJ without a hint needs a non-negative threshold.

Observed (runs `join1.py`, `join3.py`, AQE off to see the static plan; 2M-row `big` vs 100-row `small`, both only `k` after column pruning, `small` estimated at 800 bytes; `big` 16,000,000):
- default threshold -> `BroadcastHashJoin [k], [k], Inner, BuildRight` with `BroadcastExchange HashedRelationBroadcastMode`, no sort, no shuffle of `big`.
- threshold -1 -> `SortMergeJoin`, each side `Sort` over `Exchange hashpartitioning(k, 200)`.
- threshold boundary: threshold 800 -> BroadcastHashJoin, threshold 799 -> SortMergeJoin (confirms `<=`). Note the size compared is the pruned side (800 B = 100 rows x 8 B), not the original table with the extra literal column (1800 B). First attempt with 1800/1799 both broadcast because column pruning had already removed the literal column. Tell the author: "size" means the estimated size of that side of the plan, not of the table on disk.
- 2M x 2M (both 16,000,000) -> `SortMergeJoin` (self-join shows `ReusedExchange` for the second side, avoid in demos or use `range(0, 2_000_001)` for the other side).
- Shuffle hash join, observed with `autoBroadcastJoinThreshold=100`, `preferSortMergeJoin=false`, small 800 B vs big 16 MB: `ShuffledHashJoin [k], [k], Inner, BuildRight` with two `Exchange hashpartitioning(..., 200)` and NO sort. With defaults (`preferSortMergeJoin=true`) and threshold 100: `SortMergeJoin`. With the "other" side 1000 B (800 x 3 > 1000, not "much smaller"): `SortMergeJoin`.
- Non-equi join, `big.k < small.k`: default threshold -> `BroadcastNestedLoopJoin BuildRight, Inner`; threshold -1 -> `CartesianProduct (k < k)`; LEFT OUTER non-equi with threshold -1 -> `BroadcastNestedLoopJoin BuildRight, LeftOuter` (fallback, not inner-like).
- Join type effects, threshold default: `big FULL JOIN small` -> `SortMergeJoin FullOuter` (cannot broadcast); `small LEFT JOIN big` -> `SortMergeJoin LeftOuter` (cannot broadcast the left side of a left join); `small RIGHT JOIN big` -> `BroadcastHashJoin RightOuter, BuildLeft`.

### Claim 4. Join hints

- Names and aliases: BROADCAST (`BROADCAST`, `BROADCASTJOIN`, `MAPJOIN`) `sql/catalyst/.../plans/logical/hints.scala:137-143`; MERGE (`SHUFFLE_MERGE`, `MERGE`, `MERGEJOIN`) `:148-154`; SHUFFLE_HASH `:159-163`; SHUFFLE_REPLICATE_NL `:168-172`. Priority comment: BROADCAST over SHUFFLE_MERGE over SHUFFLE_HASH over SHUFFLE_REPLICATE_NL, `:117-123`. Internal hints (not for users): NO_BROADCAST_HASH, PREFER_SHUFFLE_HASH, NO_BROADCAST_AND_REPLICATION `:177-199`.
- PySpark: `DataFrame.hint(name, *params)` `python/pyspark/sql/dataframe.py:1187`; `pyspark.sql.functions.broadcast(df)` `python/pyspark/sql/functions/builtin.py:6644`. SQL: `/*+ BROADCAST(t) */`.
- Observed (runs `join1.py`, `join2.py`, `misc1.py`; AQE off; threshold -1 or default as stated):
  - `small.hint("broadcast")` with threshold -1 -> BroadcastHashJoin (hint beats threshold).
  - `F.broadcast(small)` -> same BroadcastHashJoin.
  - `SELECT /*+ MAPJOIN(s) */ ...` with threshold -1 -> BroadcastHashJoin.
  - `small.hint("merge")` with default threshold (would have broadcast) -> SortMergeJoin.
  - `small.hint("shuffle_hash")` -> `ShuffledHashJoin ... BuildRight`, no sort.
  - `small.hint("shuffle_replicate_nl")` (equi, inner) -> `CartesianProduct (k#1L = k#3L)` (no shuffle at all, equality evaluated as a filter): very slow on big data, warn the reader.
  - Both sides hinted `BROADCAST` -> broadcasts the smaller (small). Hints `BROADCAST(s), MERGE(b)` on different sides -> BroadcastHashJoin (BROADCAST wins).
  - Hint not applicable is silently ignored (it falls back to normal selection): `/*+ BROADCAST(s) */ b FULL JOIN s` -> SortMergeJoin FullOuter; `small.hint("broadcast")` on the LEFT of a LEFT JOIN -> SortMergeJoin LeftOuter; `shuffle_replicate_nl` on a LEFT join -> SortMergeJoin. An unknown hint name (`hint("nonsense")`) did not raise: plan is a normal SortMergeJoin (a WARN log may be printed, I filtered WARN lines; do not claim the message text).
  - `shuffle_hash` on a LEFT join, hint on right -> `ShuffledHashJoin LeftOuter BuildRight`; hint on the left side -> `ShuffledHashJoin LeftOuter BuildLeft` (allowed by `canBuildShuffledHashJoinLeft`).
  - Non-equi join with BROADCAST hint, threshold -1 -> `BroadcastNestedLoopJoin BuildRight`.
- Broadcast mechanics (so the lesson can warn about size): the broadcast side is collected to the driver (`BroadcastExchangeExec.scala:186` `child.executeCollectIterator()`), built into a relation, then broadcast. UI metrics: "data size", "time to collect", "time to build", "time to broadcast" (`:129-133`). Wait limit `spark.sql.broadcastTimeout` default 300 s `SQLConf.scala:1971-1975`; max size `spark.sql.maxBroadcastTableSize` default 8 GiB (`8L << 30`) `SQLConf.scala:1976-1980`, since 4.1.0. Whether a too-large hint broadcast gives OOM: UNVERIFIED in a run (the source comment says so, `SparkStrategies.scala:156-158`).

### Claim 5. AQE converts sort-merge to broadcast at run time

- Fact: static estimate of a filtered range does not shrink: `range(0, 2000000).filter("k < 100")` is still estimated 16,000,000 bytes (observed `filtered est size 16000000`), so static planning picks SortMergeJoin. Without CBO, filter selectivity is not estimated (observation; the CBO code was not read).
- Fact: AQE re-plans with real stats: `AdaptiveSparkPlanExec.reOptimize` `adaptive/AdaptiveSparkPlanExec.scala:805-830` re-runs the planner; stage stats are marked `isRuntime = true` (`adaptive/QueryStageExec.scala:89`); `canBroadcastBySize` then reads `spark.sql.adaptive.autoBroadcastJoinThreshold` (default none, falls back to the normal threshold) `joins.scala:367-375`, `SQLConf.scala:1281`. `LogicalQueryStageStrategy` keeps an already-built broadcast stage from being reversed (`adaptive/LogicalQueryStageStrategy.scala:38-85`).
- Observed (`join2.py`, `aqe1.py`): two 2M-row ranges, one side filtered to 100 rows via a non-key column.
  - Before action: `AdaptiveSparkPlan isFinalPlan=false` ... `SortMergeJoin` with two `Exchange hashpartitioning(k, 200)`.
  - After action: `== Final Plan ==` has `BroadcastHashJoin ... BuildLeft`, `BroadcastExchange`, and `AQEShuffleRead local` (local shuffle reader), `== Initial Plan ==` still shows `SortMergeJoin`.
  - Same query with AQE off: `SortMergeJoin`.
- Local shuffle reader: `spark.sql.adaptive.localShuffleReader.enabled` default true `SQLConf.scala:1222`; the shuffle (Exchange) still ran for both sides before the decision, so the saving is on the join step, not on the shuffle write. (Fact from plan: `Exchange` is inside the final plan for both sides.)

### Claim 6. Data skew and AQE `OptimizeSkewedJoin`

File: `sql/core/src/main/scala/org/apache/spark/sql/execution/adaptive/OptimizeSkewedJoin.scala`.
- Skew threshold: `max(skewedPartitionThresholdInBytes, median partition size * skewedPartitionFactor)` `:65-68`; partition is skewed if its size is larger than that `:146,148`. Median computed over shuffle-map output sizes per reduce partition `:124-125` (`Utils.median`).
- Target split size: `max(advisoryPartitionSize, average non-skewed partition size)` `:75-83`.
- Which join sides can be split: left side for Inner, Cross, LeftSemi, LeftAnti, LeftOuter `:85-88`; right side for Inner, Cross, RightOuter `:90-92`. FullOuter: neither, so no skew handling.
- Applies to SortMergeJoin and ShuffledHashJoin `:225-240` (both children must be materialized ShuffleQueryStage with origin ENSURE_REQUIREMENTS, `:286-293`). A BroadcastHashJoin streamed side is only split when the local shuffle reader is disabled `:242-253`.
- Skew handling is dropped if it would add an extra shuffle, unless `spark.sql.adaptive.forceOptimizeSkewedJoin` (default false) `:262-283`, `SQLConf.scala:1321`.
- It does not apply to aggregations (rule only matches joins). For a skewed `groupBy`, AQE does not split a key; use salting (below). (The statement "only joins" is from the rule's match cases `:225-253`; no aggregate case exists.)
- Config defaults: `spark.sql.adaptive.skewJoin.enabled` true `SQLConf.scala:1231`; `skewedPartitionFactor` 5.0 `:1240`; `skewedPartitionThresholdInBytes` 256MB `:1250`; `advisoryPartitionSizeInBytes` 64MB `:1094`. Observed via `spark.conf.get`: `true`, `5.0`, `268435456b`, `67108864b`.
- Observed (run `skew3.py`, `skew4.py`): 2M-row left, 90% of rows have `k = 1`, payload `rand()` (random payload is needed: a repeated column compresses to almost nothing and the shuffle file sizes stay tiny), right = 1003 rows, threshold -1 (to force SMJ), `shuffle.partitions=10`.
  - Defaults (256MB): the final plan has `SortMergeJoin` and `AQEShuffleRead coalesced` on both sides, no skew handling. Data is far below 256 MB. Tell the author: on small demo data you will not see the skew rule fire unless you lower the threshold.
  - With `skewedPartitionThresholdInBytes=1MB` and `advisoryPartitionSizeInBytes=1MB`: `SortMergeJoin(skew=true)`, left `AQEShuffleRead coalesced and skewed`, right `AQEShuffleRead coalesced`. SQL metrics of the left read node: "number of skewed partitions" 1, "number of skewed partition splits" 16, "number of partitions" 17, "number of coalesced partitions" 1. The join stage ran 17 tasks (REST `numTasks`), from 10 original partitions.
  - With `skewJoin.enabled=false`: `SortMergeJoin` without `skew=true`.
  - Metric names come from `adaptive/AQEShuffleReadExec.scala:227-250`.
- Mechanism of skew (why one task is slow), observed (`salt1.py`, `salt2.py`, AQE off, 2M rows, 8 partitions): rows per partition after `repartition(8, "k")`: `[30000, 32000, 20000, 22000, 26000, 1824000, 10000, 36000]`. Hash partitioning sends one key to one partition.
- Salting, observed: add `salt = floor(rand()*64)`, `repartition(8, "k", "salt")` -> `[304651, 194813, 194594, 194227, 221456, 306860, 362598, 220801]` (max 362,598 instead of 1,824,000). With only 8 salts the spread was uneven: `[25932, 700885, 24981, 252076, 21713, 477696, 248200, 248517]` (hash collisions of the (k, salt) pairs on 8 partitions), so use more salts than partitions. Join correctness check: replicate the small side x64 with `crossJoin(range(64))` and join on `(k, salt)`: count 2,000,000 equals the plain join count (small side became 64,192 rows). The cost of salting is the replication of the small side. Wall-clock speedup of salting: UNVERIFIED (not measured).
- Detecting skew in the UI (task duration max vs median in the Stage page): UNVERIFIED in this session, but the REST fields `memoryBytesSpilled`, `numTasks`, etc. exist. SkewDemo already exists in lesson 05.

### Claim 7. repartition vs coalesce and the Exchange types

- Source: logical `Repartition(numPartitions, shuffle, child)` -> `ShuffleExchangeExec(partitioning, child, REPARTITION_BY_NUM)` if `shuffle` else `CoalesceExec`: `SparkStrategies.scala:1027-1032`. Shuffle origins: `exchange/ShuffleExchangeExec.scala:158-178` (ENSURE_REQUIREMENTS, REPARTITION_BY_COL, REPARTITION_BY_NUM, REBALANCE_PARTITIONS_BY_NONE, REBALANCE_PARTITIONS_BY_COL). PySpark `repartition`/`coalesce` `python/pyspark/sql/classic/dataframe.py` (coalesce calls `self._jdf.coalesce`).
- Observed (`part1.py`, AQE off, 16-partition range):
  - `df.repartition(8)` -> `Exchange RoundRobinPartitioning(8), REPARTITION_BY_NUM`, 8 partitions.
  - `df.repartition(8, "id")` -> `Exchange hashpartitioning(id, 8), REPARTITION_BY_NUM`.
  - `df.repartition("id")` (no number) -> `Exchange hashpartitioning(id, 200), REPARTITION_BY_COL`, 200 partitions (uses `shuffle.partitions`).
  - `df.repartitionByRange(8, "id")` -> `Exchange rangepartitioning(id ASC NULLS FIRST, 8)`, 8 partitions.
  - `df.coalesce(4)` -> `Coalesce 4` directly over the scan, no Exchange, 4 partitions.
  - `df.coalesce(32)` on 16 partitions stays 16; `repartition(32)` gives 32.
  - `coalesce(1)` after `withColumn("x", sqrt(id))`: plan is `Coalesce 1` on top of `*(1) Project` over `*(1) Range`, i.e. the WHOLE stage is in one whole-stage-codegen block under Coalesce; `repartition(1)` instead puts `Exchange SinglePartition` above the project, so the compute still runs in 16 tasks. (Claim "coalesce(1) runs the upstream with 1 task" is read from the plan, no stage/task-count measured: mark as plan-based.)
  - SQL hints: `COALESCE(3)` -> `Coalesce 3`; `REPARTITION(5)` -> `RoundRobinPartitioning(5)`; `REPARTITION(5, id)` -> `hashpartitioning(id, 5)`; `REPARTITION_BY_RANGE(5, id)` -> `rangepartitioning`. `REBALANCE` with AQE on -> `Exchange RoundRobinPartitioning(200), REBALANCE_PARTITIONS_BY_NONE` (hint resolved only when AQE is on, `sql/catalyst/.../analysis/ResolveHints.scala:285`).

### Claim 8. cache / persist

- Fact (laziness): `Dataset.cache()` -> `persist()` -> `CacheManager.cacheQuery(this, None, level)` `sql/core/src/main/scala/org/apache/spark/sql/classic/Dataset.scala:1631-1640`. `cacheQueryInternal` registers `CachedData(normalizedPlan, InMemoryRelation)` and returns without running anything `sql/core/.../execution/CacheManager.scala:133-176`. The data are built when `cachedColumnBuffers` is first accessed `execution/columnar/InMemoryRelation.scala:288-293` (`buildBuffers` `:343`). Key = normalized plan (`CacheManager.scala:71-77` class doc, `:133` comment "the cache key is the normalized plan"), so an independently rebuilt identical DataFrame hits the cache.
- Fact (levels): PySpark `df.cache()` -> JVM `cache()` -> `spark.sql.defaultCacheStorageLevel` default `MEMORY_AND_DISK` (since 4.0.0) `SQLConf.scala:2312`. PySpark `df.persist()` default is `StorageLevel.MEMORY_AND_DISK_DESER` `python/pyspark/sql/classic/dataframe.py:540-542`. Scala StorageLevel constants `common/utils/src/main/scala/org/apache/spark/storage/StorageLevel.scala:149-161` (Scala `MEMORY_ONLY` and `MEMORY_AND_DISK` are deserialized). PySpark constants are different: `python/pyspark/storagelevel.py:88-96` (`MEMORY_ONLY` = serialized, `MEMORY_AND_DISK` = serialized, `MEMORY_AND_DISK_DESER` = deserialized).
- Observed (`cache1.py`, `cache2.py`):
  - before `cache()`: `storageLevel` prints `Serialized 1x Replicated` (that is NONE), `is_cached` False. After `cache()` but before any action: `Disk Memory Deserialized 1x Replicated`, `is_cached` True, `explain()` already shows `InMemoryTableScan` + `InMemoryRelation [..], StorageLevel(disk, memory, deserialized, 1 replicas)`; JVM `isCachedColumnBuffersLoaded` False and `getRDDStorageInfo` empty (0 RDDs). After the first action: loaded True, RDD info `numCachedPartitions 200`, memSize 6376 B for a 10-row result.
  - Plan of `agg.filter("m > 3")` on top of cached `agg` -> `InMemoryTableScan [..], [isnotnull(m), (m > 3)]` (pushdown into the cached batches).
  - Independent rebuild `df.groupBy("m").count()` also shows `InMemoryTableScan` (cache hit by plan).
  - `unpersist()` then a FRESH DataFrame: no `InMemoryTableScan`. The OLD DataFrame object printed `InMemoryTableScan` in `explain()` right after `unpersist()` in `cache1.py`, but in `cache2.py` `executedPlan` of the old object had no InMemoryTableScan: inconsistent; do not make a claim about already-built DataFrames after unpersist. Safe claim: rebuild the DataFrame to see the effect.
  - `persist` levels, printed `df.storageLevel` after `persist(...)`+`count()`: `MEMORY_ONLY` -> `Memory Serialized 1x`; `MEMORY_AND_DISK` -> `Disk Memory Serialized 1x`; `MEMORY_AND_DISK_DESER` -> `Disk Memory Deserialized 1x`; `DISK_ONLY` -> `Disk Serialized`; `OFF_HEAP` -> `Disk Memory OffHeap Serialized`; `MEMORY_AND_DISK_2` -> `Disk Memory Serialized 2x`.
  - `persist(DISK_ONLY)` then `persist(MEMORY_ONLY)` on the same DataFrame: level stays `Disk Serialized` (second call is ignored; source logs "Asked to cache already cached data", `CacheManager.scala:147`).
  - SQL: `CACHE LAZY TABLE t` -> 0 RDDs materialized; `CACHE TABLE t` (eager) -> `In-memory table t`, 16 cached partitions.
- Fact + observed (partition count of a cached shuffle result): `CacheManager.getOrCloneSessionWithConfigsOff` turns OFF `spark.sql.adaptive.applyFinalStageShuffleOptimizations` while building the cache unless `spark.sql.optimizer.canChangeCachedPlanOutputPartitioning` is true (default false, internal) `CacheManager.scala:638-648`, `SQLConf.scala:1076` and `:2300`. Observed: cached `groupBy("m").count()` kept `numCachedPartitions 200` (and `agg.rdd.getNumPartitions()` of a cache hit = 200) while the uncached query gives 1 with AQE. Lesson tip: do not `cache()` right after a shuffle if 200 tiny partitions are a problem; coalesce before caching if needed (the coalesce-before-cache advice itself: UNVERIFIED).
- Observed speed (`cache2.py`, 20M rows, `sqrt`, `groupBy.agg(sum)`, one run each): uncached agg 0.64 s; first action on the cached DataFrame (materialize) 1.45 s; agg on cached 0.63 s. So for this cheap computation caching did NOT help (agg after cache equal to uncached). Use this as the honest "cache is not free" example; do not claim a speedup from this run. Cached size of 20M rows x 3 long/double columns: memSize 200,921,320 B in 16 partitions.
- Memory knobs: `spark.memory.fraction` 0.6 `core/.../internal/config/package.scala:495`; `spark.memory.storageFraction` 0.5 `:485`. Eviction behavior of cached blocks under pressure: UNVERIFIED (not run).

### Claim 9. Spill: what, where, how to see it

- Mechanism (source):
  - `Spillable.maybeSpill` `core/src/main/scala/org/apache/spark/util/collection/Spillable.scala:86-111`: every 32 elements, if the collection's memory >= its threshold it asks the task memory pool for up to double; if it is granted too little, it spills; also spills on an element-count or size force-threshold. Used by `ExternalSorter` (class at `util/collection/ExternalSorter.scala:102`, `maybeSpillCollection` `:234-247`, `spill` `:259`), i.e. the RDD-style/general sort shuffle writer and reduce-side aggregation.
  - `TaskMemoryManager.acquireExecutionMemory` `core/src/main/java/org/apache/spark/memory/TaskMemoryManager.java:159-215`: when the pool cannot grant the request it calls `spill()` on other memory consumers (smallest consumer with enough memory first, biggest otherwise, the requester last) via `trySpillAndAcquire` `:249-262`.
  - `UnsafeExternalSorter.spill` (used by SQL `SortExec`, sort-merge join buffers, etc.) `core/src/main/java/org/apache/spark/util/collection/unsafe/sort/UnsafeExternalSorter.java:226-268`; it adds `incMemoryBytesSpilled(spillSize)` and `incDiskBytesSpilled(writeMetrics.bytesWritten())` at `:265-266`.
  - `ShuffleExternalSorter.spill` (serialized/unsafe shuffle writer) `core/src/main/java/org/apache/spark/shuffle/sort/ShuffleExternalSorter.java:301-313`; disk bytes counted at `:292`.
  - Task metrics: `TaskMetrics.scala:56-57,102,107,161-162` (`memoryBytesSpilled`, `diskBytesSpilled`).
  - Comment in the code: the memory number is "more or less a multiple of the page size" and includes the pointer array, so memory spill can be larger than the disk bytes (`UnsafeExternalSorter.java:257-259`).
- Where it shows up:
  - Stage page summary and task table: "Spill (Memory)" and "Spill (Disk)", shown only when > 0: `core/src/main/scala/org/apache/spark/ui/jobs/StagePage.scala:190-198` and `:483-484`; `core/src/main/resources/org/apache/spark/ui/static/stagepage.js:1035,1045`. REST fields: `memoryBytesSpilled`, `diskBytesSpilled`.
  - SQL tab operator metric "spill size" (with "peak memory" and "sort time") on `Sort` `sql/core/.../execution/SortExec.scala:61-63`; "peak memory" and "spill size" on `HashAggregate` `aggregate/HashAggregateExec.scala:71-72`; "spill size" on `SortMergeJoin` `joins/SortMergeJoinExec.scala:50`; Window `window/WindowExec.scala:94`.
- Observed (`spill1.py`): `local[4]`, driver memory 600m (set in the builder before the JVM starts), `shuffle.partitions=2`, AQE off, `orderBy(rand)` of 6M rows with an md5 string column, noop sink. Stage 2 (the sort stage, 2 tasks): `memoryBytesSpilled 352,318,848` (336 MiB), `diskBytesSpilled 288,508,141` (about 275 MiB). SQL tab `Sort` node: "spill size" 336.0 MiB total (168 MiB per task), "peak memory" 176 MiB (88 MiB per task), "sort time" 262 ms total. The stage memory-spill number equals the Sort node spill size. Executor storage memory reported: `maxMemory` 188,743,680 B.
- Spill is not an error: the job succeeded. Spill is slower because of disk writes and a merge of spill files (the "slower" part is source-reasoned, wall-clock not measured here).
- `spark.shuffle.spill.numElementsForceSpillThreshold` is internal, default Integer.MAX_VALUE `core/.../config/package.scala:1615-1622`; SQL buffers: `spark.sql.sortMergeJoinExec.buffer.spill.threshold` internal `SQLConf.scala:4326`. Do not present these as user knobs.
- Ways to reduce spill (more memory, more partitions, less data per task): these are the standard reasoning, tied to the per-task share of execution memory in the pool; the exact sizing formula (UnifiedMemoryManager) was NOT read: UNVERIFIED.

### Claim 10. Which shuffle writer is used

Source `core/src/main/scala/org/apache/spark/shuffle/sort/SortShuffleManager.scala`, `registerShuffle` `:90-109`:
1. `BypassMergeSortShuffleHandle` if `SortShuffleWriter.shouldBypassMergeSort`: no map-side combine AND `numPartitions <= spark.shuffle.sort.bypassMergeThreshold` (default 200) `SortShuffleWriter.scala:118-126`, `core/.../internal/config/package.scala:1750-1756`. Writes one file per reduce partition, then concatenates (more open files and buffers).
2. else `SerializedShuffleHandle` (UnsafeShuffleWriter) if `canUseSerializedShuffle` `SortShuffleManager.scala:227-246`: serializer supports relocation of serialized objects AND no map-side combine AND `numPartitions <= 16,777,216` (`MAX_SHUFFLE_OUTPUT_PARTITIONS_FOR_SERIALIZED_MODE = PackedRecordPointer.MAXIMUM_PARTITION_ID + 1`, `:204-205`). SQL's `UnsafeRowSerializer` supports relocation: `sql/core/.../execution/UnsafeRowSerializer.scala:48`.
3. else the general `SortShuffleWriter` (deserialized objects, `ExternalSorter`).
`getWriter` maps the handle to the writer class `:145-176`.

Observed (`shufflew.py`, AQE off, groupBy partial/final aggregation, read `ShuffleExchangeExec.shuffleDependency.shuffleHandle` through py4j; `mapSideCombine` False for SQL exchanges):
- `shuffle.partitions` 8 -> `BypassMergeSortShuffleHandle`; 200 -> `BypassMergeSortShuffleHandle`; 201 -> `SerializedShuffleHandle`; 5000 -> `SerializedShuffleHandle`.
- So the SQL default of 200 partitions sits exactly on the bypass boundary; one more partition switches to the serialized sort writer. Which one is faster is a workload question: UNVERIFIED (not benchmarked).
- Observation about SQL: Spark SQL aggregation does map-side partial aggregation as a separate `HashAggregate` operator, not as `mapSideCombine`, which is why SQL shuffles are eligible for bypass/serialized (observed `mapSideCombine False`).
- Not observed: a `reduceByKey` (mapSideCombine true) handle; not needed for a PySpark DataFrame audience.

### Claim 11. Data locality levels

- Fact: `TaskLocality` order is `PROCESS_LOCAL, NODE_LOCAL, NO_PREF, RACK_LOCAL, ANY` `core/src/main/scala/org/apache/spark/scheduler/TaskLocality.scala:25`.
- Fact: delay scheduling: the task set tries the best allowed level and moves to a worse level after the wait. `getLocalityWait` `core/.../scheduler/TaskSetManager.scala:1339-1354` reads `spark.locality.wait.process/.node/.rack`; each falls back to `spark.locality.wait`, default `3s`: `core/.../internal/config/package.scala:812-815` and `:2215-2225`. Levels with no wait configured (NO_PREF, ANY) return 0. Scheduling logic `getAllowedLocalityLevel` `:621-682`.
- Not observed: local mode has a single executor and no HDFS; behavior of locality on a cluster is UNVERIFIED here. The Spark UI Stage page "Locality Level" column exists (name only, did not grep the file).

### Claim 12. Common config defaults (re-read in source)

| key | default | source |
|---|---|---|
| spark.sql.shuffle.partitions | 200 | SQLConf.scala:1000 |
| spark.sql.adaptive.enabled | true | SQLConf.scala:1050 |
| spark.sql.adaptive.coalescePartitions.enabled | true | SQLConf.scala:1102 |
| spark.sql.adaptive.coalescePartitions.parallelismFirst | true | SQLConf.scala:1111 |
| spark.sql.adaptive.coalescePartitions.minPartitionSize | 1MB | SQLConf.scala:1125 |
| spark.sql.adaptive.coalescePartitions.initialPartitionNum | none (= shuffle.partitions) | SQLConf.scala:1147 |
| spark.sql.adaptive.advisoryPartitionSizeInBytes | 64MB (fallback to internal targetPostShuffleInputSize) | SQLConf.scala:1094, 1042 |
| spark.sql.adaptive.skewJoin.enabled | true | SQLConf.scala:1231 |
| spark.sql.adaptive.skewJoin.skewedPartitionFactor | 5.0 | SQLConf.scala:1240 |
| spark.sql.adaptive.skewJoin.skewedPartitionThresholdInBytes | 256MB | SQLConf.scala:1250 |
| spark.sql.adaptive.forceOptimizeSkewedJoin | false | SQLConf.scala:1321 |
| spark.sql.adaptive.localShuffleReader.enabled | true | SQLConf.scala:1222 |
| spark.sql.adaptive.autoBroadcastJoinThreshold | none (= autoBroadcastJoinThreshold) | SQLConf.scala:1281 |
| spark.sql.adaptive.maxShuffledHashJoinLocalMapThreshold | 0 | SQLConf.scala:1291 |
| spark.sql.autoBroadcastJoinThreshold | 10MB (prints 10485760b) | SQLConf.scala:949 |
| spark.sql.join.preferSortMergeJoin (internal) | true | SQLConf.scala:900 |
| spark.sql.shuffledHashJoinFactor | 3 | SQLConf.scala:956 |
| spark.sql.broadcastTimeout | 300 (seconds) | SQLConf.scala:1971 |
| spark.sql.maxBroadcastTableSize | 8 GiB | SQLConf.scala:1976 |
| spark.sql.defaultCacheStorageLevel | MEMORY_AND_DISK | SQLConf.scala:2312 |
| spark.sql.files.maxPartitionBytes | 128MB | SQLConf.scala:2706 |
| spark.sql.execution.pythonUDF.arrow.enabled | true | SQLConf.scala:4775 |
| spark.memory.fraction | 0.6 | core/.../config/package.scala:495 |
| spark.memory.storageFraction | 0.5 | core/.../config/package.scala:485 |
| spark.shuffle.sort.bypassMergeThreshold | 200 | core/.../config/package.scala:1750 |
| spark.locality.wait | 3s | core/.../config/package.scala:812 |
| spark.driver.maxResultSize | 1g | core/.../config/package.scala:1649 |

Runtime values observed: `autoBroadcastJoinThreshold` `10485760b`; `shuffle.partitions` `200`; `adaptive.enabled` `true`; skew defaults `true 5.0 268435456b`; advisory `67108864b`; `defaultCacheStorageLevel` `MEMORY_AND_DISK`; `arrow udf default: true`.

---------------------------------------------------------------------------------------------------

## 3. Anti-patterns and the evidence

### 3.1 `collect()` / `toPandas()` on large data
- Fact: `spark.driver.maxResultSize` default 1g `core/.../config/package.scala:1649`; the driver aborts when the serialized task results exceed it.
- Observed (`anti1.py`, builder config `maxResultSize=1m`): `spark.range(0, 2_000_000).collect()` raised a SparkException containing `Total size of serialized results of 1 tasks (2.4 MiB) is bigger than spark.driver.maxResultSize (1024.0 KiB)`. The same message also logged at ERROR for 2, 3, 4 tasks as results arrived.
- Memory of the Python side after a successful collect: UNVERIFIED (not measured). Note `toPandas` was not run (pandas/pyarrow are not installed in the venv).

### 3.2 Python UDF instead of a built-in expression
- Plan evidence (`anti1.py`): `df.select(plus1("id"))` -> `BatchEvalPython [plus1(id)]` between two whole-stage-codegen blocks (`*(2) Project` over `BatchEvalPython` over `*(1) Range`), while `df.select(id + 1)` is one `*(1) Project` over `*(1) Range`. A Python UDF breaks whole-stage codegen and ships rows to a Python worker.
- Timing, this machine only (2M rows, `local[4]`, noop sink, median of 3, AQE off): built-in 0.07 s; Python UDF 3.99 s; with `pythonUDF.arrow.enabled=false` 3.96 s (same plan, same time).
- IMPORTANT environment fact: the venv has no pyarrow/pandas. PySpark warned `Arrow optimization failed to enable because PyArrow or Pandas is not installed. Falling back to a non-Arrow-optimized UDF` (`python/pyspark/sql/udf.py:121`), so both timings are the non-Arrow path (plan `BatchEvalPython`), even though the Arrow flag default is true in 4.2 (`SQLConf.scala:4775`). So the author must not claim "Arrow-optimized UDF is as slow" from this run; the Arrow plan (`ArrowEvalPython`) was NOT observed. That belongs to the UDF lesson (udf.mdx).

### 3.3 Too many small partitions
- See Claim 2 table of timings: 2 / 200 / 2000 shuffle partitions on 100k rows = 0.21 / 0.49 / 1.17 s (median of 5, AQE off). Also Claim 8: a cached aggregate keeps its 200 partitions.
- A partition count too LOW is the mirror problem (spill, long tasks, `coalesce(1)` pitfall, Claim 7).

### 3.4 `count(distinct)` shapes (AQE on, 100k rows)
- Single `countDistinct("a")`: two-step distinct: `HashAggregate(keys=[a])` + `Exchange hashpartitioning(a, 200)` + `HashAggregate(keys=[a])` + partial count + `Exchange SinglePartition` + final count. Two shuffles.
- Two `countDistinct("a"), countDistinct("b")`: Catalyst rewrites with `Expand [[a, null, 1], [null, b, 2]]` and a `gid` column, aggregates on `(a, b, gid)`, then counts with `FILTER (WHERE gid = ...)`. The row count after Expand is (number of distinct aggregates) x input rows. Observed plan (also with `groupBy("g")`: `Expand [[g, a, null, 1], [g, null, b, 2]]` and `Exchange hashpartitioning(g, a, b, gid, 200)`).
- `approx_count_distinct("a")`: `HashAggregate` partial + one `Exchange SinglePartition` + final, no distinct-key shuffle (rsd 0.05 shown in the plan as `approx_count_distinct(a, 0.05, 0, 0)`).
- Timing for these shapes: UNVERIFIED (plan evidence only). Accuracy tradeoff of `approx_count_distinct`: only the default relative error 0.05 appears in the plan; the error bound claim itself was not tested.

### 3.5 Not covered (do not claim)
- Skewed `groupBy` with AQE: UNVERIFIED beyond "the skew rule matches joins only".
- Dynamic partition pruning, bucketing, storage-partitioned joins: not touched in this note.
- Kryo, off-heap, external shuffle service, dynamic allocation: not touched.
- Cluster behaviors (network cost of broadcast, locality waits, speculative execution): not observable in local mode.

---------------------------------------------------------------------------------------------------

## 4. Quiz (5 questions, answerable from the facts above)

1. Q: You join a 2M-row table with a 100-row table. `autoBroadcastJoinThreshold` is the default and the plan shows `SortMergeJoin`. Name two things to check.
   A: (a) the planner's size ESTIMATE of the small side (after pruning) may be above 10 MB, or the join type forbids broadcasting that side (e.g. small table on the left of a LEFT JOIN, or FULL OUTER); (b) the threshold may be -1. Fix with a `broadcast` hint (when applicable) or `F.broadcast`. Justification: `canBroadcastBySize` compares the estimated side size `<=` threshold, and `canBuildBroadcastLeft/Right` restrict sides per join type (`joins.scala:367-390`); observed LEFT JOIN with small on the left stays SortMergeJoin.

2. Q: Why does `df.groupBy(id % 7).count()` return 1 partition with AQE on, and what do you get with `df.repartition(200)` under AQE?
   A: 1 (AQE coalesced the 200 small shuffle partitions); 200 (an explicit `repartition(n)` has origin REPARTITION_BY_NUM, which `CoalesceShufflePartitions` does not touch). Justification: `CoalesceShufflePartitions.scala:38-40`; observed 1 / 200.

3. Q: A join has one key with 90% of the rows. With default AQE settings on a 50 MB shuffle, will `OptimizeSkewedJoin` fire? What is the rule?
   A: No. A partition is skewed only if it is larger than `skewedPartitionThresholdInBytes` (256 MB) AND larger than `skewedPartitionFactor` (5.0) x the median partition size; 50 MB total can never exceed 256 MB in one partition. Justification: `OptimizeSkewedJoin.scala:65-68`, `SQLConf.scala:1240,1250`; observed no skew handling with defaults and `SortMergeJoin(skew=true)` after lowering the threshold to 1MB.

4. Q: You call `df.cache()` and `explain()` already shows `InMemoryTableScan`. Has any data been cached? How do you know the cache is filled?
   A: No data yet; `cache()` only registers the plan, the first action materializes it (`isCachedColumnBuffersLoaded` was False before the action, True after; Storage tab / `getRDDStorageInfo` shows cached partitions). Justification: `CacheManager.scala:133-176`, `InMemoryRelation.scala:288-293`; observed 0 RDDs before and 200 cached partitions after.

5. Q: `shuffle.partitions` is 200 and then 201. What changes about the shuffle writer, and what does that tell you about the default?
   A: 200 uses `BypassMergeSortShuffleWriter` (no map-side combine and partitions <= `spark.shuffle.sort.bypassMergeThreshold`=200), 201 uses the serialized `UnsafeShuffleWriter`. The default sits right on the bypass boundary. Justification: `SortShuffleManager.scala:90-109`, `SortShuffleWriter.scala:118-126`; observed handle classes `BypassMergeSortShuffleHandle` vs `SerializedShuffleHandle`.

Spare questions if the author wants a sixth:
- Q: Where do you see that a stage spilled? A: Stage page "Spill (Memory)" / "Spill (Disk)", SQL tab "spill size" on Sort/HashAggregate/SortMergeJoin; observed 336 MiB memory spill and about 275 MiB disk spill for a 6M-row sort with 600m driver memory.
- Q: `coalesce(1)` vs `repartition(1)` before a heavy `withColumn`. A: coalesce has no Exchange so the upstream project runs under it (fewer tasks); repartition(1) adds `Exchange SinglePartition` after the compute. Plan-based.

---------------------------------------------------------------------------------------------------

## 5. Practical notes for the author (demos on this machine)

- Use computed keys (`id % 7`) so that `Exchange` appears; grouping on the raw `spark.range` id gives no shuffle.
- For a hint demo use a 100-row side and a 2M-row side: `small` is 800 B and `big` 16,000,000 B in the estimate. Set `spark.sql.adaptive.enabled=false` to see the static plan; leave it true and call an action on the same DataFrame to show `isFinalPlan=true`.
- For a self-join of the same range the second side shows `ReusedExchange`; use `range(0, 2_000_001)` for a distinct side.
- Skew demo needs either 256 MB+ partitions or lowered `skewedPartitionThresholdInBytes` / `advisoryPartitionSizeInBytes` (1MB worked) AND a non-compressible payload column (`rand()`), otherwise shuffle bytes stay tiny.
- Spill demo needs `.config("spark.driver.memory", "600m")` in the builder before the first JVM start (and a fresh Python process, otherwise the JVM is already running). `spark_session.get_spark` has no config argument; the demo would need its own builder.
- Windows: no parquet writes; the `noop` format (`df.write.format("noop").mode("overwrite").save()`) works for forcing execution without output.
- Startup prints `WARN Utils: Service 'SparkUI' could not bind on port 4040` when another session is alive; UI URL is in `sc.uiWebUrl` (host name `Larmeal`).
- Python-side arrow: pyarrow/pandas are not installed in the venv; Arrow-optimized UDF and `toPandas` examples cannot run here.
- Scripts used live in the session scratchpad (not in the repo): `join1.py, join2.py, join3.py, aqe1.py, aqe2.py, skew2.py, skew3.py, skew4.py, salt1.py, salt2.py, cache1.py, cache2.py, part1.py, shufflew.py, spill1.py, anti1.py, misc1.py` under `<scratchpad>\`.

## 6. UNVERIFIED list (do not state as fact)

- Why `Range.groupBy(id)` has no Exchange (observation only).
- OOM when broadcasting a table that is too large (source comment only).
- Wall-clock speedup from salting, from skew-join splitting, or from caching a heavy pipeline.
- Shuffle writer performance difference between bypass and serialized.
- UnifiedMemoryManager sizing of per-task execution memory; storage memory eviction under pressure.
- Locality behavior on a cluster; the Spark UI "Locality Level" column.
- Arrow-optimized Python UDF plan and speed (pyarrow missing in this venv).
- Timing of the `count(distinct)` shapes; `approx_count_distinct` accuracy.
- Behavior of an already-built DataFrame after `unpersist()` (two runs disagreed).
- Coalesce-before-cache advice.
- Scan partitioning from `maxPartitionBytes` (no parquet/file demo possible here).
