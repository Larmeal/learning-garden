const fs = require("fs");
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const asm = JSON.parse(fs.readFileSync(".ua/intermediate/assembled-graph.json", "utf8"));
const ids = new Set(asm.nodes.map(n => n.id));
const C = "file:core/src/main/scala/org/apache/spark/";
const rdd = ["PairRDDFunctions", "OrderedRDDFunctions", "MapPartitionsRDD", "ParallelCollectionRDD", "UnionRDD", "CoalescedRDD", "CoGroupedRDD", "CartesianRDD", "ZippedPartitionsRDD", "HadoopRDD", "NewHadoopRDD", "RDDBarrier", "RDDCheckpointData", "ReliableCheckpointRDD", "ReliableRDDCheckpointData", "LocalRDDCheckpointData"].map(x => C + "rdd/" + x + ".scala");
const shared = [C + "Partitioner.scala", C + "Partition.scala", C + "broadcast/Broadcast.scala", C + "broadcast/TorrentBroadcast.scala", C + "broadcast/BroadcastManager.scala", C + "util/AccumulatorV2.scala"];
const moved = [C + "rdd/RDD.scala", C + "Dependency.scala"];
const conf = [C + "SparkConf.scala"];
const blocks = ["file:common/utils/src/main/scala/org/apache/spark/storage/StorageLevel.scala", C + "storage/BlockId.scala"];
const V2 = "file:sql/core/src/main/scala/org/apache/spark/sql/execution/datasources/v2/";
const v2 = ["DataSourceV2ScanExecBase", "V2CommandExec", "MicroBatchScanExec", "ContinuousScanExec"].map(x => V2 + x + ".scala");
const sorter = ["file:core/src/main/java/org/apache/spark/util/collection/unsafe/sort/UnsafeInMemorySorter.java"];
const lib = rdd.concat(shared, moved);
const all = lib.concat(conf, blocks, v2, sorter);
const layers = JSON.parse(JSON.stringify(g.layers));
layers.forEach(l => { l.nodeIds = l.nodeIds.filter(i => !all.includes(i)); });
const add = (name, list) => { const L = layers.find(l => l.name === name); if (!L) throw new Error("no layer " + name); list.forEach(i => L.nodeIds.push(i)); return L; };
add("Executor, Environment and Deploy", conf).description += " SparkConf holds the spark.* settings.";
add("Shuffle and Block Storage", blocks).description += " StorageLevel describes how a block is stored and BlockId names every kind of block.";
add("DataSource V2 and Catalogs", v2);
add("Memory Management and Caching", sorter);
layers.push({
  id: "layer:rdd-library",
  name: "RDD Library and Shared Variables",
  description: "The RDD API under every DataFrame: the RDD base class and dependencies, partitioners, the key/value operations (PairRDDFunctions, OrderedRDDFunctions), the concrete RDDs for narrow transformations, unions, cogroup, coalesce, zip, Hadoop input and parallelize, checkpointing, and the shared variables: broadcast (TorrentBroadcast and BroadcastManager) and accumulators (AccumulatorV2).",
  nodeIds: lib
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
  title: "The RDD library: pair operations and concrete RDDs",
  description: "Most RDD methods are thin wrappers that build one of a few RDD classes. map and filter create a MapPartitionsRDD, union a UnionRDD, coalesce a CoalescedRDD, zipPartitions a ZippedPartitionsRDD and cartesian a CartesianRDD. The key/value operations (reduceByKey, groupByKey, join, partitionBy) come from PairRDDFunctions: they end up in combineByKey or in CoGroupedRDD, and a Partitioner decides the shuffle layout. sortByKey in OrderedRDDFunctions uses a RangePartitioner. Input RDDs such as HadoopRDD and NewHadoopRDD read files and ParallelCollectionRDD turns a local collection into partitions.",
  nodeIds: [C + "rdd/RDD.scala", C + "rdd/MapPartitionsRDD.scala", C + "rdd/UnionRDD.scala", C + "rdd/CoalescedRDD.scala", C + "rdd/ZippedPartitionsRDD.scala", C + "rdd/CartesianRDD.scala", C + "rdd/PairRDDFunctions.scala", C + "rdd/CoGroupedRDD.scala", C + "rdd/OrderedRDDFunctions.scala", C + "Partitioner.scala", C + "rdd/HadoopRDD.scala", C + "rdd/NewHadoopRDD.scala", C + "rdd/ParallelCollectionRDD.scala"]
});
tour.push({
  order: n0 + 2,
  title: "Checkpoints, broadcast variables and accumulators",
  description: "RDD.checkpoint is carried by an RDDCheckpointData object: the reliable variant writes the partitions to a checkpoint directory through ReliableCheckpointRDD and cuts the lineage, the local variant keeps blocks in executor storage. A broadcast variable is created by BroadcastManager; TorrentBroadcast splits the value into blocks that executors fetch and cache through the BlockManager. An AccumulatorV2 is registered on the driver, updated by tasks through add and merged back when a task finishes. SparkConf holds the spark.* settings, and StorageLevel and BlockId describe where cached and shuffle blocks are kept.",
  nodeIds: [C + "rdd/RDDCheckpointData.scala", C + "rdd/ReliableRDDCheckpointData.scala", C + "rdd/ReliableCheckpointRDD.scala", C + "rdd/LocalRDDCheckpointData.scala", C + "broadcast/BroadcastManager.scala", C + "broadcast/TorrentBroadcast.scala", C + "broadcast/Broadcast.scala", C + "util/AccumulatorV2.scala", C + "SparkConf.scala", blocks[0], blocks[1]]
});
tour.forEach(s => s.nodeIds.forEach(id => { if (!ids.has(id)) throw new Error("tour node missing " + id); }));
fs.writeFileSync(".ua/intermediate/tour.json", JSON.stringify(tour, null, 2));
console.log("layers", layers.length, "tour", tour.length);
