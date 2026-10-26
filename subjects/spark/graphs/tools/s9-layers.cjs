const fs = require("fs");
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const asm = JSON.parse(fs.readFileSync(".ua/intermediate/assembled-graph.json", "utf8"));
const ids = new Set(asm.nodes.map(n => n.id));
const S = "file:core/src/main/scala/org/apache/spark/scheduler/";
const dag = ["DAGScheduler.scala", "DAGSchedulerEvent.scala", "ActiveJob.scala"].map(x => S + x);
const model = ["Stage.scala", "ShuffleMapStage.scala", "ResultStage.scala", "Task.scala", "ShuffleMapTask.scala", "ResultTask.scala"].map(x => S + x);
const taskSched = ["TaskSchedulerImpl.scala", "TaskScheduler.scala", "TaskSetManager.scala", "TaskSet.scala", "Schedulable.scala", "Pool.scala", "SchedulableBuilder.scala"].map(x => S + x);
const backend = [S + "SchedulerBackend.scala", S + "cluster/CoarseGrainedSchedulerBackend.scala"];
const layers = JSON.parse(JSON.stringify(g.layers));
layers.push({
  id: "layer:core-scheduler",
  name: "Job and Task Scheduler",
  description: "The Spark core scheduler: DAGScheduler splits a job into stages at shuffle boundaries and submits task sets, TaskSchedulerImpl and TaskSetManager schedule tasks with locality, pools and speculation, and the scheduler backend sends tasks to executors.",
  nodeIds: dag.concat(model, taskSched, backend)
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
  title: "From a job to stages and tasks",
  description: "An action submits a job to DAGScheduler through its event loop (JobSubmitted). DAGScheduler builds a ResultStage for the final RDD and walks its shuffle dependencies to create ShuffleMapStages, submits parent stages first (submitStage, getMissingParentStages), and for each stage creates one task per partition: ShuffleMapTask writes shuffle output, ResultTask computes the final partition result. On task completion or failure (CompletionEvent, fetch failures, executor loss) it updates stage state, resubmits stages and finishes the job.",
  nodeIds: dag.concat(model)
});
tour.push({
  order: n0 + 2,
  title: "Scheduling tasks onto executors",
  description: "DAGScheduler hands each stage's tasks to TaskSchedulerImpl as a TaskSet. TaskSchedulerImpl wraps it in a TaskSetManager and puts it in a scheduling Pool (FIFO or FAIR, built by SchedulableBuilder). When executors offer free resources, resourceOffers asks the pools for tasks in order; TaskSetManager picks tasks by data locality level (process, node, rack, any) with delay scheduling, tracks failures and launches speculative copies of slow tasks.",
  nodeIds: taskSched
});
tour.push({
  order: n0 + 3,
  title: "Launching tasks on executors",
  description: "SchedulerBackend is the cluster-manager facing interface. CoarseGrainedSchedulerBackend runs a DriverEndpoint RPC endpoint on the driver: executors register with it, it makes resource offers to TaskSchedulerImpl (makeOffers), serializes the chosen tasks and sends LaunchTask messages, and receives status updates that flow back to TaskSchedulerImpl and DAGScheduler.",
  nodeIds: backend.concat([S + "TaskSchedulerImpl.scala"])
});
tour.forEach(s => s.nodeIds.forEach(id => { if (!ids.has(id)) throw new Error("tour node missing " + id); }));
fs.writeFileSync(".ua/intermediate/tour.json", JSON.stringify(tour, null, 2));
console.log("layers", layers.length, "tour", tour.length);
