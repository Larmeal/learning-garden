const fs=require("fs");const cp=require("child_process");
const out=process.argv[2];
const files=cp.execSync("git ls-files sql/catalyst/src/main sql/core/src/main sql/api/src/main",{encoding:"utf8",maxBuffer:1<<26}).split(/\r?\n/).filter(f=>f.endsWith(".scala"));
const rules=[];const decl=/^\s*(?:private\[?\w*\]?\s+|final\s+|abstract\s+|sealed\s+)*(object|class|case class|trait)\s+([A-Za-z0-9_]+)/;
for(const f of files){
  const L=fs.readFileSync(f,"utf8").split(/\r?\n/);
  for(let i=0;i<L.length;i++){
    const m=L[i].match(decl);if(!m)continue;
    let win=L[i];for(let k=1;k<=4&&i+k<L.length;k++){win+=" "+L[i+k].trim();if(L[i+k].includes("{"))break}
    const r=win.match(/extends\s+(?:[A-Za-z0-9_.]*\.)?Rule\[(\w+)\]/);
    if(r)rules.push({name:m[2],kind:m[1],planType:r[1],file:f,line:i+1,batches:[]});
  }
}
const byName=new Map();rules.forEach(r=>{if(!byName.has(r.name))byName.set(r.name,[]);byName.get(r.name).push(r)});
const batchFiles=["sql/catalyst/src/main/scala/org/apache/spark/sql/catalyst/optimizer/Optimizer.scala","sql/core/src/main/scala/org/apache/spark/sql/execution/SparkOptimizer.scala","sql/catalyst/src/main/scala/org/apache/spark/sql/catalyst/analysis/Analyzer.scala","sql/core/src/main/scala/org/apache/spark/sql/execution/adaptive/AQEOptimizer.scala"];
const ind=l=>l.length-l.trimStart().length;
const idents=body=>body.replace(/\/\/.*$/,"").match(/[A-Za-z_][A-Za-z0-9_]*/g)||[];
const batches=[];const sets=new Map();
for(const f of batchFiles){
  const L=fs.readFileSync(f,"utf8").split(/\r?\n/);
  for(let i=0;i<L.length;i++){
    const m=L[i].match(/^\s*(?:private\s+|protected\s+|final\s+|override\s+|lazy\s+)*(?:val|def)\s+(\w*(?:RuleSet|Rules|Set)\w*)\b/);
    if(!m)continue;
    const base=ind(L[i]);const names=[];
    for(let j=i;j<L.length;j++){
      if(j>i&&L[j].trim()&&ind(L[j])<=base&&/^\s*(def|val|override|private|protected|final|object|class|lazy)\b/.test(L[j]))break;
      for(const t of idents(L[j]))if(byName.has(t)&&!names.includes(t))names.push(t);
    }
    if(names.length)sets.set(m[1],{file:f.split("/").pop(),line:i+1,rules:names});
  }
  for(let i=0;i<L.length;i++){
    const m=L[i].match(/Batch\("([^"]+)"\s*,\s*([A-Za-z]+(?:\([^)]*\))?)/);if(!m)continue;
    const b={file:f,line:i+1,name:m[1],strategy:m[2],rules:[],sets:[]};
    let depth=0;
    for(let j=i;j<L.length;j++){
      const t=L[j].replace(/\/\/.*$/,"");for(const ch of t){if(ch==="(")depth++;else if(ch===")")depth--}
      for(const id of idents(L[j])){if(byName.has(id)&&!b.rules.includes(id))b.rules.push(id);if(sets.has(id)&&!b.sets.includes(id))b.sets.push(id)}
      if(depth<=0)break;
    }
    for(const sn of b.sets)for(const rn of sets.get(sn).rules)if(!b.rules.includes(rn))b.rules.push(rn);
    batches.push(b);
  }
}
for(const b of batches)for(const rn of b.rules)for(const r of byName.get(rn))r.batches.push({file:b.file.split("/").pop(),batch:b.name});
fs.writeFileSync(out,JSON.stringify({generatedFor:"Spark v4.2.0 (32f72996)",ruleCount:rules.length,ruleSets:Object.fromEntries(sets),batches,rules},null,1));
console.log("rule definitions:",rules.length,"| batches:",batches.length,"| named sets:",[...sets.keys()].join(","));
console.log("rules referenced in a batch:",rules.filter(r=>r.batches.length).length);
const z=batches.filter(b=>!b.rules.length);console.log("batches with 0 rules:",z.length,z.map(b=>b.name).join(" | "));
