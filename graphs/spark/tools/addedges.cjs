const fs=require("fs");
const g=JSON.parse(fs.readFileSync(".ua/knowledge-graph.json","utf8"));
const found=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const ex=g.edges.find(e=>e.type==="inherits");console.log("sample edge:",JSON.stringify(ex));
const SS=g.nodes.find(n=>n.type==="class"&&n.id.endsWith("SparkStrategies.scala:SparkStrategy")).id;
const ids=new Set(g.nodes.map(n=>n.id));const have=new Set(g.edges.map(e=>e.type+"|"+e.source+"|"+e.target));
let add=0,remap=0,skip=0;
for(const f of found){
  let t=f.t;
  if(t.endsWith("RuleExecutor.scala:Strategy")){t=SS;remap++;}  // type Strategy = SparkStrategy (classic/package.scala:45)
  const py=x=>/[.]py(:|$)/.test(x);  // a Scala and a Python class may share a name: never link across languages
  if(!ids.has(f.s)||!ids.has(t)||f.s===t||py(f.s)!==py(t)){skip++;continue}
  const k="inherits|"+f.s+"|"+t;if(have.has(k)){skip++;continue}
  g.edges.push({source:f.s,target:t,type:"inherits",direction:ex.direction,weight:ex.weight});have.add(k);add++;
}
fs.writeFileSync(".ua/knowledge-graph.json",JSON.stringify(g,null,2));
console.log("added",add,"(remapped Strategy->SparkStrategy:",remap+")","skipped",skip);
// connectivity after
const par=new Map();const find=x=>{while(par.get(x)!==x){par.set(x,par.get(par.get(x)));x=par.get(x)}return x};
g.nodes.forEach(n=>par.set(n.id,n.id));g.edges.forEach(e=>par.set(find(e.source),find(e.target)));
const comp=new Map();g.nodes.forEach(n=>{const r=find(n.id);comp.set(r,(comp.get(r)||0)+1)});
console.log("components after:",comp.size,[...comp.values()].join(","),"edges",g.edges.length);
