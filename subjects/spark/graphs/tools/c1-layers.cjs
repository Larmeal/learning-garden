const fs = require("fs");
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const asm = JSON.parse(fs.readFileSync(".ua/intermediate/assembled-graph.json", "utf8"));
const ids = new Set(asm.nodes.map(n => n.id));
const files = fs.readFileSync(process.env.S + "/c1-files.txt", "utf8").split("\n").filter(Boolean).map(x => "file:" + x.slice(1));
const P = "file:core/src/main/scala/org/apache/spark/scheduler/";
const bus = ["LiveListenerBus", "AsyncEventQueue", "SparkListener", "ReplayListenerBus", "EventLoggingListener", "JobListener", "JobWaiter", "JobResult"].map(x => P + x + ".scala");
const rest = files.filter(f => !bus.includes(f));
const layers = JSON.parse(JSON.stringify(g.layers));
layers.forEach(l => { l.nodeIds = l.nodeIds.filter(i => !files.includes(i)); });
const L = layers.find(l => l.name === "Job and Task Scheduler");
rest.forEach(i => L.nodeIds.push(i));
L.description += " Also included: executor health tracking and exclusion (HealthTracker), executor resource accounting, the output commit coordinator, merge status for push based shuffle, cluster messages between driver and executors, and the dynamic allocation ExecutorMonitor.";
layers.push({
  id: "layer:listener-bus",
  name: "Listener Bus and Events",
  description: "How scheduler events are published: SparkListener and its event classes, the LiveListenerBus with its AsyncEventQueues, the event log writer and replay bus, and the job result and waiter types used by the DAGScheduler.",
  nodeIds: bus
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
tour.push({
  order: tour.length + 1,
  title: "Scheduler events: the listener bus",
  description: "Everything the scheduler does is announced as an event. The DAGScheduler and others post SparkListenerEvents to the LiveListenerBus, which queues them in AsyncEventQueues and delivers them on separate threads to listeners: the UI status listener, the event log writer, and others. EventLoggingListener writes the events to a log and ReplayListenerBus replays them later. Executors are tracked in the same way: HealthTracker excludes bad executors, ExecutorMonitor feeds dynamic allocation, and OutputCommitCoordinator decides which task attempt may commit its output.",
  nodeIds: [P + "SparkListener.scala", P + "LiveListenerBus.scala", P + "AsyncEventQueue.scala", P + "EventLoggingListener.scala", P + "ReplayListenerBus.scala", P + "HealthTracker.scala", P + "dynalloc/ExecutorMonitor.scala", P + "OutputCommitCoordinator.scala"]
});
tour.forEach(s => s.nodeIds.forEach(id => { if (!ids.has(id)) throw new Error("tour node missing " + id); }));
fs.writeFileSync(".ua/intermediate/tour.json", JSON.stringify(tour, null, 2));
console.log("layers", layers.length, "tour", tour.length);
