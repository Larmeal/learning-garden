const fs = require("fs");
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const asm = JSON.parse(fs.readFileSync(".ua/intermediate/assembled-graph.json", "utf8"));
const ids = new Set(asm.nodes.map(n => n.id));
const C = "file:sql/catalyst/src/main/scala/org/apache/spark/sql/catalyst/";
const E = C + "expressions/";
const core = ["Expression", "namedExpressions", "literals", "SortOrder", "EquivalentExpressions"].map(x => E + x + ".scala");
const ops = ["predicates", "arithmetic", "conditionalExpressions", "Cast"].map(x => E + x + ".scala").concat([C + "analysis/TypeCoercion.scala", C + "analysis/AnsiTypeCoercion.scala"]);
const agg = ["aggregate/interfaces", "aggregate/Sum", "aggregate/Count", "windowExpressions", "PythonUDF", "ScalaUDF"].map(x => E + x + ".scala");
const gen = ["CodeGenerator", "CodegenFallback", "GenerateUnsafeProjection", "GeneratePredicate", "GenerateOrdering"].map(x => E + "codegen/" + x + ".scala");
const all = core.concat(ops, agg, gen);
const layers = JSON.parse(JSON.stringify(g.layers));
layers.forEach(l => { l.nodeIds = l.nodeIds.filter(i => !all.includes(i)); });
layers.push({
  id: "layer:catalyst-expressions",
  name: "Catalyst Expressions and Codegen",
  description: "The expression system under every plan: the Expression tree, named attributes and literals, predicates, arithmetic and casts with ANSI semantics, type coercion, aggregate and window function interfaces, UDF expressions, and the code generator that compiles expressions to Java.",
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
  title: "Expressions: the tree inside every plan",
  description: "Every column, filter condition and function in a query is an Expression tree. Expression defines eval (interpreted), genCode (generated Java), nullability, foldability and determinism; helper traits (UnaryExpression, BinaryExpression, ...) fix the number of children. Attributes and aliases (namedExpressions) name the columns of a plan, Literal holds constants, SortOrder describes ordering, and EquivalentExpressions finds common subexpressions to compute once. The optimizer rules from the earlier steps (ConstantFolding, NullPropagation) work by inspecting these properties.",
  nodeIds: core
});
tour.push({
  order: n0 + 2,
  title: "Predicates, arithmetic, casts and type coercion",
  description: "Predicates implement SQL three-valued logic (NULL handling in And, Or, Not, In). Arithmetic and Cast carry an eval mode: in ANSI mode (the default in Spark 4) overflow, invalid casts and divide by zero raise errors, in legacy mode they return NULL or wrap, and try_cast always returns NULL on failure. TypeCoercion and AnsiTypeCoercion are analyzer rules that insert implicit casts so the operands of an expression have compatible types.",
  nodeIds: ops
});
tour.push({
  order: n0 + 3,
  title: "Aggregate, window and UDF expressions",
  description: "Aggregate functions implement a buffer protocol: DeclarativeAggregate expresses initial values, update, merge and evaluate as expressions (Sum, Count) while ImperativeAggregate and TypedImperativeAggregate do it with code and arbitrary buffers. Window expressions pair a window function with a frame specification. PythonUDF and ScalaUDF are expressions that cannot be evaluated by the engine itself: PythonUDF is extracted into EvalPython operators, ScalaUDF is evaluated on the JVM with converters between Catalyst and Scala types.",
  nodeIds: agg
});
tour.push({
  order: n0 + 4,
  title: "Code generation for expressions",
  description: "CodeGenerator turns expression trees into Java source using a CodegenContext (mutable state, helper functions, subexpression elimination, method splitting to stay under JVM limits) and compiles it with Janino, caching the compiled class. GenerateUnsafeProjection, GeneratePredicate and GenerateOrdering produce the projections, filters and comparators used by operators, and whole-stage codegen builds on the same context. Expressions that cannot generate code use CodegenFallback, which calls the interpreted eval.",
  nodeIds: gen
});
tour.forEach(s => s.nodeIds.forEach(id => { if (!ids.has(id)) throw new Error("tour node missing " + id); }));
fs.writeFileSync(".ua/intermediate/tour.json", JSON.stringify(tour, null, 2));
console.log("layers", layers.length, "tour", tour.length);
