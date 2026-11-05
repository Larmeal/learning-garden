// usage: node fixlayers.cjs N1 N2 ...  -> re-applies the layer assignment of cN-cfg.json waves directly to .ua/knowledge-graph.json
// (needed when a small wave ran as PARTIAL_UPDATE and the layers file was ignored)
const fs = require("fs");
const S = process.env.S;
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
for (const N of process.argv.slice(2)) {
  const cfg = JSON.parse(fs.readFileSync(S + "/c" + N + "-cfg.json", "utf8"));
  const files = fs.readFileSync(cfg.files, "utf8").split("\n").filter(Boolean).map(x => "file:" + x.slice(1));
  g.layers.forEach(l => { l.nodeIds = l.nodeIds.filter(i => !files.includes(i)); });
  const placed = new Set();
  for (const a of cfg.assign || []) {
    const re = new RegExp(a.match);
    const L = g.layers.find(l => l.name === a.layer);
    if (!L) throw new Error("no layer " + a.layer);
    files.filter(f => !placed.has(f) && re.test(f)).forEach(f => { L.nodeIds.push(f); placed.add(f); });
  }
  for (const nl of cfg.newLayers || []) {
    const re = new RegExp(nl.match);
    const m = files.filter(f => !placed.has(f) && re.test(f));
    m.forEach(f => placed.add(f));
    const ex = g.layers.find(l => l.id === nl.id);
    if (ex) ex.nodeIds.push(...m);
    else g.layers.push({ id: nl.id, name: nl.name, description: nl.description, nodeIds: m });
  }
  const rest = files.filter(f => !placed.has(f));
  console.log("wave", N, "files", files.length, "placed", placed.size, "unplaced", rest.length);
}
fs.writeFileSync(".ua/knowledge-graph.json", JSON.stringify(g, null, 2));
console.log("layers", g.layers.length);
