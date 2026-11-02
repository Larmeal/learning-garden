const fs = require("fs");
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const asm = JSON.parse(fs.readFileSync(".ua/intermediate/assembled-graph.json", "utf8"));
const ids = new Set(asm.nodes.map(n => n.id));
const B = "file:sql/catalyst/src/main/java/org/apache/spark/sql/connector/";
const read = ["Scan", "ScanBuilder", "Batch", "InputPartition", "PartitionReader", "PartitionReaderFactory", "SupportsPushDownFilters", "SupportsPushDownV2Filters", "SupportsPushDownRequiredColumns", "SupportsReportPartitioning", "SupportsPushDownAggregates", "SupportsRuntimeV2Filtering", "SupportsReportStatistics", "SupportsPushDownLimit", "SupportsPushDownTopN"].map(x => B + "read/" + x + ".java");
const prov = [B + "catalog/TableProvider.java"];
const write = ["WriteBuilder", "Write", "BatchWrite", "DataWriter", "DataWriterFactory", "WriterCommitMessage", "SupportsOverwrite", "SupportsOverwriteV2", "SupportsDynamicOverwrite", "SupportsTruncate", "RowLevelOperation", "LogicalWriteInfo", "RequiresDistributionAndOrdering"].map(x => B + "write/" + x + ".java");
const all = read.concat(prov, write);
const layers = JSON.parse(JSON.stringify(g.layers));
layers.forEach(l => { l.nodeIds = l.nodeIds.filter(i => !all.includes(i)); });
const L = layers.find(l => l.name === "DataSource V2 and Catalogs");
all.forEach(i => L.nodeIds.push(i));
L.description += " The public Java interfaces connectors implement are included: TableProvider, the read side (ScanBuilder, Scan, Batch, InputPartition, PartitionReader and the pushdown and reporting mix-ins) and the write side (WriteBuilder, Write, BatchWrite, DataWriter, commit messages, overwrite and truncate modes, row level operations, required distribution and ordering).";
const bad = [];
layers.forEach(l => l.nodeIds.forEach(id => { if (!ids.has(id)) bad.push(id); }));
const seen = new Set();
layers.forEach(l => l.nodeIds.forEach(id => { if (seen.has(id)) bad.push("dup " + id); seen.add(id); }));
asm.nodes.filter(n => n.type === "file").forEach(n => { if (!seen.has(n.id)) bad.push("unassigned " + n.id); });
console.log("problems:", bad.length, bad.slice(0, 8));
if (bad.length) process.exit(1);
fs.writeFileSync(".ua/intermediate/layers.json", JSON.stringify(layers, null, 2));
const tour = JSON.parse(JSON.stringify(g.tour));
tour.push({
  order: tour.length + 1,
  title: "DataSource V2: the interfaces a connector implements",
  description: "A connector is built from small interfaces. TableProvider creates a Table. On the read side the Table returns a ScanBuilder, which can accept pushed down filters, required columns, aggregates, limit and top N through the SupportsPushDown mix-ins, and builds a Scan. The Scan produces a Batch that plans InputPartitions on the driver, and a PartitionReaderFactory that creates a PartitionReader on each executor. On the write side a WriteBuilder (with SupportsOverwrite, SupportsTruncate or SupportsDynamicOverwrite) builds a Write, whose BatchWrite creates a DataWriterFactory. Each task writes with a DataWriter and returns a WriterCommitMessage, and the driver then commits or aborts the whole job.",
  nodeIds: [B + "catalog/TableProvider.java", B + "read/ScanBuilder.java", B + "read/Scan.java", B + "read/Batch.java", B + "read/InputPartition.java", B + "read/PartitionReaderFactory.java", B + "read/PartitionReader.java", B + "write/WriteBuilder.java", B + "write/Write.java", B + "write/BatchWrite.java", B + "write/DataWriterFactory.java", B + "write/DataWriter.java", B + "write/WriterCommitMessage.java"]
});
tour.forEach(s => s.nodeIds.forEach(id => { if (!ids.has(id)) throw new Error("tour node missing " + id); }));
fs.writeFileSync(".ua/intermediate/tour.json", JSON.stringify(tour, null, 2));
console.log("layers", layers.length, "tour", tour.length);
