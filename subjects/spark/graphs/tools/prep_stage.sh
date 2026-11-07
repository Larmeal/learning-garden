#!/bin/bash
# Usage: prep_stage.sh <snapshot-name>
# Assumes the stage's files were already appended (uncommented) to .ua/.understandignore.
set -e
ROOT="/e/Development/Project/open-source/spark"
S="${SCRATCH:?set SCRATCH to the scratchpad folder}"
SK="$HOME/.claude/skills/understand"
cd "$ROOT"
SNAP="$S/repair/snap-$1"; rm -rf "$SNAP"; mkdir -p "$SNAP"
cp .ua/knowledge-graph.json .ua/fingerprints.json .ua/meta.json .ua/.understandignore .ua/intermediate/scan-result.json "$SNAP/"
echo "snapshot: $SNAP"
node -e '
const fs=require("fs");
const sc=JSON.parse(fs.readFileSync(".ua/intermediate/scan-result.json","utf8")).files.length;
const fp=Object.keys(JSON.parse(fs.readFileSync(".ua/fingerprints.json","utf8")).files).length;
const mt=JSON.parse(fs.readFileSync(".ua/meta.json","utf8")).analyzedFiles;
const gf=JSON.parse(fs.readFileSync(".ua/knowledge-graph.json","utf8")).nodes.filter(n=>n.type==="file").length;
console.log("pre-state scan",sc,"fingerprints",fp,"meta",mt,"graph files",gf);
if(!(sc===fp&&fp===mt&&mt===gf)){console.log("INCONSISTENT pre-state");process.exit(2)}'
find .ua/intermediate -mindepth 1 -maxdepth 1 -not -name 'scan-result.json' -exec rm -rf {} +
mkdir -p .ua/tmp
HASH=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(".ua/meta.json","utf8")).gitCommitHash)')
node "$SK/prepare-incremental.mjs" "$ROOT" "$HASH" 2>&1 | tail -1
node -e '
const fs=require("fs");
const p=JSON.parse(fs.readFileSync(".ua/intermediate/incremental-plan.json","utf8"));
console.log(p.action,"| reanalyze",p.filesToReanalyze.length,"| reason:",p.reason);
if(p.action!=="PARTIAL_UPDATE"&&p.action!=="ARCHITECTURE_UPDATE"){console.log("NOT AN INCREMENTAL ACTION: "+p.action);process.exit(3)}
if(p.action==="ARCHITECTURE_UPDATE")console.log("note: ARCHITECTURE_UPDATE, layers and tour are updated by hand afterwards");
const e=JSON.parse(fs.readFileSync(".ua/intermediate/batch-existing.json","utf8"));
console.log("batch-existing nodes",e.nodes.length,"files",e.nodes.filter(n=>n.type==="file").length);'
node "$SK/compute-batches.mjs" "$ROOT" --changed-files=".ua/intermediate/changed-files.json" 2>&1 | tail -1
node -e '
const b=JSON.parse(require("fs").readFileSync(".ua/intermediate/batches.json","utf8"));
b.batches.forEach(x=>console.log("batch",x.batchIndex,"|",x.files.map(f=>f.path.split("/").pop()+"("+f.sizeLines+")").join(", ")))'
