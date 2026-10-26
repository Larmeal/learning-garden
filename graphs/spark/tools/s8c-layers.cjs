const fs = require("fs");
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const asm = JSON.parse(fs.readFileSync(".ua/intermediate/assembled-graph.json", "utf8"));
const ids = new Set(asm.nodes.map(n => n.id));
const P = "file:python/pyspark/sql/connect/";
const B = "file:sql/connect/server/src/main/scala/org/apache/spark/sql/connect/";
const client = [P + "session.py", P + "dataframe.py", P + "plan.py", P + "client/core.py", P + "client/reattach.py"];
const service = ["service/SparkConnectService.scala", "service/SparkConnectServer.scala", "service/SparkConnectExecutePlanHandler.scala", "service/SparkConnectSessionManager.scala", "service/SessionHolder.scala", "service/ExecuteHolder.scala"].map(x => B + x);
const exec = ["execution/ExecuteThreadRunner.scala", "execution/ExecuteGrpcResponseSender.scala", "execution/ExecuteResponseObserver.scala", "execution/SparkConnectPlanExecution.scala"].map(x => B + x);
const planner = [B + "planner/SparkConnectPlanner.scala"];
const layers = JSON.parse(JSON.stringify(g.layers));
layers.push({
  id: "layer:connect-python-client",
  name: "Spark Connect Python Client",
  description: "The thin PySpark client of Spark Connect: SparkSession.builder.remote, the lazy DataFrame that only builds protobuf plans, the plan classes, and the gRPC client with reattachable response streams.",
  nodeIds: client
});
layers.push({
  id: "layer:connect-server",
  name: "Spark Connect Server",
  description: "The Spark Connect server inside the Spark driver: the gRPC service and session management, the per-operation holders and execution threads that stream Arrow results back, and the planner that converts protobuf relations, expressions and commands to Catalyst plans.",
  nodeIds: service.concat(exec, planner)
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
  title: "Spark Connect: the client builds a plan",
  description: "With Spark Connect, SparkSession.builder.remote(...) creates a client session that holds a SparkConnectClient (a gRPC channel). DataFrame methods do not run anything: each transformation wraps the current plan in a new plan node from plan.py (Project, Filter, Join, Aggregate, ...). Only an action such as collect, show or toPandas converts the plan tree to a protobuf Relation and sends it through the client. Reattachable iterators let a long running operation resume after a network failure.",
  nodeIds: client
});
tour.push({
  order: n0 + 2,
  title: "Spark Connect: the server runs the operation",
  description: "SparkConnectService receives ExecutePlan, looks up or creates the session through SparkConnectSessionManager and SessionHolder, and creates an ExecuteHolder for the operation. ExecuteThreadRunner runs it on its own thread; SparkConnectPlanExecution turns the planned Dataset into Arrow batches; ExecuteResponseObserver buffers responses so a client can reattach, and ExecuteGrpcResponseSender streams them back.",
  nodeIds: service.concat(exec)
});
tour.push({
  order: n0 + 3,
  title: "Spark Connect: from protobuf to a Catalyst plan",
  description: "SparkConnectPlanner transforms the protobuf Relation tree into Catalyst logical plans (transformRelation dispatches on the relation type), protobuf Expressions into Catalyst expressions, and Commands (write, create view, register UDF, streaming) into actions. The resulting LogicalPlan then goes through the normal QueryExecution pipeline described in the earlier tour steps.",
  nodeIds: planner
});
tour.forEach(s => s.nodeIds.forEach(id => { if (!ids.has(id)) throw new Error("tour node missing " + id); }));
fs.writeFileSync(".ua/intermediate/tour.json", JSON.stringify(tour, null, 2));
console.log("layers", layers.length, "tour", tour.length);
