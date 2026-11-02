const fs = require("fs");
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const asm = JSON.parse(fs.readFileSync(".ua/intermediate/assembled-graph.json", "utf8"));
const ids = new Set(asm.nodes.map(n => n.id));
const C = "file:core/src/main/scala/org/apache/spark/";
const Q = "file:sql/core/src/main/scala/org/apache/spark/sql/execution/ui/";
const status = ["status/AppStatusListener", "status/LiveEntity", "status/ElementTrackingStore", "status/AppStatusStore", "status/KVUtils", "status/storeTypes", "status/api/v1/api", "status/api/v1/ApiRootResource", "status/api/v1/OneApplicationResource"].map(x => C + x + ".scala");
const ui = ["ui/WebUI", "ui/SparkUI", "ui/JettyUtils", "ui/UIUtils", "ui/jobs/JobsTab", "ui/jobs/StagesTab", "ui/exec/ExecutorsTab", "ui/jobs/AllJobsPage", "ui/jobs/JobPage", "ui/jobs/StagePage", "ui/jobs/StageTable"].map(x => C + x + ".scala");
const metrics = ["metrics/MetricsSystem", "metrics/MetricsConfig", "metrics/source/Source", "metrics/sink/Sink", "metrics/ExecutorMetricType"].map(x => C + x + ".scala");
const sql = ["SQLAppStatusListener", "SQLAppStatusStore", "SQLListener", "SparkPlanGraph", "ExecutionPage"].map(x => Q + x + ".scala");
const all = status.concat(ui, metrics, sql);
const layers = JSON.parse(JSON.stringify(g.layers));
layers.forEach(l => { l.nodeIds = l.nodeIds.filter(i => !all.includes(i)); });
layers.push({
  id: "layer:ui-status-metrics",
  name: "Spark UI, Status Store and Metrics",
  description: "How Spark reports on itself: AppStatusListener turns listener bus events into live entities stored in an ElementTrackingStore (a KVStore), AppStatusStore and the REST resources read from it, the Jetty based web UI (SparkUI, tabs and pages for jobs, stages, executors and SQL), the SQL status listener and plan graph, and the MetricsSystem with its sources and sinks.",
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
  title: "Where the UI gets its data: listener, store and REST",
  description: "The UI does not read scheduler objects directly. AppStatusListener is a listener on the bus: for every job, stage, task and executor event it updates a Live* entity (LiveEntity) and writes it into the ElementTrackingStore, a KVStore that also triggers cleanup of old jobs, stages and tasks. AppStatusStore wraps the store with query methods, and both the web pages and the REST resources (ApiRootResource, OneApplicationResource, with the data classes in api.scala) read from it. The SQL tab has its own listener, SQLAppStatusListener, which builds execution data and aggregates SQL metric values.",
  nodeIds: status.concat([sql[0], sql[1], sql[2]])
});
tour.push({
  order: n0 + 2,
  title: "The web UI and the metrics system",
  description: "SparkUI extends WebUI and attaches tabs (Jobs, Stages, Executors and the SQL tab) whose pages are served by Jetty handlers created in JettyUtils; UIUtils renders the common page layout and tables. AllJobsPage, JobPage and StagePage show timelines and task tables from the status store, and the SQL ExecutionPage draws the plan graph built by SparkPlanGraph. Separately, MetricsSystem reads its configuration (MetricsConfig), registers Sources and starts Sinks, and ExecutorMetricType defines the executor metrics that are collected.",
  nodeIds: ui.concat([sql[3], sql[4]], metrics)
});
tour.forEach(s => s.nodeIds.forEach(id => { if (!ids.has(id)) throw new Error("tour node missing " + id); }));
fs.writeFileSync(".ua/intermediate/tour.json", JSON.stringify(tour, null, 2));
console.log("layers", layers.length, "tour", tour.length);
