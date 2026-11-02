// Splits the wave's files into agent groups (by batches.json order, contiguous), prints file lists and output names.
const fs=require("fs");
const N=process.argv[2];const per=+(process.argv[3]||1100);
const b=JSON.parse(fs.readFileSync(".ua/intermediate/batches.json","utf8")).batches;
const items=[];b.forEach(x=>x.files.forEach(f=>items.push({b:x.batchIndex,p:f.path,l:f.sizeLines})));
const groups=[];let cur=[],cl=0;
for(const it of items){if(cur.length&&(cl+it.l>per||cur.length>=9)){groups.push(cur);cur=[];cl=0}cur.push(it);cl+=it.l}
if(cur.length)groups.push(cur);
const lines=[];
groups.forEach((g,i)=>{
  const bi=g[0].b;const out=`batch-${bi}-part-${i*10+1}.json and batch-${bi}-part-${i*10+2}.json`;
  const o=`AGENT ${i+1} (${g.reduce((a,x)=>a+x.l,0)} lines) outputs: ${out}\n`+g.map(x=>"  "+x.p+" ("+x.l+")").join("\n");
  lines.push(o);console.log(o);
});
fs.writeFileSync(".ua/tmp/c"+N+"-plan.txt",lines.join("\n")+"\n");
