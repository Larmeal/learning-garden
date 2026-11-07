#!/bin/bash
# Usage: runwave.sh N  (needs $S/cN-cfg.json). merge + layers + checks, prints only the essentials.
N=$1
SB="${SCRATCH:?set SCRATCH to the scratchpad folder}"
cd /e/Development/Project/open-source/spark
SW="${SCRATCH:?set SCRATCH to the scratchpad folder}"
S=$SB
cat > $S/c$N-layers.cjs <<EOT
process.argv[2]="$SW/c$N-cfg.json";require("$SW/layers-lib.cjs");
EOT
cd $S && bash post_stage.sh "$S/c$N-layers.cjs" 2>&1 | grep -v "Dropped current edge\|^  - Edge\|^  [A-Za-z_.]* *function\|bad start\|^  [A-Za-z.]*\.\(scala\|py\|java\) *bad end\|batch-.*json\|Found 1\|^  X \|^  - " | tail -14
cd /e/Development/Project/open-source/spark
node $S/final-check.cjs | grep -v PASS
