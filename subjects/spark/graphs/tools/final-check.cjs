const fs = require("fs");
const A = ".ua/";
const rd = f => JSON.parse(fs.readFileSync(A + f, "utf8"));
let fails = 0;
const ok = (name, cond, extra) => { console.log((cond ? "PASS " : "FAIL ") + name + (extra ? " | " + extra : "")); if (!cond) fails++; };

const g = rd("knowledge-graph.json");
const scan = new Set(rd("intermediate/scan-result.json").files.map(f => f.path));
const fp = new Set(Object.keys(rd("fingerprints.json").files));
const meta = rd("meta.json");
const gfiles = new Set(g.nodes.filter(n => n.type === "file").map(n => n.id.replace(/^file:/, "")));
const same = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
ok("file sets identical: scan == fingerprints == graph", same(scan, fp) && same(fp, gfiles), `scan ${scan.size}, fp ${fp.size}, graph ${gfiles.size}, meta.analyzedFiles ${meta.analyzedFiles}`);
ok("meta.analyzedFiles matches", meta.analyzedFiles === gfiles.size);

const ids = new Set(g.nodes.map(n => n.id));
ok("no duplicate node ids", ids.size === g.nodes.length, `${g.nodes.length} nodes`);
const dangling = g.edges.filter(e => !ids.has(e.source) || !ids.has(e.target));
ok("no dangling edges", dangling.length === 0, `${g.edges.length} edges`);
const seenE = new Set(); let dupE = 0;
g.edges.forEach(e => { const k = e.type + "|" + e.source + "|" + e.target; if (seenE.has(k)) dupE++; seenE.add(k); });
ok("no duplicate edges", dupE === 0, "dups " + dupE);
const selfE = g.edges.filter(e => e.source === e.target).length;
ok("no self edges", selfE === 0);

const par = new Map(); const find = x => { while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
g.nodes.forEach(n => par.set(n.id, n.id));
g.edges.forEach(e => par.set(find(e.source), find(e.target)));
const comps = new Set(g.nodes.map(n => find(n.id)));
const known = new Set(fs.readFileSync(process.env.S + "/known-islands.txt", "utf8").split("\n").filter(l => l && !l.startsWith("#")).map(l => "file:" + l.split(/\s+#/)[0].trim()));
const compNodes = new Map(); g.nodes.forEach(n => { const r = find(n.id); if (!compNodes.has(r)) compNodes.set(r, []); compNodes.get(r).push(n); });
let big = 0, strays = [];
for (const ns of compNodes.values()) { const fl = ns.filter(n => n.type === "file").map(n => n.id); if (ns.length > 200) big++; else if (fl.every(f => known.has(f))) console.log("note: known island", fl.map(f => f.split("/").pop()).join(",")); else strays.push(fl.join(",") || ns[0].id); }
ok("one connected component (known islands aside)", big === 1 && strays.length === 0, "components " + comps.size + (strays.length ? " unexpected: " + strays.join(" | ") : ""));

const inLayer = new Map();
let layerDup = 0, layerBad = 0;
g.layers.forEach(l => l.nodeIds.forEach(i => { if (inLayer.has(i)) layerDup++; inLayer.set(i, l.name); if (!ids.has(i)) layerBad++; }));
const unassigned = [...gfiles].filter(f => !inLayer.has("file:" + f));
ok("every file in exactly one layer, layer ids valid", unassigned.length === 0 && layerDup === 0 && layerBad === 0, `layers ${g.layers.length}, unassigned ${unassigned.length}, dup ${layerDup}, bad ${layerBad}`);
const tourBad = g.tour.reduce((a, s) => a + s.nodeIds.filter(i => !ids.has(i)).length, 0);
const orders = g.tour.map(s => s.order);
ok("tour ids valid and orders 1..N", tourBad === 0 && orders.every((o, i) => o === i + 1), `steps ${g.tour.length}, bad ${tourBad}`);

const raw = fs.readFileSync(A + "knowledge-graph.json", "utf8");
ok("graph file is pure ASCII", !/[^\x00-\x7F]/.test(raw));
const noRange = g.nodes.filter(n => (n.type === "function" || n.type === "class") && !n.lineRange).length;
ok("all symbol nodes have lineRange", noRange === 0);
const badRange = g.nodes.filter(n => n.lineRange && (n.lineRange[0] < 1 || n.lineRange[1] < n.lineRange[0])).length;
ok("lineRange start <= end", badRange === 0);
const wrongLang = g.edges.filter(e => (e.type === "inherits" || e.type === "implements") && /[.]py(:|$)/.test(e.source) !== /[.]py(:|$)/.test(e.target)).length;
ok("no cross-language inherits/implements", wrongLang === 0, "found " + wrongLang);

const sizeStats = { files: gfiles.size, nodes: g.nodes.length, edges: g.edges.length, layers: g.layers.length, tour: g.tour.length };
console.log("SUMMARY", JSON.stringify(sizeStats));
console.log(fails === 0 ? "ALL CHECKS PASSED" : "FAILURES: " + fails);
process.exit(fails ? 1 : 0);
