const fs = require("fs");
const cp = require("child_process");
const all = cp.execSync("git ls-files", { encoding: "utf8", maxBuffer: 1 << 27 }).split(/\r?\n/).filter(Boolean);
const isCode = f => /\.(scala|java|py|proto|g4)$/.test(f);
const isTest = f => /(\/test\/|\/tests\/|^examples\/|^docs\/|^dev\/|^python\/docs|^python\/pyspark\/.*\/tests\/|\/testing\/|^python\/test_support|^python\/benchmarks|_test\.py$|\/test_[^/]*\.py$|^project\/|^python\/packaging|^python\/conf_viztracer|^sql\/gen-)/.test(f);
const main = all.filter(f => isCode(f) && !isTest(f));
const lc = {};
const lines = f => { if (lc[f] === undefined) { try { lc[f] = fs.readFileSync(f, "utf8").split("\n").length; } catch (e) { lc[f] = 0; } } return lc[f]; };
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const inGraph = new Set(g.nodes.filter(n => n.type === "file").map(n => n.id.replace(/^file:/, "")));
const mod = f => {
  const p = f.split("/");
  if (["sql", "resource-managers", "connector", "common"].includes(p[0])) return p[0] + "/" + p[1];
  if (p[0] === "python") return p[1] === "pyspark" ? "python/pyspark/" + (p[2] && !p[2].endsWith(".py") ? p[2] : "(top)") : "python/other";
  return p[0];
};
const rows = new Map();
for (const f of main) {
  const m = mod(f);
  if (!rows.has(m)) rows.set(m, { files: 0, lines: 0, gf: 0, gl: 0 });
  const r = rows.get(m);
  const l = lines(f);
  r.files++; r.lines += l;
  if (inGraph.has(f)) { r.gf++; r.gl += l; }
}
let TF = 0, TL = 0, GF = 0, GL = 0;
for (const r of rows.values()) { TF += r.files; TL += r.lines; GF += r.gf; GL += r.gl; }
console.log("ALL main code: files", TF, "lines", TL, "| in graph: files", GF, "(" + (100 * GF / TF).toFixed(2) + "%)", "lines", GL, "(" + (100 * GL / TL).toFixed(2) + "%)");
// scope relevant to a PySpark user (core engine + sql + pyspark python side), excluding the skip list from BACKLOG.md
const skip = /^(sql\/hive|sql\/hive-thriftserver|graphx|connector\/|resource-managers\/(mesos)|python\/pyspark\/(ml|mllib|cloudpickle|errors|resource|logger|(top))|python\/other|mllib|mllib-local|tools|repl|hadoop-cloud|assembly|launcher|common\/tags|common\/sketch|streaming|udf|sql\/pipelines)/;
let RF = 0, RL = 0, RGF = 0, RGL = 0;
for (const [m, r] of rows) if (!skip.test(m)) { RF += r.files; RL += r.lines; RGF += r.gf; RGL += r.gl; }
console.log("RELEVANT scope (skip list removed): files", RF, "lines", RL, "| in graph: files", RGF, "(" + (100 * RGF / RF).toFixed(2) + "%)", "lines", RGL, "(" + (100 * RGL / RL).toFixed(2) + "%)");
console.log("\nmodule".padEnd(34), "files".padStart(6), "lines".padStart(8), "graph files".padStart(12), "graph lines".padStart(12), "line %".padStart(7));
[...rows.entries()].sort((a, b) => b[1].lines - a[1].lines).slice(0, 22).forEach(([m, r]) => console.log(m.padEnd(33), String(r.files).padStart(6), String(r.lines).padStart(8), String(r.gf).padStart(12), String(r.gl).padStart(12), (r.lines ? (100 * r.gl / r.lines).toFixed(1) : "0").padStart(7)));
// symbol-level: nodes per kind in graph vs file lines in graph
console.log("\ngraph: file nodes", inGraph.size, "| class nodes", g.nodes.filter(n => n.type === "class").length, "| function nodes", g.nodes.filter(n => n.type === "function").length);
