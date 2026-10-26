const fs = require("fs");
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const base = "core/src/main/scala/org/apache/spark/";
const files = ["scheduler/DAGScheduler", "scheduler/DAGSchedulerEvent", "scheduler/ActiveJob", "scheduler/Stage", "scheduler/ShuffleMapStage", "scheduler/ResultStage", "scheduler/Task", "scheduler/ShuffleMapTask", "scheduler/ResultTask", "scheduler/TaskSchedulerImpl", "scheduler/TaskScheduler", "scheduler/TaskSetManager", "scheduler/TaskSet", "scheduler/Schedulable", "scheduler/Pool", "scheduler/SchedulableBuilder", "scheduler/SchedulerBackend", "scheduler/cluster/CoarseGrainedSchedulerBackend",
  "SparkContext", "rdd/RDD", "Dependency", "MapOutputTracker", "TaskContext", "scheduler/StageInfo", "shuffle/ShuffleWriteProcessor", "util/EventLoop"].map(x => base + x + ".scala");
const classRe = /^\s*(?:@\w+(?:\([^)]*\))?\s+)*(?:(?:private|protected|final|sealed|abstract|implicit|case|override)(?:\[[\w.]+\])?\s+)*(class|trait|object)\s+(\w+)/;
let totalMissing = 0;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8").split("\n");
  const fileId = "file:" + f;
  const node = g.nodes.find(n => n.id === fileId);
  if (!node) { console.log("NOT IN GRAPH", f); continue; }
  const prefix = "class:" + f + ":";
  const classNames = new Set(g.nodes.filter(n => n.id.startsWith(prefix)).map(n => n.id.slice(prefix.length).split(".").pop()));
  const fnPrefix = "function:" + f + ":";
  const fnNodes = g.nodes.filter(n => n.id.startsWith(fnPrefix));
  const decl = [];
  src.forEach((l, i) => { const m = classRe.exec(l); if (m && !/^\s*(\/\/|\*)/.test(l)) decl.push([m[2], m[1], i + 1]); });
  const missing = decl.filter(([n]) => !classNames.has(n));
  // distinct names only (companion objects share the id of the class)
  const missNames = [...new Set(missing.map(m => m[0]))].filter(n => !decl.some(d => d[0] === n && classNames.has(n)));
  const defs = src.filter(l => /^\s*(?:(?:private|protected|override|final|implicit)(?:\[[\w.]+\])?\s+)*def\s+\w+/.test(l)).length;
  totalMissing += missNames.length;
  console.log(f.replace(base, "").padEnd(52), "lines", String(src.length).padStart(5), "| classes in src", String(new Set(decl.map(d => d[0])).size).padStart(3), "in graph", String(classNames.size).padStart(3), "| defs", String(defs).padStart(4), "fn nodes", String(fnNodes.length).padStart(3), missNames.length ? "| MISSING classes: " + missNames.join(",") : "");
}
console.log("total classes missing:", totalMissing);
// edge sanity for the scheduler cluster
const sched = new Set(g.nodes.filter(n => files.some(f => n.id.includes(f))).map(n => n.id));
const cross = g.edges.filter(e => sched.has(e.source) !== sched.has(e.target));
console.log("edges crossing the scheduler/core boundary:", cross.length);
const byType = {};
g.edges.filter(e => sched.has(e.source) && sched.has(e.target)).forEach(e => byType[e.type] = (byType[e.type] || 0) + 1);
console.log("internal edges by type:", JSON.stringify(byType));
const L = g.layers.find(l => l.name === "Job and Task Scheduler");
console.log("layer 'Job and Task Scheduler' files:", L.nodeIds.length, "| tour steps mentioning scheduler files:", g.tour.filter(s => s.nodeIds.some(i => sched.has(i))).map(s => s.order + ":" + s.title).join(" | "));
