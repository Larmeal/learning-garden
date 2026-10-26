# How to resume the Spark graph work (read this first after a context reset)

State lives in files, not in the chat:
- `BACKLOG.md`: ordered list of sets and the rules for each set.
- `PROGRESS.md`: what was done, in order, with sizes. The last lines say where it stopped.
- `query-pipeline-current/`: latest copy of the graph (knowledge-graph.json, meta.json, .understandignore).
- `index/`: rule, config and physical operator indexes (generated from source, no LLM).
- `notes/`: audit of lessons 00-05, and evidence notes for later lessons.
- `tools/`: helper scripts (see below).

The live graph is `<spark repo>/.ua/` (E:\Development\Project\open-source\spark\.ua), excluded from git through
`.git/info/exclude`. The Spark checkout is v4.2.0 (commit 32f72996). Do not edit Spark sources, do not commit or push,
do not edit `site/` unless the user asks.

## State at the time of writing
160 files, 2,475 nodes, 5,576 edges, 17 layers, tour 32 steps, one connected component. Done so far: query pipeline
(Catalyst, planning, execution, AQE, exchange, joins, aggregate, window), Python UDF bridge (JVM side and Python
worker side), data source read path and Parquet, Spark Connect (Python client and server), core scheduler, SparkContext,
RDD, dependencies, shuffle and BlockManager. Not started: S11 and later in `BACKLOG.md` (streaming, memory, Catalyst
expressions, PySpark API surface, DSv2, executor/deploy, UI, pandas API, MLlib, common/*).
Known gaps are listed at the end of the stage lines in `PROGRESS.md`.

## Per-stage procedure (what worked)
Define `S` = a scratch folder that holds copies of `tools/*` (the shell scripts have an `S=` line near the top that you
must point at it) and `ROOT` = the Spark repo.
1. Append the stage's files as `!path` lines (paths relative to the Spark repo root) to `.ua/.understandignore`.
   The file is a whitelist (`*`, `!*/`, then one `!file` line per analyzed file). Keep the number of new files under
   50 percent of the current file count, otherwise the skill plans a FULL_UPDATE (rebuild everything): split the set.
   Fewer than 10 new files gives PARTIAL_UPDATE (layers and tour need no script); 10 or more gives ARCHITECTURE_UPDATE
   (you must write `intermediate/layers.json` and `intermediate/tour.json`, see `tools/s10-layers.cjs` as a template).
2. `bash prep_stage.sh <name>`: snapshots, checks that scan, fingerprints, meta and graph file counts are equal, clears
   stale intermediate files, runs prepare-incremental and compute-batches, prints the batches. FULL_UPDATE or SKIP
   means stop and fix or split.
3. Dispatch general-purpose subagents (about 2,000-4,500 lines each). Each reads
   `C:\Users\armlo\.understand-anything-plugin\agents\file-analyzer.md` and writes `.ua/intermediate/batch-<N>.json`
   or `batch-<N>-part-<K>.json` for a split batch. Instructions that worked: read the files fully, check line ranges,
   at most about 30-70 nodes per big file, edges only when the source text supports them, ids for cross-agent targets
   by convention (`class:<path>:<Name>`, `function:<path>:Class.method`, `file:<path>`), nothing outside ASCII.
   Tell each agent which files the other agents cover. Cost is about 130k-230k tokens per agent.
4. `bash post_stage.sh [layers-script]`: merge, run the layers script, finalize, add source-verified inherits edges,
   then report components, dangling edges and line range problems. Dropped edges with unresolved endpoints are normal
   (targets in files not analyzed).
5. Fix what the checks report, assign new files to layers and add tour steps, then
   `bash finish_stage.sh "<progress line>"` (copies the graph to the archive, clears intermediate, logs to PROGRESS.md).

## Traps already hit (do not repeat)
- A stale `.ua/intermediate/incremental-baseline.json` (and other incremental-*.json) is reused by the next prepare and
  silently drops earlier stages from the merged graph. Clear intermediate except `scan-result.json` before every prepare.
- A failed or aborted prepare rewrites `scan-result.json` with the new file list: restore it from the snapshot so it
  equals `fingerprints.json`.
- Do not pipe finalize into `tail` without `set -o pipefail`: it hides the exit code.
- The Bash tool collapses a double backslash into a single one. Write scripts with the Write tool, use regex literals,
  and never put an apostrophe inside a `node -e '...'` string.
- Python on Windows cannot open `/c/...` paths: use Windows paths for Python, or do the edit with the Edit tool.
- Name collisions: `Strategy` in SparkStrategies.scala is an alias of SparkStrategy, not RuleExecutor.Strategy.
  Scala `LogicalPlan` and the Python class `LogicalPlan` in `connect/plan.py` share a name: `addedges.cjs` now skips
  cross-language pairs. Check new Python files for the same kind of clash.
- Parents that are not in the graph leave classes without inherits edges and can split the graph into components. When
  a cluster is only reachable through a file that is not analyzed (the scheduler was reachable only through
  SparkContext), add that bridge file in a follow-up stage.
- The line range checker is brace based. For Python files and oddly indented Scala it reports false alarms (known:
  worker.py, dataframe.py, session.py, SparkSqlParser two functions, FileSourceStrategy, IndexShuffleBlockResolver,
  BlockManager, ShuffleExternalSorter). Check the source before fixing.
- Rate limits: an interrupted agent leaves partial work. Restore the snapshot state (scan-result, clear intermediate)
  and rerun the stage.

## Tools in `tools/`
- `prep_stage.sh`, `post_stage.sh`, `finish_stage.sh`: stage flow above.
- `inh2.cjs` + `addedges.cjs`: find and add inherits edges that the source declares.
- `add_edge.cjs <sourceSuffix> <targetSuffix> <type>`: add one edge you verified by hand.
- `lr.cjs`, `lr2.cjs`: line range checks. `coverage.cjs`: how much of the repo is in the graph.
- `verify-s9.cjs`: example of a completeness check (classes and key methods in the graph vs the source).
- `s*-layers.cjs`: layers and tour scripts of past stages (templates).
- `idx_*.cjs`: generators of the indexes in `index/`.
Graph text is English (`.ua/config.json`). Lesson text on the website is Thai.
