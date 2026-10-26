const fs = require("fs");
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const asm = JSON.parse(fs.readFileSync(".ua/intermediate/assembled-graph.json", "utf8"));
const ids = new Set(asm.nodes.map(n => n.id));
const C = "file:core/src/main/";
const Q = "file:sql/core/src/main/scala/org/apache/spark/sql/execution/";
const mem = ["scala/org/apache/spark/memory/MemoryManager.scala", "scala/org/apache/spark/memory/UnifiedMemoryManager.scala", "scala/org/apache/spark/memory/MemoryPool.scala", "scala/org/apache/spark/memory/ExecutionMemoryPool.scala", "scala/org/apache/spark/memory/StorageMemoryPool.scala", "java/org/apache/spark/memory/TaskMemoryManager.java", "java/org/apache/spark/memory/MemoryConsumer.java", "scala/org/apache/spark/util/collection/Spillable.scala", "java/org/apache/spark/util/collection/unsafe/sort/UnsafeExternalSorter.java"].map(x => C + x);
const store = ["scala/org/apache/spark/storage/memory/MemoryStore.scala", "scala/org/apache/spark/storage/BlockInfoManager.scala", "scala/org/apache/spark/storage/DiskStore.scala", "scala/org/apache/spark/storage/DiskBlockManager.scala"].map(x => C + x);
const shuf = [C + "scala/org/apache/spark/rdd/ShuffledRDD.scala", C + "scala/org/apache/spark/scheduler/MapStatus.scala", Q + "ShuffledRowRDD.scala"];
const cache = [Q + "CacheManager.scala", Q + "columnar/InMemoryRelation.scala", Q + "columnar/InMemoryTableScanExec.scala", Q + "SortExec.scala"];
const coord = [Q + "streaming/state/StateStoreCoordinator.scala"];
const all = mem.concat(store, shuf, cache, coord);
const layers = JSON.parse(JSON.stringify(g.layers));
const L = n => layers.find(l => l.name === n);
layers.forEach(l => { l.nodeIds = l.nodeIds.filter(i => !all.includes(i)); });
// storage and shuffle read pieces join the existing shuffle layer, memory and cache get their own layer
const sb = L("Shuffle and Block Storage");
shuf.slice(0, 2).concat(store).forEach(i => sb.nodeIds.push(i));
L("Structured Streaming").nodeIds.push(...coord);
layers.push({
  id: "layer:memory-and-cache",
  name: "Memory Management and Caching",
  description: "How executors share memory and how cached data is held: the unified execution/storage memory manager and pools, per-task Tungsten memory with forced spilling, spillable sorters, the SQL cache (CacheManager, columnar InMemoryRelation and its scan), the sort operator and the reduce-side shuffle row RDD.",
  nodeIds: mem.concat([Q + "ShuffledRowRDD.scala"], cache)
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
  title: "Executor memory: one pool, shared by tasks",
  description: "UnifiedMemoryManager splits the usable heap (spark.memory.fraction of heap minus a 300MB reserve) into an execution pool and a storage pool that can borrow from each other: execution may evict cached blocks to grow, storage can only use free execution memory. Within execution memory each running task gets between 1/(2N) and 1/N of the pool. Tasks request memory through TaskMemoryManager, which can force other consumers (sorters, hash maps) to spill, and allocates Tungsten pages addressed by a 64-bit page number plus offset.",
  nodeIds: mem
});
tour.push({
  order: n0 + 2,
  title: "Where cached and shuffle data are stored",
  description: "BlockManager keeps blocks in a MemoryStore (deserialized objects or serialized bytes, evicting least recently used blocks of other RDDs when space is needed), a DiskStore (files located by DiskBlockManager in hashed sub-directories of the local dirs, which also holds shuffle files) and tracks reader/writer locks per block in BlockInfoManager. MapStatus records where each map task wrote its shuffle output and how large each partition is; ShuffledRDD and ShuffledRowRDD read shuffle data on the reduce side.",
  nodeIds: store.concat(shuf)
});
tour.push({
  order: n0 + 3,
  title: "df.cache() and sorting",
  description: "CacheManager registers a query plan to cache and later rewrites matching plans (by canonicalized form) to read the cache. The data is built lazily on the first action into compressed columnar batches (InMemoryRelation / CachedRDDBuilder) persisted through the RDD storage level, and InMemoryTableScanExec reads them, skipping batches using their statistics. SortExec sorts rows with an external sorter that spills to disk when memory is short.",
  nodeIds: cache
});
tour.forEach(s => s.nodeIds.forEach(id => { if (!ids.has(id)) throw new Error("tour node missing " + id); }));
fs.writeFileSync(".ua/intermediate/tour.json", JSON.stringify(tour, null, 2));
console.log("layers", layers.length, "tour", tour.length);
