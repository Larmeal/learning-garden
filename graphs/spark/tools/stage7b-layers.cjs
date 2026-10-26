const fs = require("fs");
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const asm = JSON.parse(fs.readFileSync(".ua/intermediate/assembled-graph.json", "utf8"));
const ids = new Set(asm.nodes.map(n => n.id));
const E = "file:sql/core/src/main/scala/org/apache/spark/sql/execution/";
const agg = ["aggregate/HashAggregateExec.scala", "aggregate/ObjectHashAggregateExec.scala", "aggregate/SortAggregateExec.scala", "aggregate/AggUtils.scala", "aggregate/AggregateCodegenSupport.scala", "aggregate/BaseAggregateExec.scala", "aggregate/TungstenAggregationIterator.scala", "window/WindowExec.scala", "window/WindowExecBase.scala", "window/WindowEvaluatorFactoryBase.scala", "window/WindowFunctionFrame.scala"].map(x => E + x);
const layers = JSON.parse(JSON.stringify(g.layers));
const ej = layers.find(l => l.name === "Exchange and Joins");
ej.nodeIds.push(E + "joins/JoinCodegenSupport.scala");
layers.push({
  id: "layer:aggregation-and-window",
  name: "Aggregation and Window",
  description: "Physical aggregation operators (hash, object hash, sort), their shared base and code generation support, and the window operator with its frame evaluation.",
  nodeIds: agg
});
const bad = [];
layers.forEach(l => l.nodeIds.forEach(id => { if (!ids.has(id)) bad.push(id); }));
const seen = new Set();
layers.forEach(l => l.nodeIds.forEach(id => { if (seen.has(id)) bad.push("dup " + id); seen.add(id); }));
asm.nodes.filter(n => n.type === "file").forEach(n => { if (!seen.has(n.id)) bad.push("unassigned " + n.id); });
console.log("problems:", bad.length, bad.slice(0, 5));
if (bad.length) process.exit(1);
fs.writeFileSync(".ua/intermediate/layers.json", JSON.stringify(layers, null, 2));
console.log("layers.json written:", layers.length, "layers");
// tour.json (required for an ARCHITECTURE_UPDATE): current tour plus two new steps
const tour = JSON.parse(JSON.stringify(g.tour));
const A = E + "aggregate/", W = E + "window/";
tour.push({
  order: 90,
  title: "Aggregation: AggUtils and the aggregate operators",
  description: "AggUtils turns a logical Aggregate into physical aggregation plans, choosing HashAggregateExec, ObjectHashAggregateExec or SortAggregateExec and building the partial and final stages (also distinct, streaming and session-window variants). HashAggregateExec is the Tungsten hash-based operator with whole-stage codegen that falls back to sort-based aggregation when memory is exceeded. ObjectHashAggregateExec handles TypedImperativeAggregate functions whose buffers hold JVM objects, without codegen. SortAggregateExec needs a child sorted on the grouping expressions and is the general fallback. BaseAggregateExec holds the shared logic and AggregateCodegenSupport the shared codegen.",
  nodeIds: [A + "AggUtils.scala", A + "HashAggregateExec.scala", A + "ObjectHashAggregateExec.scala", A + "SortAggregateExec.scala", A + "BaseAggregateExec.scala", A + "AggregateCodegenSupport.scala", A + "TungstenAggregationIterator.scala"]
});
tour.push({
  order: 91,
  title: "Window functions: WindowExec and frames",
  description: "WindowExec evaluates window functions over sorted partitions by delegating to a WindowEvaluatorFactory. The frame types are the entire partition, growing, shrinking, moving and offset frames, with row or range boundaries. WindowEvaluatorFactoryBase groups window expressions by frame and creates the matching WindowFunctionFrame factories, and WindowFunctionFrame and its implementations compute the result for each row of a partition. WindowExecBase holds the logic common to window operators.",
  nodeIds: [W + "WindowExec.scala", W + "WindowExecBase.scala", W + "WindowEvaluatorFactoryBase.scala", W + "WindowFunctionFrame.scala"]
});
const want = ["The pipeline driver", "Everything is a tree", "Applying rules", "Logical operators", "From SQL text", "Resolving the plan", "Rewriting the plan", "From logical to physical", "Physical operators", "Moving data", "Joins: choosing", "Aggregation:", "Window functions", "Fusing operators", "Adapting while running", "Runtime rewrites"];
const ordered = want.map((w, i) => { const s = tour.find(t => t.title.startsWith(w)); if (!s) throw new Error("missing " + w); s.order = i + 1; return s; });
const ids2 = new Set(asm.nodes.map(n => n.id));
ordered.forEach(s => s.nodeIds.forEach(id => { if (!ids2.has(id)) throw new Error("tour node missing " + id); }));
fs.writeFileSync(".ua/intermediate/tour.json", JSON.stringify(ordered, null, 2));
console.log("tour.json written:", ordered.length, "steps");
