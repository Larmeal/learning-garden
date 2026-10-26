const fs = require("fs");
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const asm = JSON.parse(fs.readFileSync(".ua/intermediate/assembled-graph.json", "utf8"));
const ids = new Set(asm.nodes.map(n => n.id));
const E = "file:sql/core/src/main/scala/org/apache/spark/sql/execution/";
const D = E + "datasources/";
const planning = [D + "DataSourceStrategy.scala", D + "FileSourceStrategy.scala", D + "PruneFileSourcePartitions.scala"];
const scan = [E + "DataSourceScanExec.scala", D + "FileScanRDD.scala", D + "FilePartition.scala"];
const files = [D + "HadoopFsRelation.scala", D + "FileIndex.scala", D + "PartitioningAwareFileIndex.scala", D + "InMemoryFileIndex.scala"];
const formats = [D + "FileFormat.scala", D + "parquet/ParquetFileFormat.scala", D + "parquet/ParquetFilters.scala"];
const layers = JSON.parse(JSON.stringify(g.layers));
layers.push({
  id: "layer:data-source-read-path",
  name: "Data Source Read Path",
  description: "How a file-based read such as spark.read.parquet(...).filter(...) becomes a scan: the planning strategies and pruning rule, the file index and relation, the scan operator and RDD that read splits, and the file format with Parquet filter pushdown.",
  nodeIds: planning.concat(scan, files, formats)
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
  title: "Planning a file scan",
  description: "FileSourceStrategy and DataSourceStrategy are planner strategies (listed in SparkPlanner) that turn a logical relation into a scan operator. FileSourceStrategy splits the filters into partition filters, data filters and post-scan filters, works out the required columns and the bucket set, and creates FileSourceScanExec. DataSourceStrategy handles V1 sources and translates Catalyst filters to source filters. PruneFileSourcePartitions is an early optimizer rule that prunes partitions using the file index. HadoopFsRelation ties a FileIndex, a FileFormat and the schemas together.",
  nodeIds: planning.concat([D + "HadoopFsRelation.scala"])
});
tour.push({
  order: n0 + 2,
  title: "Listing, splitting and reading files",
  description: "FileIndex implementations (PartitioningAwareFileIndex, InMemoryFileIndex) list leaf files, discover partition columns and cache the listing. FileSourceScanExec turns the selected partitions into FilePartitions (bin-packed splits up to maxSplitBytes) and a FileScanRDD, which opens each PartitionedFile with the reader function built by FileFormat.buildReaderWithPartitionValues. ParquetFileFormat builds that reader, choosing the vectorized or parquet-mr reader, and ParquetFilters converts Catalyst predicates to Parquet predicates for row group filtering.",
  nodeIds: scan.concat(files.slice(1), formats)
});
tour.forEach(s => s.nodeIds.forEach(id => { if (!ids.has(id)) throw new Error("tour node missing " + id); }));
fs.writeFileSync(".ua/intermediate/tour.json", JSON.stringify(tour, null, 2));
console.log("layers", layers.length, "tour", tour.length);
