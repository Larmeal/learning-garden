const fs = require("fs");
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const asm = JSON.parse(fs.readFileSync(".ua/intermediate/assembled-graph.json", "utf8"));
const ids = new Set(asm.nodes.map(n => n.id));
const A = "file:core/src/main/scala/org/apache/spark/";
const J = "file:core/src/main/java/org/apache/spark/shuffle/sort/";
const mgr = ["shuffle/ShuffleManager", "shuffle/sort/SortShuffleManager", "shuffle/ShuffleHandle", "shuffle/BaseShuffleHandle", "shuffle/ShuffleWriter", "shuffle/ShuffleReader", "shuffle/ShuffleBlockResolver", "shuffle/IndexShuffleBlockResolver", "shuffle/ShuffleWriteProcessor"].map(x => A + x + ".scala");
const writers = [A + "shuffle/sort/SortShuffleWriter.scala", A + "shuffle/ShufflePartitionPairsWriter.scala", A + "storage/DiskBlockObjectWriter.scala", A + "util/collection/ExternalSorter.scala", A + "util/collection/AppendOnlyMap.scala", A + "util/collection/PartitionedAppendOnlyMap.scala"]
  .concat(["BypassMergeSortShuffleWriter", "UnsafeShuffleWriter", "ShuffleExternalSorter", "ShuffleInMemorySorter"].map(x => J + x + ".java"));
const readers = [A + "shuffle/BlockStoreShuffleReader.scala", A + "storage/ShuffleBlockFetcherIterator.scala", A + "shuffle/FetchFailedException.scala", A + "storage/BlockManager.scala"];
const layers = JSON.parse(JSON.stringify(g.layers));
const all = mgr.concat(writers, readers);
layers.forEach(l => { l.nodeIds = l.nodeIds.filter(i => !all.includes(i)); });
layers.push({
  id: "layer:shuffle-and-blocks",
  name: "Shuffle and Block Storage",
  description: "The shuffle subsystem: the ShuffleManager and handle abstraction, the three map-side writers (bypass merge sort, unsafe serialized sort, general sort) with their sorters and spill files, the index and data file resolver, the reduce-side reader and block fetch iterator, and the BlockManager that stores and serves blocks.",
  nodeIds: all
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
  title: "Writing shuffle output on the map side",
  description: "A ShuffleMapTask calls ShuffleWriteProcessor.write, which asks the ShuffleManager (SortShuffleManager) for a ShuffleWriter chosen by the shuffle handle. BypassMergeSortShuffleWriter writes one file per reduce partition and concatenates them (used when there is no map-side combine and few partitions); UnsafeShuffleWriter serializes records into pages, sorts compact pointers (ShuffleExternalSorter, ShuffleInMemorySorter) and merges spill files; SortShuffleWriter uses ExternalSorter with an AppendOnlyMap for aggregation. All of them end with one data file plus an index file per map task, managed by IndexShuffleBlockResolver, and DiskBlockObjectWriter does the buffered file writing.",
  nodeIds: mgr.concat(writers)
});
tour.push({
  order: n0 + 2,
  title: "Reading shuffle data on the reduce side",
  description: "BlockStoreShuffleReader asks the MapOutputTracker which executors hold the map outputs for its reduce partitions, then ShuffleBlockFetcherIterator fetches the blocks: local and host-local blocks are read directly, remote blocks are requested over the network within limits (maxBytesInFlight and related settings), with retries and optional corruption checks. Failures surface as FetchFailedException, which the DAGScheduler handles by resubmitting the map stage. Records are then deserialized and, if needed, aggregated or sorted with ExternalSorter.",
  nodeIds: readers.slice(0, 3).concat([A + "util/collection/ExternalSorter.scala", A + "MapOutputTracker.scala"])
});
tour.push({
  order: n0 + 3,
  title: "BlockManager: where blocks live",
  description: "BlockManager is the per-executor (and driver) storage service for blocks: cached RDD partitions, broadcast variables, shuffle blocks and task results. It coordinates a memory store and a disk store, reports block status to the driver, serves remote fetch requests, replicates blocks and supports block migration during decommissioning. Shuffle files are served through it and the IndexShuffleBlockResolver.",
  nodeIds: [A + "storage/BlockManager.scala", A + "storage/DiskBlockObjectWriter.scala", A + "shuffle/IndexShuffleBlockResolver.scala"]
});
tour.forEach(s => s.nodeIds.forEach(id => { if (!ids.has(id)) throw new Error("tour node missing " + id); }));
fs.writeFileSync(".ua/intermediate/tour.json", JSON.stringify(tour, null, 2));
console.log("layers", layers.length, "tour", tour.length);
