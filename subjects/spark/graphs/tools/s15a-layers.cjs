const fs = require("fs");
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const asm = JSON.parse(fs.readFileSync(".ua/intermediate/assembled-graph.json", "utf8"));
const ids = new Set(asm.nodes.map(n => n.id));
const J = "file:sql/catalyst/src/main/java/org/apache/spark/sql/connector/catalog/";
const SC = "file:sql/catalyst/src/main/scala/org/apache/spark/sql/";
const E = "file:sql/core/src/main/scala/org/apache/spark/sql/execution/datasources/v2/";
const catalog = ["Table", "TableCatalog", "CatalogPlugin", "SupportsRead", "SupportsWrite", "TableCapability", "SupportsRowLevelOperations", "StagingTableCatalog"].map(x => J + x + ".java")
  .concat(["CatalogManager", "Catalogs", "V1Table"].map(x => SC + "connector/catalog/" + x + ".scala"));
const plan = [SC + "execution/datasources/v2/DataSourceV2Relation.scala", E + "DataSourceV2Strategy.scala", E + "V2ScanRelationPushDown.scala", E + "PushDownUtils.scala", E + "DataSourceV2Utils.scala"];
const scan = [E + "BatchScanExec.scala", E + "DataSourceRDD.scala", E + "FileTable.scala", E + "FileScan.scala", E + "FileDataSourceV2.scala"];
const write = [E + "V2Writes.scala", E + "WriteToDataSourceV2Exec.scala"];
const all = catalog.concat(plan, scan, write);
const layers = JSON.parse(JSON.stringify(g.layers));
layers.forEach(l => { l.nodeIds = l.nodeIds.filter(i => !all.includes(i)); });
layers.push({
  id: "layer:datasource-v2",
  name: "DataSource V2 and Catalogs",
  description: "The V2 data source and catalog API that table formats and connectors plug into: the Table and catalog interfaces with capabilities, CatalogManager and the session catalog, DataSourceV2Relation, the strategy and optimizer rule that plan scans with pushdown, the scan execution and RDD, the file based V2 sources, and the V2 write path.",
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
  title: "DataSource V2: tables, catalogs and capabilities",
  description: "In the V2 API a data source is a Table found through a catalog. CatalogManager resolves catalog names (spark_catalog is the session catalog, which can delegate to a user configured implementation; other names come from spark.sql.catalog.<name> and are loaded by Catalogs). A Table declares its schema, partitioning and TableCapability values, and mixes in SupportsRead or SupportsWrite to hand out scan and write builders. DataSourceV2Relation is the logical plan leaf that wraps the table.",
  nodeIds: catalog.concat([plan[0]])
});
tour.push({
  order: n0 + 2,
  title: "DataSource V2: scans, pushdown and writes",
  description: "The optimizer rule V2ScanRelationPushDown creates the ScanBuilder and pushes sample, filters, joins, aggregates, variants, limit and offset and column pruning into it (PushDownUtils), leaving in Spark whatever the source cannot handle. DataSourceV2Strategy then plans a BatchScanExec whose partitions are read by DataSourceRDD through a PartitionReaderFactory. Writes go through V2Writes, which builds the Write, and the exec nodes in WriteToDataSourceV2Exec, which run one DataWriter per task and finish with an atomic BatchWrite commit or an abort. The file based sources (FileTable, FileScan) implement the same interfaces.",
  nodeIds: plan.slice(1).concat(scan, write)
});
tour.forEach(s => s.nodeIds.forEach(id => { if (!ids.has(id)) throw new Error("tour node missing " + id); }));
fs.writeFileSync(".ua/intermediate/tour.json", JSON.stringify(tour, null, 2));
console.log("layers", layers.length, "tour", tour.length);
