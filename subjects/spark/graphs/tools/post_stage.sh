#!/bin/bash
# Usage: post_stage.sh [layers-script]
# Runs merge, optional layers script (needed for ARCHITECTURE_UPDATE), finalize, adds source-verified
# inherits edges, then verifies. Stops at the first failure.
set -e
set -o pipefail
ROOT="/e/Development/Project/open-source/spark"
export S="C:/Users/armlo/AppData/Local/Temp/claude/e--Development-Project-open-source-spark/3e6bb945-00c7-46b0-9436-b239ee6c3a51/scratchpad"
SK="$HOME/.claude/skills/understand"
cd "$ROOT"
ls .ua/intermediate | grep -E "^batch-"
python "$SK/merge-batch-graphs.py" "$ROOT" 2>&1 | grep -E "batch|Input|Output|passed|Skipped|rror|multi|Dropped" | cut -c1-200
if [ -n "$1" ]; then node "$1"; fi
cp .ua/knowledge-graph.json "$S/repair/kg-before-finalize-latest.json"
node "$SK/finalize-incremental.mjs" "$ROOT" 2>&1 | tail -3
echo "--- inherits scan (Strategy collisions hidden)"
node "$S/inh2.cjs" "$S/missing-inherits-latest.json" | grep -v "Strategy (RuleExecutor.scala)"
node "$S/addedges.cjs" "$S/missing-inherits-latest.json" | tail -2
node -e '
const fs=require("fs");const g=JSON.parse(fs.readFileSync(".ua/knowledge-graph.json","utf8"));
const par=new Map();const find=x=>{while(par.get(x)!==x){par.set(x,par.get(par.get(x)));x=par.get(x)}return x};
g.nodes.forEach(n=>par.set(n.id,n.id));g.edges.forEach(e=>{if(par.has(e.source)&&par.has(e.target))par.set(find(e.source),find(e.target))});
const comp=new Map();g.nodes.forEach(n=>{const r=find(n.id);if(!comp.has(r))comp.set(r,[]);comp.get(r).push(n)});
const ids=new Set(g.nodes.map(n=>n.id));const dangling=g.edges.filter(e=>!ids.has(e.source)||!ids.has(e.target)).length;
const nf=g.nodes.filter(n=>n.type==="file").length,fp=Object.keys(JSON.parse(fs.readFileSync(".ua/fingerprints.json","utf8")).files).length,mt=JSON.parse(fs.readFileSync(".ua/meta.json","utf8")).analyzedFiles;
console.log("nodes",g.nodes.length,"edges",g.edges.length,"files",nf,"layers",g.layers.length,"tour",g.tour.length,"components",comp.size,"dangling",dangling,"fingerprints",fp,"meta",mt);
if(comp.size!==1)for(const[r,ns]of comp)console.log(" component",ns.length,ns.filter(n=>n.type==="file").map(n=>n.id.split("/").pop()).join(","));
const known=new Set(fs.readFileSync(process.env.S+"/known-islands.txt","utf8").split("\n").filter(l=>l&&!l.startsWith("#")).map(l=>"file:"+l.split(/\s+#/)[0].trim()));
let bad=0;for(const[r,ns]of comp){if(ns.length>200)continue;const fl=ns.filter(n=>n.type==="file").map(n=>n.id);if(fl.length&&fl.every(f=>known.has(f))){console.log("note: known island",fl.length);continue}bad++}
if(bad>0||dangling||nf!==fp||fp!==mt){console.log("CHECK FAILED");process.exit(4)}'
node "$S/lr.cjs" "$S/lr-bad.json" | sed -n '1p'
node -e 'const b=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("bad start lines:",b.length);b.slice(0,10).forEach(x=>console.log(" ",x.f,x.type,x.id,x.range.join("-"),x.why,"|",x.line))' "$S/lr-bad.json"
node "$S/lr2.cjs" "$S/lr-badend.json" | head -10
