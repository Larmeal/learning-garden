// usage: node checkwave.cjs N  -> flags in wave files (line range) and suspicious summaries
const fs=require("fs");const S=process.env.S;const N=process.argv[2];
const g=JSON.parse(fs.readFileSync(".ua/knowledge-graph.json","utf8"));
const paths=fs.readFileSync(S+"/c"+N+"-files.txt","utf8").split("\n").filter(Boolean).map(x=>x.slice(1));
const names=new Set(paths.map(p=>p.split("/").pop()));
const ns=g.nodes.filter(n=>paths.some(p=>n.id.includes(":"+p)));
console.log("new nodes",ns.length);
for(const f of ["lr-bad.json","lr-badend.json"]){try{const b=JSON.parse(fs.readFileSync(S+"/"+f,"utf8"));const m=b.filter(x=>names.has(x.f));console.log(f,"flags in wave files:",m.length);m.forEach(x=>console.log("  ",x.f,x.id,x.range,"|",String(x.line||x.endline).slice(0,70)))}catch(e){console.log(f,"unreadable")}}
const re=/pyspark|py4j|databricks|delta lake|iceberg|hudi|best practice|typically|usually|commonly|in practice|for example,? when you|you should/i;
const sus=ns.filter(n=>re.test(n.summary||""));
console.log("suspicious summaries:",sus.length);
sus.forEach(n=>console.log("  ",n.id.replace(/^(\w+):.*\/(.*)$/,"$1 $2"),"|",(n.summary||"").slice(0,240)));
const emp=ns.filter(n=>!n.summary||n.summary.length<20).length;console.log("short/empty summaries:",emp);
