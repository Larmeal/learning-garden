// usage: node layers-lib.cjs <config.json>; config: {files:"cN-files.txt", assign:[{layer,match:"regex"}], newLayers:[{id,name,description,match:"regex"}], tour:[{title,description,match:"regex"|files:[...]}], appendDesc:{layerName:"text"}}
const fs=require("fs");
const cfg=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const g=JSON.parse(fs.readFileSync(".ua/knowledge-graph.json","utf8"));
const asm=JSON.parse(fs.readFileSync(".ua/intermediate/assembled-graph.json","utf8"));
const ids=new Set(asm.nodes.map(n=>n.id));
const files=fs.readFileSync(cfg.files,"utf8").split("\n").filter(Boolean).map(x=>"file:"+x.slice(1));
const layers=JSON.parse(JSON.stringify(g.layers));
layers.forEach(l=>{l.nodeIds=l.nodeIds.filter(i=>!files.includes(i))});
const placed=new Set();
for(const a of cfg.assign||[]){const re=new RegExp(a.match);const L=layers.find(l=>l.name===a.layer);if(!L)throw new Error("no layer "+a.layer);
  files.filter(f=>!placed.has(f)&&re.test(f)).forEach(f=>{L.nodeIds.push(f);placed.add(f)});}
for(const nl of cfg.newLayers||[]){const re=new RegExp(nl.match);const m=files.filter(f=>!placed.has(f)&&re.test(f));m.forEach(f=>placed.add(f));layers.push({id:nl.id,name:nl.name,description:nl.description,nodeIds:m});}
for(const [k,v] of Object.entries(cfg.appendDesc||{})){const L=layers.find(l=>l.name===k);if(!L)throw new Error("no layer "+k);L.description+=" "+v;}
const rest=files.filter(f=>!placed.has(f));
if(rest.length){console.log("UNPLACED:",rest.length);rest.slice(0,10).forEach(f=>console.log("  ",f));process.exit(1)}
layers.filter(l=>l.nodeIds.length===0).forEach(l=>console.log("EMPTY layer",l.name));
const bad=[];layers.forEach(l=>l.nodeIds.forEach(id=>{if(!ids.has(id))bad.push(id)}));
const seen=new Set();layers.forEach(l=>l.nodeIds.forEach(id=>{if(seen.has(id))bad.push("dup "+id);seen.add(id)}));
asm.nodes.filter(n=>n.type==="file").forEach(n=>{if(!seen.has(n.id))bad.push("unassigned "+n.id)});
console.log("problems:",bad.length,bad.slice(0,8));if(bad.length)process.exit(1);
fs.writeFileSync(".ua/intermediate/layers.json",JSON.stringify(layers,null,2));
const tour=JSON.parse(JSON.stringify(g.tour));
for(const t of cfg.tour||[]){let nodeIds=t.files?t.files.map(f=>"file:"+f):[];if(t.match){const re=new RegExp(t.match);nodeIds=nodeIds.concat(files.filter(f=>re.test(f)))}
  nodeIds=nodeIds.filter(i=>ids.has(i));tour.push({order:tour.length+1,title:t.title,description:t.description,nodeIds});}
tour.forEach(s=>s.nodeIds.forEach(id=>{if(!ids.has(id))throw new Error("tour node missing "+id)}));
fs.writeFileSync(".ua/intermediate/tour.json",JSON.stringify(tour,null,2));
console.log("layers",layers.length,"tour",tour.length);
