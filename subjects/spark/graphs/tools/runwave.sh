#!/bin/bash
# Usage: runwave.sh N  (needs $S/cN-cfg.json). merge + layers + checks, prints only the essentials.
N=$1
SB="/c/Users/armlo/AppData/Local/Temp/claude/e--Development-Project-open-source-spark/3e6bb945-00c7-46b0-9436-b239ee6c3a51/scratchpad"
cd /e/Development/Project/open-source/spark
SW="C:/Users/armlo/AppData/Local/Temp/claude/e--Development-Project-open-source-spark/3e6bb945-00c7-46b0-9436-b239ee6c3a51/scratchpad"
S=$SB
cat > $S/c$N-layers.cjs <<EOT
process.argv[2]="$SW/c$N-cfg.json";require("$SW/layers-lib.cjs");
EOT
cd $S && bash post_stage.sh "$S/c$N-layers.cjs" 2>&1 | grep -v "Dropped current edge\|^  - Edge\|^  [A-Za-z_.]* *function\|bad start\|^  [A-Za-z.]*\.\(scala\|py\|java\) *bad end\|batch-.*json\|Found 1\|^  X \|^  - " | tail -14
cd /e/Development/Project/open-source/spark
node $S/final-check.cjs | grep -v PASS
