const fs = require("fs");
const p = ".ua/knowledge-graph.json";
const g = JSON.parse(fs.readFileSync(p, "utf8"));
const inl = new Map();
g.layers.forEach(l => l.nodeIds.forEach(i => inl.set(i, l.name)));
const A = "file:core/src/main/scala/org/apache/spark/";
const want = ["SparkContext.scala", "Dependency.scala", "MapOutputTracker.scala", "TaskContext.scala", "rdd/RDD.scala", "scheduler/StageInfo.scala", "shuffle/ShuffleWriteProcessor.scala", "util/EventLoop.scala"].map(x => A + x);
console.log(want.map(w => w.split("/").pop() + " -> " + (inl.get(w) || "UNASSIGNED")).join("\n"));
const L = g.layers.find(l => l.name === "Job and Task Scheduler");
for (const w of want) {
  const cur = inl.get(w);
  if (cur && cur !== L.name) {
    const o = g.layers.find(l => l.name === cur);
    o.nodeIds = o.nodeIds.filter(i => i !== w);
  }
  if (!L.nodeIds.includes(w)) L.nodeIds.push(w);
}
L.description = "Spark core job execution: SparkContext as the entry point, RDDs and dependencies, DAGScheduler splitting jobs into stages at shuffle boundaries, TaskSchedulerImpl and TaskSetManager scheduling tasks with locality, pools and speculation, MapOutputTracker, and the scheduler backend sending tasks to executors.";
const un = g.nodes.filter(n => n.type === "file" && !g.layers.some(l => l.nodeIds.includes(n.id)));
console.log("unassigned after:", un.length);
const i = g.tour.findIndex(s => s.title.startsWith("From a job to stages"));
g.tour.splice(i, 0, {
  order: 0,
  title: "SparkContext, RDDs and dependencies",
  description: "SparkContext is the entry point of core Spark: when it starts it creates the environment, the DAGScheduler, the TaskScheduler and the scheduler backend chosen from the master URL (createTaskScheduler). Under every DataFrame there are RDDs: an RDD defines partitions, a compute function and dependencies. A narrow dependency keeps a partition within one task chain, a ShuffleDependency marks a stage boundary. Actions such as collect and count on RDDs, SparkPlan.executeTake, ShuffleExchangeExec.submitMapStage and PythonRDD.runJob all end in SparkContext.runJob or submitMapStage, which call the DAGScheduler.",
  nodeIds: ["SparkContext.scala", "rdd/RDD.scala", "Dependency.scala", "TaskContext.scala"].map(x => A + x)
});
const st = g.tour.find(s => s.title.startsWith("From a job to stages"));
["MapOutputTracker.scala", "scheduler/StageInfo.scala", "shuffle/ShuffleWriteProcessor.scala", "util/EventLoop.scala"].map(x => A + x).forEach(x => st.nodeIds.push(x));
st.description += " MapOutputTracker (on the driver) records where each map task wrote its shuffle output so reduce tasks and stage resubmission can find it, ShuffleWriteProcessor writes the output of a map task, and StageInfo is the summary used by listeners and the UI.";
g.tour.forEach((s, k) => { s.order = k + 1; });
const ids = new Set(g.nodes.map(n => n.id));
g.tour.forEach(s => s.nodeIds.forEach(id => { if (!ids.has(id)) throw new Error("tour node missing " + id); }));
fs.writeFileSync(p, JSON.stringify(g, null, 2));
console.log("tour", g.tour.length);
