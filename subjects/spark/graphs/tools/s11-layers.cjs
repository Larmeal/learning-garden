const fs = require("fs");
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const asm = JSON.parse(fs.readFileSync(".ua/intermediate/assembled-graph.json", "utf8"));
const ids = new Set(asm.nodes.map(n => n.id));
const D = "file:sql/core/src/main/scala/org/apache/spark/sql/execution/streaming/";
const run = ["runtime/StreamExecution", "runtime/MicroBatchExecution", "runtime/TriggerExecutor", "runtime/StreamingQueryWrapper", "runtime/StreamingRelation", "runtime/StreamProgress", "Source", "Sink", "runtime/IncrementalExecution", "runtime/ProgressReporter"].map(x => D + x + ".scala");
const wm = ["runtime/WatermarkTracker", "runtime/WatermarkPropagator", "operators/stateful/EventTimeWatermarkExec"].map(x => D + x + ".scala");
const logs = ["checkpointing/HDFSMetadataLog", "checkpointing/OffsetSeq", "checkpointing/OffsetSeqLog", "checkpointing/CommitLog", "checkpointing/CheckpointFileManager"].map(x => D + x + ".scala");
const ops = ["operators/stateful/statefulOperators", "operators/stateful/StreamingAggregationStateManager"].map(x => D + x + ".scala");
const state = ["state/StateStore", "state/StateStoreRDD", "state/HDFSBackedStateStoreProvider", "state/RocksDBStateStoreProvider"].map(x => D + x + ".scala");
const layers = JSON.parse(JSON.stringify(g.layers));
layers.push({
  id: "layer:structured-streaming",
  name: "Structured Streaming",
  description: "How a streaming query runs: the micro-batch execution loop and triggers, incremental planning of each batch, offset and commit logs in the checkpoint, watermarks, stateful operators, and the versioned state store (HDFS-backed and RocksDB).",
  nodeIds: run.concat(wm, logs, ops, state)
});
const bad = [];
layers.forEach(l => l.nodeIds.forEach(id => { if (!ids.has(id)) bad.push(id); }));
const seen = new Set();
layers.forEach(l => l.nodeIds.forEach(id => { if (seen.has(id)) bad.push("dup " + id); seen.add(id); }));
asm.nodes.filter(n => n.type === "file").forEach(n => { if (!seen.has(n.id)) bad.push("unassigned " + n.id); });
console.log("problems:", bad.length, bad.slice(0, 8));
if (bad.length) process.exit(1);
fs.writeFileSync(".ua/intermediate/layers.json", JSON.stringify(layers, null, 2));
const tour = JSON.parse(JSON.stringify(g.tour));
const n0 = tour.length;
tour.push({
  order: n0 + 1,
  title: "The micro-batch loop",
  description: "A streaming query is a StreamExecution running on its own thread; MicroBatchExecution is the micro-batch implementation. A TriggerExecutor decides when to run a batch. Each batch: ask the sources for the latest offsets, write the planned offsets to the offset log (before processing), build an IncrementalExecution that plans the batch as a normal query over just the new data (the streaming relations are replaced by the sources' batch data), run it into the sink, then write the commit log. ProgressReporter produces the progress metrics seen in query.lastProgress.",
  nodeIds: run
});
tour.push({
  order: n0 + 2,
  title: "Checkpoint, offsets and exactly-once recovery",
  description: "The checkpoint directory holds an offset log (what range each batch will process, written first) and a commit log (which batches finished), both HDFSMetadataLog implementations that write atomically through a CheckpointFileManager. On restart the query reads the logs to decide whether to re-run the last planned batch or plan the next one, which with replayable sources and idempotent sinks gives end-to-end exactly-once. Watermarks (WatermarkTracker, WatermarkPropagator, EventTimeWatermarkExec) are tracked in the offset metadata and decide which late data is dropped and which state can be evicted.",
  nodeIds: logs.concat(wm)
});
tour.push({
  order: n0 + 3,
  title: "Stateful operators and the state store",
  description: "Operators such as streaming aggregation, deduplication and stream-stream joins keep state per key in a StateStore, one versioned key-value store per shuffle partition. StateStoreRDD loads version N for the partition, the operator updates it during the batch and commits version N+1 at the end. HDFSBackedStateStoreProvider keeps the map in memory and persists delta and snapshot files in the checkpoint; RocksDBStateStoreProvider keeps state in a local RocksDB instance and uploads its files, which allows state larger than memory. A background maintenance task writes snapshots and cleans up old versions.",
  nodeIds: ops.concat(state)
});
tour.forEach(s => s.nodeIds.forEach(id => { if (!ids.has(id)) throw new Error("tour node missing " + id); }));
fs.writeFileSync(".ua/intermediate/tour.json", JSON.stringify(tour, null, 2));
console.log("layers", layers.length, "tour", tour.length);
