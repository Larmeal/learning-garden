const fs=require("fs");
const g=JSON.parse(fs.readFileSync(".ua/knowledge-graph.json","utf8"));const have=new Set(g.nodes.filter(n=>n.type==="file").map(n=>n.id.slice(5)));
function walk(d,o=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=d+"/"+e.name;if(e.isDirectory())walk(f,o);else o.push(f)}return o}
const miss=walk("core/src/main").filter(f=>/[.](scala|java)$/.test(f)&&!/package-info/.test(f)&&!have.has(f));
const rel=f=>f.replace(/^core\/src\/main\/(scala|java)\/org\/apache\/spark\//,"");
const order=[/^scheduler\//,/^storage\//,/^memory\//,/^shuffle\//,/^broadcast\//,/^serializer\//,/^executor\//,/^rpc\//,/^security\//,/^io\//,/^internal\/io\//,/^internal\/plugin\//,/^input\//,/^partial\//,/^rdd\//,/^mapred\//,/^network\//,/^[^/]+$/,/^api\//,/^resource\//,/^metrics\//,/^internal\/config\//,/^util\/Utils/,/^util\/(?!collection|logging|io|random)/,/^util\/(collection|logging|io|random)/,/^errors\//,/^paths\//,/^launcher\//,/^deploy\/(?!history|master|worker|rest|security)/,/^deploy\/(master|worker|rest|security)/,/^deploy\/history/,/^ui\//,/^status\/(?!protobuf)/,/^status\/protobuf/];
const rank=f=>{const r=rel(f);const i=order.findIndex(re=>re.test(r));return i<0?99:i};
miss.sort((a,b)=>rank(a)-rank(b)||a.localeCompare(b));
const lines=f=>fs.readFileSync(f,"utf8").split("\n").length;
const waves=[];let cur=[],cl=0;
for(const f of miss){const l=lines(f);if(cur.length&&(cur.length>=30||cl+l>5200)){waves.push(cur);cur=[];cl=0}cur.push(f);cl+=l}
if(cur.length)waves.push(cur);
fs.writeFileSync(process.env.S+"/core-waves.json",JSON.stringify(waves,null,1));
waves.forEach((w,i)=>{const dirs={};w.forEach(f=>{const r=rel(f);const k=r.includes("/")?r.split("/")[0]+(r.startsWith("util/")||r.startsWith("deploy/")||r.startsWith("status/")||r.startsWith("internal/")?"/"+r.split("/")[1].replace(/[.].*/,"").slice(0,12):""):"top";dirs[k]=(dirs[k]||0)+1});console.log("C"+(i+1),w.length,"files",w.reduce((a,f)=>a+lines(f),0),"lines |",Object.entries(dirs).slice(0,7).map(([k,v])=>k+":"+v).join(" "))});
