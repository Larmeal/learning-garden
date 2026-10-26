#!/bin/bash
# Usage: finish_stage.sh "<progress line>"
# Checks ASCII and consistency, syncs the archive copy, clears intermediate state, appends to PROGRESS.md.
set -e
ROOT="/e/Development/Project/open-source/spark"
cd "$ROOT"
if grep -q -P "[^\x00-\x7F]" .ua/knowledge-graph.json; then echo "NON-ASCII in graph"; exit 5; fi
node -e '
const fs=require("fs");
const g=JSON.parse(fs.readFileSync(".ua/knowledge-graph.json","utf8"));
const sc=JSON.parse(fs.readFileSync(".ua/intermediate/scan-result.json","utf8")).files.length;
const fp=Object.keys(JSON.parse(fs.readFileSync(".ua/fingerprints.json","utf8")).files).length;
const mt=JSON.parse(fs.readFileSync(".ua/meta.json","utf8")).analyzedFiles;
const gf=g.nodes.filter(n=>n.type==="file").length;
console.log("final: nodes",g.nodes.length,"edges",g.edges.length,"files",gf,"layers",g.layers.length,"tour",g.tour.length,"| scan",sc,"fp",fp,"meta",mt);
if(!(sc===fp&&fp===mt&&mt===gf)){console.log("INCONSISTENT");process.exit(6)}'
D="/e/Development/Project/learning/graphs/spark/query-pipeline-current"
cp .ua/knowledge-graph.json .ua/meta.json .ua/.understandignore "$D/"
find .ua/intermediate -mindepth 1 -maxdepth 1 -not -name 'scan-result.json' -exec rm -rf {} +
echo "- $(date +%Y-%m-%d) $1" >> /e/Development/Project/learning/graphs/spark/PROGRESS.md
git status --short | head -2
echo "stage finished"
