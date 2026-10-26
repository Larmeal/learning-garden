const fs=require("fs");const cp=require("child_process");
const sh=c=>cp.execSync(c,{encoding:"utf8",maxBuffer:1<<27});
const files=sh("git ls-files sql/catalyst/src/main/scala/org/apache/spark/sql/internal sql/core/src/main/scala/org/apache/spark/sql/internal sql/api/src/main core/src/main/scala/org/apache/spark/internal/config").split(/\r?\n/).filter(f=>f.endsWith(".scala"));
const G=new Map();
for(const l of sh("git grep -h -E -e \"(val|String)[ ]+[A-Z][A-Z0-9_]*[ ]*([:][ ]*String)?[ ]*=[ ]*[\\\"]spark[.]\" -- \"*.scala\" \"*.java\"").split(/\r?\n/)){
  const m=l.match(/(?:val|String)\s+([A-Z][A-Z0-9_]*)\s*(?::\s*String\s*)?=\s*"(spark\.[^"]+)"/);if(m&&!G.has(m[1]))G.set(m[1],m[2]);
}
console.log("global constants:",G.size);
const strs=t=>{const m=t.match(/"[^"]*"/g)||[];return m.map(s=>s.slice(1,-1))};
const confs=[];
for(const f of files){
  const L=fs.readFileSync(f,"utf8").split(/\r?\n/);
  for(let i=0;i<L.length;i++){
    const m=L[i].match(/(buildConf|buildStaticConf|ConfigBuilder)\(\s*("([^"]+)"|[A-Za-z_.]+)\s*\)/);
    if(!m)continue;
    let key=m[3];if(!key){const id=m[2].split(".").pop();key=G.get(id)||m[2]}
    let end=i;for(let k=i;k<Math.min(i+60,L.length);k++){if(k>i&&/(buildConf|buildStaticConf|ConfigBuilder)\(/.test(L[k]))break;end=k;if(/\.create\w*\(/.test(L[k])||/\.fallbackConf\(/.test(L[k]))break}
    const block=L.slice(i,end+1).join("\n");
    const docM=block.match(/\.doc\(([\s\S]*?)\)\s*(?:\.\w+|$)/);
    const doc=docM?strs(docM[1]).join("").replace(/\s+/g," ").trim():"";
    const ver=(block.match(/\.version\("([^"]+)"\)/)||[])[1]||"";
    const internal=/\.internal\(\)/.test(block);
    let def="";
    let d=block.match(/\.createWithDefault\(([\s\S]*?)\)\s*$/);if(d)def=d[1].replace(/\s+/g," ").trim();
    d=block.match(/\.createWithDefaultString\(("[^"]*")\)/);if(d)def=d[1].slice(1,-1);
    if(/\.createOptional/.test(block))def="(none)";
    if(/\.createWithDefaultFunction/.test(block))def="(computed)";
    d=block.match(/\.fallbackConf\(\s*([A-Za-z_.]+)\s*\)/);if(d)def="(fallback to "+d[1]+")";
    confs.push({key,default:def,version:ver,internal,doc:doc.slice(0,400),file:f.split("/").slice(-1)[0],line:i+1,scope:f.startsWith("core/")?"core":"sql",resolved:key.startsWith("spark.")});
  }
}
const seen=new Set();const uniq=confs.filter(c=>{const k=c.scope+c.key;if(seen.has(k))return false;seen.add(k);return true});
fs.writeFileSync("E:/Development/Project/learning/graphs/spark/index/configs.json",JSON.stringify({generatedFor:"Spark v4.2.0 (32f72996)",count:uniq.length,configs:uniq},null,1));
console.log("configs:",uniq.length,"| sql",uniq.filter(c=>c.scope==="sql").length,"| core",uniq.filter(c=>c.scope==="core").length,"| internal",uniq.filter(c=>c.internal).length,"| unresolved keys",uniq.filter(c=>!c.resolved).length);
for(const k of ["spark.sql.shuffle.partitions","spark.sql.ansi.enabled","spark.executor.memory","spark.sql.autoBroadcastJoinThreshold","spark.executor.cores","spark.sql.adaptive.advisoryPartitionSizeInBytes","spark.memory.fraction","spark.default.parallelism","spark.dynamicAllocation.enabled"]){const c=uniq.find(x=>x.key===k);console.log(k.padEnd(52),c?("default="+c.default+" | v"+c.version):"NOT FOUND")}
console.log("unresolved sample:",uniq.filter(c=>!c.resolved).slice(0,5).map(c=>c.key).join(", "));
