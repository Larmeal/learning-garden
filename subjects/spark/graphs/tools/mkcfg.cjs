// usage: node mkcfg.cjs N  -> writes $S/cN-cfg.json (layers by first matching rule in sql-lib.cjs; new layers are created when missing)
const fs = require("fs");
const L = require(process.env.S + "/sql-lib.cjs");
const N = process.argv[2];
const S = process.env.S;
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const existing = new Map(g.layers.map(l => [l.name, l]));
const files = fs.readFileSync(S + "/c" + N + "-files.txt", "utf8").split("\n").filter(Boolean).map(x => x.slice(1));
const byLayer = new Map();
const unmatched = [];
for (const f of files) {
  const r = L.layers.find(x => x[0].test(f));
  if (!r) { unmatched.push(f); continue; }
  if (!byLayer.has(r[1])) byLayer.set(r[1], { rule: r, files: [] });
  byLayer.get(r[1]).files.push(f);
}
if (unmatched.length) { console.log("UNMATCHED", unmatched); process.exit(1); }
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const assign = [], newLayers = [];
for (const [name, v] of byLayer) {
  const match = "^file:(" + v.files.map(esc).join("|") + ")$";
  if (existing.has(name)) assign.push({ layer: name, match });
  else if (v.rule[2]) newLayers.push({ id: v.rule[2], name, description: v.rule[3], match });
  else throw new Error("layer missing and no definition: " + name);
}
const cfg = { files: S + "/c" + N + "-files.txt", assign, newLayers, tour: [] };
fs.writeFileSync(S + "/c" + N + "-cfg.json", JSON.stringify(cfg, null, 1));
console.log("cfg written:", [...byLayer].map(([k, v]) => k + " " + v.files.length).join(" | "), newLayers.length ? "| NEW: " + newLayers.map(x => x.name).join(", ") : "");
