const fs=require("fs");
const g=JSON.parse(fs.readFileSync(".ua/knowledge-graph.json","utf8"));
const fileOf=id=>id.replace(/^[a-z]+:/,"").split(":")[0];
const cache={};const lines=f=>cache[f]||(cache[f]=fs.readFileSync(f,"utf8").split(/\r?\n/));
const res={};let total=0,noRange=0;
const bad=[];
for(const n of g.nodes){
  if(n.type==="file")continue;
  if(!n.lineRange){noRange++;continue}
  total++;
  const f=fileOf(n.id);const L=lines(f);const [s,e]=n.lineRange;
  let nm=n.id.split(":").pop();
  if(nm.includes("."))nm=nm.split(".").pop();     // class-qualified function names
  nm=nm.replace(/[$]/g,"");
  const startOk=s>=1&&e>=s&&e<=L.length;
  const win=L.slice(s-1,s+3).join(" ");           // declaration may wrap a few lines
  const nameOk=win.includes(nm);
  const endOk=/[})\]]\s*$/.test(L[e-1]||"")||/^\s*$/.test(L[e-1]||"")===false;
  const key=f.split("/").pop();res[key]=res[key]||{ok:0,bad:0};
  if(startOk&&nameOk){res[key].ok++}else{res[key].bad++;bad.push({f:key,id:nm,type:n.type,range:n.lineRange,why:!startOk?"range out of file":"name not at start line",line:(L[s-1]||"").trim().slice(0,70)})}
}
console.log("nodes with lineRange:",total,"| without:",noRange);
for(const[k,v]of Object.entries(res))console.log(k.padEnd(34),"ok",String(v.ok).padStart(3),"bad",String(v.bad).padStart(3));
fs.writeFileSync(process.argv[2],JSON.stringify(bad));
bad.slice(0,25).forEach(b=>console.log(" ",b.f,"|",b.type,b.id,b.range.join("-"),"|",b.why,"|",b.line));
