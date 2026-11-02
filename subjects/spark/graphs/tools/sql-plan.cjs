// usage: node sql-plan.cjs N  -> groups the wave files into agent sections, tags [SHALLOW] / [HUGE], writes .ua/tmp/cN-plan.txt
const fs = require("fs");
const L = require(process.env.S + "/sql-lib.cjs");
const N = process.argv[2];
const b = JSON.parse(fs.readFileSync(".ua/intermediate/batches.json", "utf8")).batches;
const items = [];
b.forEach(x => x.files.forEach(f => items.push({ b: x.batchIndex, p: f.path, l: f.sizeLines })));
const tag = p => L.huge.test(p) ? "HUGE" : L.shallow.test(p) ? "SHALLOW" : "";
const wt = it => tag(it.p) === "HUGE" ? 1500 : tag(it.p) === "SHALLOW" ? it.l * 0.6 : it.l;
const groups = []; let cur = [], cw = 0;
for (const it of items) {
  const allShallow = cur.every(x => tag(x.p)) && tag(it.p);
  const cap = allShallow ? 16 : 9;
  if (cur.length && (cw + wt(it) > 1400 || cur.length >= cap)) { groups.push(cur); cur = []; cw = 0; }
  cur.push(it); cw += wt(it);
}
if (cur.length) groups.push(cur);
const out = [];
groups.forEach((g, i) => {
  const bi = g[0].b;
  const o = `AGENT ${i + 1} (${g.reduce((a, x) => a + x.l, 0)} lines) outputs: batch-${bi}-part-${i * 10 + 1}.json and batch-${bi}-part-${i * 10 + 2}.json\n` +
    g.map(x => "  " + x.p + " (" + x.l + ")" + (tag(x.p) ? " [" + tag(x.p) + "]" : "")).join("\n");
  out.push(o); console.log(o);
});
fs.writeFileSync(".ua/tmp/c" + N + "-plan.txt", out.join("\n") + "\n");
// record shallow files for a possible later depth A pass
const sh = items.filter(x => tag(x.p)).map(x => x.p);
if (sh.length) fs.appendFileSync(process.env.S + "/shallow-files.txt", sh.map(p => "C" + N + " " + p).join("\n") + "\n");
