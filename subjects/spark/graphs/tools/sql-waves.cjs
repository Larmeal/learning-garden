// builds the sql waves and appends them to core-waves.json (waves 22 onwards)
const fs = require("fs"), cp = require("child_process");
const L = require(process.env.S + "/sql-lib.cjs");
const g = JSON.parse(fs.readFileSync(".ua/knowledge-graph.json", "utf8"));
const have = new Set(g.nodes.filter(n => n.type === "file").map(n => n.id.slice(5)));
const all = cp.execSync("git ls-files sql python/pyspark/errors/exceptions/captured.py", { maxBuffer: 1e8 }).toString().split("\n");
const miss = all.filter(f => /(\/src\/main\/|captured\.py)/.test(f) && /\.(scala|java|proto|py)$/.test(f) && !/package-info|sql\/hive/.test(f) && !have.has(f));
const rank = f => { const i = L.order.findIndex(re => re.test(f)); return i < 0 ? 99 : i; };
miss.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
const lines = f => fs.readFileSync(f, "utf8").split("\n").length;
const w = f => { const l = lines(f); return L.huge.test(f) ? 1500 : L.shallow.test(f) ? Math.round(l * 0.6) : l; };
const waves = []; let cur = [], cl = 0;
for (const f of miss) { const x = w(f); if (cur.length && (cur.length >= 30 || cl + x > 5200)) { waves.push(cur); cur = []; cl = 0; } cur.push(f); cl += x; }
if (cur.length) waves.push(cur);
const core = JSON.parse(fs.readFileSync(process.env.S + "/core-waves.json", "utf8")).slice(0, 21);
fs.writeFileSync(process.env.S + "/core-waves.json", JSON.stringify(core.concat(waves), null, 1));
console.log("missing", miss.length, "sql waves", waves.length);
waves.forEach((v, i) => {
  const d = {};
  v.forEach(f => { const k = f.replace(/^sql\/([^/]+)\/src\/main\/(scala|java|protobuf)\/org\/apache\/spark\/sql\//, "$1:").split("/").slice(0, 3).join("/"); d[k] = (d[k] || 0) + 1; });
  console.log("C" + (22 + i), v.length, "files", v.reduce((a, f) => a + lines(f), 0), "lines |", Object.entries(d).slice(0, 4).map(([k, n]) => k + ":" + n).join(" "));
});
