const fs=require("fs");
const g=JSON.parse(fs.readFileSync(".ua/knowledge-graph.json","utf8"));
const fileOf=id=>id.replace(/^[a-z]+:/,"").split(":")[0];
const cache={};const lines=f=>cache[f]||(cache[f]=fs.readFileSync(f,"utf8").split(/\r?\n/));
const ind=s=>s.length-s.trimStart().length;
let blocks=0,okEnd=0;const badEnd=[];const byFile={};
for(const n of g.nodes){
  if(n.type==="file"||!n.lineRange)continue;
  const f=fileOf(n.id);const L=lines(f);const [s,e]=n.lineRange;
  // find the line (within 6 lines of start) that opens the body with a trailing "{"
  let open=-1;for(let i=s-1;i<Math.min(s+5,e);i++){if(L[i].trimEnd().endsWith("{")){open=i;break}if(L[i].includes(" = ")&&!L[i].trimEnd().endsWith("(")&&i>s-1)break}
  if(open<0)continue;                      // expression body or one-liner: skip
  blocks++;
  const last=L[e-1]||"";const want=ind(L[s-1]);
  const ok=last.trim().startsWith("}")&&ind(last)===want;
  const k=f.split("/").pop();byFile[k]=byFile[k]||{b:0,x:0};byFile[k].b++;
  if(ok)okEnd++;else{byFile[k].x++;badEnd.push({f:k,id:n.id.split(":").pop(),type:n.type,range:n.lineRange.join("-"),endline:last.trim().slice(0,50),endind:ind(last),startind:want})}
}
console.log("block-bodied nodes:",blocks,"| end line is matching closing brace:",okEnd,"| not:",badEnd.length);
for(const[k,v]of Object.entries(byFile))if(v.x)console.log(" ",k.padEnd(30),"bad end",v.x,"of",v.b);
badEnd.slice(0,30).forEach(b=>console.log("  ",b.f,"|",b.type,b.id,b.range,"| end:",JSON.stringify(b.endline),"ind",b.endind,"vs",b.startind));
fs.writeFileSync(process.argv[2],JSON.stringify(badEnd));
