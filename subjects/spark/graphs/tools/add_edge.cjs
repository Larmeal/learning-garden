// Usage: node add_edge.cjs <sourceIdSuffix> <targetIdSuffix> <type>
// Adds one source-verified edge. The suffixes must each match exactly one node id.
const fs = require("fs");
const [sfx, tfx, type] = process.argv.slice(2);
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const find = s => { const m = g.nodes.filter(n => n.id.endsWith(s)); if (m.length !== 1) throw new Error("suffix " + s + " matched " + m.length); return m[0].id; };
const source = find(sfx), target = find(tfx);
const ex = g.edges.find(e => e.type === type) || g.edges[0];
if (g.edges.some(e => e.source === source && e.target === target && e.type === type)) { console.log("edge already present"); process.exit(0); }
const w = { contains: 1.0, inherits: 0.9, implements: 0.9, calls: 0.8, imports: 0.7, depends_on: 0.6 }[type] || 0.5;
g.edges.push({ source, target, type, direction: "forward", weight: w });
fs.writeFileSync(".ua/knowledge-graph.json", JSON.stringify(g, null, 2));
console.log("added", type, source.split("/").pop(), "->", target.split("/").pop());
