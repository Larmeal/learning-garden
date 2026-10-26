const fs = require("fs");
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const asm = JSON.parse(fs.readFileSync(".ua/intermediate/assembled-graph.json", "utf8"));
const ids = new Set(asm.nodes.map(n => n.id));
const P = "file:sql/core/src/main/scala/org/apache/spark/sql/execution/python/";
const C = "file:core/src/main/scala/org/apache/spark/api/python/";
const sqlSide = ["ExtractPythonUDFs.scala", "EvalPythonExec.scala", "EvalPythonEvaluatorFactory.scala", "BatchEvalPythonExec.scala", "ArrowEvalPythonExec.scala"].map(x => P + x);
const runners = ["ArrowPythonRunner.scala", "PythonArrowInput.scala", "PythonArrowOutput.scala", "PythonUDFRunner.scala"].map(x => P + x);
const core = ["PythonRunner.scala", "PythonWorkerFactory.scala", "PythonUtils.scala"].map(x => C + x);
const layers = JSON.parse(JSON.stringify(g.layers));
layers.push({
  id: "layer:python-udf-bridge",
  name: "Python UDF Bridge (JVM side)",
  description: "How Python UDFs and pandas UDFs in a query become physical operators and how the JVM exchanges rows with the Python worker process: UDF extraction, the EvalPython operators, the Python runners with Arrow input and output, and the worker factory.",
  nodeIds: sqlSide.concat(runners, core)
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
  title: "Python UDFs in a query plan",
  description: "ExtractPythonUDFs is an optimizer-stage rule that pulls Python UDF calls out of expressions into separate logical EvalPython operators (batched UDFs, Arrow-based pandas UDFs, UDTFs, and aggregate variants). The planner then maps them to physical operators: EvalPythonExec is the shared base, BatchEvalPythonExec sends pickled rows, ArrowEvalPythonExec sends Arrow batches. Their evaluator factories build the Python runner for each partition and join the UDF results back to the input rows.",
  nodeIds: sqlSide
});
tour.push({
  order: n0 + 2,
  title: "Talking to the Python worker",
  description: "BasePythonRunner (core) drives one task's exchange with a Python worker: it obtains a worker from PythonWorkerFactory (a daemon that forks workers, or a directly launched process, with an idle pool), writes a header (eval type, configuration, UDF payload) and the input data from a writer thread, and reads results back with length-prefixed framing. ArrowPythonRunner and PythonUDFRunner specialize it, with PythonArrowInput and PythonArrowOutput providing the Arrow stream writing and reading. PythonUtils holds shared configuration helpers.",
  nodeIds: runners.concat(core)
});
tour.forEach(s => s.nodeIds.forEach(id => { if (!ids.has(id)) throw new Error("tour node missing " + id); }));
fs.writeFileSync(".ua/intermediate/tour.json", JSON.stringify(tour, null, 2));
console.log("layers", layers.length, "tour", tour.length);
