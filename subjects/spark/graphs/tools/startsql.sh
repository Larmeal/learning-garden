#!/bin/bash
# Usage: startwave.sh N   (N = wave number from core-waves.json, 1-based). Appends files to ignore, runs prep_stage, prints agent plan.
set -e
N=$1
export S="/c/Users/armlo/AppData/Local/Temp/claude/e--Development-Project-open-source-spark/3e6bb945-00c7-46b0-9436-b239ee6c3a51/scratchpad"
cd /e/Development/Project/open-source/spark
S="$S" node -e '
const w=require(process.env.S+"/core-waves.json")[+process.argv[1]-1];
require("fs").writeFileSync(process.env.S+"/c"+process.argv[1]+"-files.txt",w.map(f=>"!"+f).join("\n")+"\n");' $N
cat $S/c$N-files.txt >> .ua/.understandignore
bash $S/prep_stage.sh c$N 2>&1 | grep -E "snapshot|pre-state|Incremental plan|NOT AN|INCONSISTENT|Wrote" 
SX=1; S="$S" node $S/mkcfg.cjs $N
S="$S" node $S/sql-plan.cjs $N
