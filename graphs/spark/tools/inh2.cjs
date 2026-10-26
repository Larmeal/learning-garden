const fs = require("fs");
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const fileOf = id => id.replace(/^[a-z]+:/, "").split(":")[0];
const classes = g.nodes.filter(n => n.type === "class");
const byName = new Map();
classes.forEach(n => { const nm = n.id.split(":").pop(); if (!byName.has(nm)) byName.set(nm, []); byName.get(nm).push(n); });
const have = new Set(g.edges.filter(e => e.type === "inherits").map(e => e.source + ">" + e.target));
const cache = {};
const lines = f => cache[f] || (cache[f] = fs.readFileSync(f, "utf8").split(/\r?\n/));
const found = [];
for (const n of classes) {
  if (!n.lineRange) continue;
  const L = lines(fileOf(n.id));
  const nm = n.id.split(":").pop().replace("$", "");
  // header: skip anything inside (...) or [...], stop at "{" or "=" at depth 0
  let depth = 0, hdr = "", done = false;
  for (let k = 0; k < 80 && n.lineRange[0] - 1 + k < L.length && !done; k++) {
    const line = L[n.lineRange[0] - 1 + k];
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === "(" || ch === "[") depth++;
      else if (ch === ")" || ch === "]") depth--;
      if (depth === 0 && (ch === "{" || (ch === "=" && line[c + 1] !== ">" && line[c - 1] !== "="))) { done = true; break; }
      if (depth === 0) hdr += ch;
    }
    hdr += " ";
  }
  if (!(" " + hdr).includes(" " + nm + " ")) continue;
  const e = hdr.indexOf(" extends ");
  if (e < 0) continue;
  const parents = hdr.slice(e + 9).split(" with ").map(s => s.trim()).map(s => s.split(/\s/)[0]).map(s => s.split(".").pop()).filter(Boolean);
  for (const p of parents) {
    for (const x of (byName.get(p) || [])) {
      if (x.id === n.id) continue;
      const key = n.id + ">" + x.id;
      if (!have.has(key)) found.push({ s: n.id, t: x.id, txt: nm.padEnd(32) + "(" + fileOf(n.id).split("/").pop() + ") -> " + p + " (" + fileOf(x.id).split("/").pop() + ")", cross: fileOf(n.id) !== fileOf(x.id) });
    }
  }
}
console.log("missing inherits edges found in source:", found.length, "| cross-file:", found.filter(f => f.cross).length);
found.forEach(f => console.log(" ", f.cross ? "X" : "-", f.txt));
fs.writeFileSync(process.argv[2], JSON.stringify(found));
