const fs = require("fs");
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const asm = JSON.parse(fs.readFileSync(".ua/intermediate/assembled-graph.json", "utf8"));
const ids = new Set(asm.nodes.map(n => n.id));
const C = "file:core/src/main/scala/org/apache/spark/";
const exec = ["executor/Executor", "executor/ExecutorBackend", "executor/CoarseGrainedExecutorBackend", "executor/TaskMetrics", "TaskContextImpl", "SparkEnv"].map(x => C + x + ".scala");
const sched = ["scheduler/cluster/StandaloneSchedulerBackend", "scheduler/local/LocalSchedulerBackend", "ExecutorAllocationManager"].map(x => C + x + ".scala");
const deploy = ["deploy/SparkSubmit", "deploy/SparkSubmitArguments", "deploy/client/StandaloneAppClient", "deploy/master/Master", "deploy/worker/Worker", "deploy/worker/ExecutorRunner"].map(x => C + x + ".scala");
const all = exec.concat(sched, deploy);
const layers = JSON.parse(JSON.stringify(g.layers));
layers.forEach(l => { l.nodeIds = l.nodeIds.filter(i => !all.includes(i)); });
layers.push({
  id: "layer:executor-and-deploy",
  name: "Executor, Environment and Deploy",
  description: "The processes around a job: spark-submit and its argument handling, the standalone Master and Worker, the scheduler backends for local and standalone mode, the executor process (backend, Executor, TaskRunner, task context and metrics), SparkEnv that wires the services, and dynamic allocation.",
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
  title: "spark-submit and the standalone cluster",
  description: "SparkSubmit parses the arguments (SparkSubmitArguments, merging spark-defaults.conf), works out from --master and --deploy-mode which cluster manager and main class to use, and runs the application's main in the right place (for PySpark through a Python runner). In standalone mode StandaloneSchedulerBackend registers the application with the Master through StandaloneAppClient; the Master decides which Workers start executors (spreading out or packing), and each Worker launches an executor process with ExecutorRunner. Local mode instead runs LocalSchedulerBackend with an executor inside the driver JVM.",
  nodeIds: deploy.concat(sched.slice(0, 2))
});
tour.push({
  order: n0 + 2,
  title: "The executor process and SparkEnv",
  description: "CoarseGrainedExecutorBackend is the main of an executor process: it creates a SparkEnv (serializer, shuffle manager, memory manager, block manager, map output tracker, RPC), registers with the driver and receives LaunchTask messages. Executor runs each task on a pool thread in a TaskRunner: deserialize the task, set up a TaskContextImpl and task memory manager, run it, and send the result back directly or through the block manager when it is large, while heartbeats report metrics. ExecutorAllocationManager on the driver adds or removes executors with dynamic allocation.",
  nodeIds: exec.concat([sched[2]])
});
tour.forEach(s => s.nodeIds.forEach(id => { if (!ids.has(id)) throw new Error("tour node missing " + id); }));
fs.writeFileSync(".ua/intermediate/tour.json", JSON.stringify(tour, null, 2));
console.log("layers", layers.length, "tour", tour.length);
