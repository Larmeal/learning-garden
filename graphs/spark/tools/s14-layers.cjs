const fs = require("fs");
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const asm = JSON.parse(fs.readFileSync(".ua/intermediate/assembled-graph.json", "utf8"));
const ids = new Set(asm.nodes.map(n => n.id));
const P = "file:python/pyspark/sql/";
const api = ["session", "dataframe", "column", "group", "readwriter", "window", "types", "utils"].map(x => P + x + ".py");
const classic = ["classic/dataframe", "classic/column", "classic/window"].map(x => P + x + ".py");
const all = api.concat(classic);
const layers = JSON.parse(JSON.stringify(g.layers));
layers.push({
  id: "layer:pyspark-sql-api",
  name: "PySpark SQL API",
  description: "The public PySpark DataFrame API: abstract DataFrame, Column, Window, GroupedData, readers and writers, SparkSession and the type system, plus the classic (py4j) implementations that forward every call to the JVM Dataset. The Spark Connect implementations live in their own layer and share these parent classes.",
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
  title: "The PySpark API: one interface, two backends",
  description: "pyspark.sql.DataFrame, Column, Window and the other public classes are mostly abstract: their methods are stubs decorated with dispatch helpers from utils.py that route each call to the classic implementation (py4j proxy of the JVM Dataset) or the Spark Connect implementation (a plan built on the client) depending on the type of the object. SparkSession.builder.getOrCreate creates either a classic session over a JVM SparkContext or, in remote mode, a Connect session. Transformations such as select, filter and join only build a new DataFrame; actions such as collect, count and show are what start a job.",
  nodeIds: api
});
tour.push({
  order: n0 + 2,
  title: "Classic PySpark: a thin wrapper over the JVM",
  description: "In classic mode a DataFrame holds a py4j reference to a JVM Dataset (_jdf); each method converts Python arguments to JVM objects (_jseq, _jcols), calls the Dataset method and wraps the result in a new Python DataFrame. Column wraps a JVM Column (_jc) and builds expressions the same way. No data is processed in Python except in UDFs and when results are collected.",
  nodeIds: classic.concat([P + "types.py"])
});
tour.forEach(s => s.nodeIds.forEach(id => { if (!ids.has(id)) throw new Error("tour node missing " + id); }));
fs.writeFileSync(".ua/intermediate/tour.json", JSON.stringify(tour, null, 2));
console.log("layers", layers.length, "tour", tour.length);
