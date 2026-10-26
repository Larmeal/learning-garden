const fs = require("fs");
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const asm = JSON.parse(fs.readFileSync(".ua/intermediate/assembled-graph.json", "utf8"));
const ids = new Set(asm.nodes.map(n => n.id));
const P = "file:python/pyspark/";
const proc = ["daemon.py", "worker.py", "worker_util.py"].map(x => P + x);
const ser = ["serializers.py", "sql/pandas/serializers.py"].map(x => P + x);
const api = [P + "sql/udf.py"];
const layers = JSON.parse(JSON.stringify(g.layers));
layers.push({
  id: "layer:python-worker-side",
  name: "Python Worker Side",
  description: "What runs inside the Python worker processes: the daemon that forks workers, the worker main loop that reads the JVM handshake and executes UDFs, the serializers (pickle and Arrow) that frame data on the socket, and the Python UDF API that creates JVM UDF objects.",
  nodeIds: proc.concat(ser, api)
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
  title: "Inside the Python worker process",
  description: "On the Python side, daemon.py is started by the JVM PythonWorkerFactory and forks one worker per task. Each worker runs worker.main, which reads the handshake the JVM Writer wrote (partition index, Python version, task context, files and broadcasts, eval type, runner and eval configuration, then the serialized UDFs), picks the code path for the eval type in read_udfs or read_udtf, loops over the input stream, and writes results, timing data and an end-of-data marker back. worker_util.py holds shared setup helpers.",
  nodeIds: proc
});
tour.push({
  order: n0 + 2,
  title: "Serializers and the UDF API",
  description: "serializers.py defines the Serializer family (framed, batched, pickle and cloudpickle serializers) and the length-prefixed framing helpers. sql/pandas/serializers.py builds on Arrow streams for pandas UDFs, grouped map, cogroup, aggregate, UDTF and stateful serializers. sql/udf.py is the user-facing side: udf() and UserDefinedFunction create the JVM UserDefinedPythonFunction wrapping a pickled Python function, and UDFRegistration registers it for SQL.",
  nodeIds: ser.concat(api)
});
tour.forEach(s => s.nodeIds.forEach(id => { if (!ids.has(id)) throw new Error("tour node missing " + id); }));
fs.writeFileSync(".ua/intermediate/tour.json", JSON.stringify(tour, null, 2));
console.log("layers", layers.length, "tour", tour.length);
