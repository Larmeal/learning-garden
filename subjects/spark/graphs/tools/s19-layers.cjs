const fs = require("fs");
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const asm = JSON.parse(fs.readFileSync(".ua/intermediate/assembled-graph.json", "utf8"));
const ids = new Set(asm.nodes.map(n => n.id));
const K = "file:sql/core/src/main/scala/org/apache/spark/sql/classic/";
const A = "file:sql/api/src/main/scala/org/apache/spark/sql/";
const api = ["Column", "Row", "Encoder", "Encoders", "AnalysisException", "SparkSession", "Dataset", "DataFrameReader", "DataFrameWriter"].map(x => A + x + ".scala");
const classic = ["SparkSession", "Dataset", "DataFrameReader", "DataFrameWriter", "DataFrameWriterV2", "RelationalGroupedDataset", "KeyValueGroupedDataset", "Catalog", "RuntimeConfig", "SQLContext", "UDFRegistration", "conversions", "columnNodeSupport", "DataFrameNaFunctions", "DataFrameStatFunctions", "ObservationManager", "TableValuedFunction", "SQLImplicits", "DataStreamReader", "DataStreamWriter", "StreamingQueryManager"].map(x => K + x + ".scala");
const all = api.concat(classic);
const layers = JSON.parse(JSON.stringify(g.layers));
layers.forEach(l => { l.nodeIds = l.nodeIds.filter(i => !all.includes(i)); });
layers.push({
  id: "layer:scala-dataframe-api",
  name: "Scala DataFrame API and SparkSession",
  description: "The Scala and Java user API: the abstract API classes in sql/api shared by classic Spark and Spark Connect (SparkSession, Dataset, Column, Row, Encoders, readers and writers), and the classic implementations in sql/core: SparkSession with its session and shared state, Dataset as a logical plan plus QueryExecution, grouped datasets, DataFrameReader and Writer, Catalog, RuntimeConfig, UDFRegistration, streaming reader, writer and query manager, and the conversion of the API column tree to Catalyst expressions.",
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
  title: "SparkSession and Dataset in Scala",
  description: "SparkSession is the entry point. The API classes in sql/api are abstract so that the same code can run on classic Spark or Spark Connect; the classic SparkSession builds its sessionState and sharedState lazily, and sql() and the readers create Datasets. A classic Dataset is a logical plan plus a QueryExecution: transformations such as select, filter, join and groupBy create a new Dataset around a new LogicalPlan, and actions such as collect and count run the plan through the execution pipeline. Column wraps an expression tree that conversions and columnNodeSupport translate into Catalyst expressions.",
  nodeIds: [A + "SparkSession.scala", K + "SparkSession.scala", A + "Dataset.scala", K + "Dataset.scala", A + "Column.scala", K + "columnNodeSupport.scala", K + "conversions.scala", K + "RelationalGroupedDataset.scala", K + "KeyValueGroupedDataset.scala", A + "Row.scala", A + "Encoder.scala", A + "Encoders.scala"]
});
tour.push({
  order: n0 + 2,
  title: "Reading, writing, catalog and configuration",
  description: "DataFrameReader resolves a data source into a plan when load is called, and DataFrameWriter (and the V2 writer) turn save, saveAsTable and insertInto into commands that are executed. The streaming reader and writer, together with StreamingQueryManager, start and track streaming queries. Catalog exposes databases, tables, functions and caching, RuntimeConfig gives access to SQL settings, and UDFRegistration registers user defined functions by name.",
  nodeIds: [A + "DataFrameReader.scala", K + "DataFrameReader.scala", A + "DataFrameWriter.scala", K + "DataFrameWriter.scala", K + "DataFrameWriterV2.scala", K + "DataStreamReader.scala", K + "DataStreamWriter.scala", K + "StreamingQueryManager.scala", K + "Catalog.scala", K + "RuntimeConfig.scala", K + "UDFRegistration.scala"]
});
tour.forEach(s => s.nodeIds.forEach(id => { if (!ids.has(id)) throw new Error("tour node missing " + id); }));
fs.writeFileSync(".ua/intermediate/tour.json", JSON.stringify(tour, null, 2));
console.log("layers", layers.length, "tour", tour.length);
