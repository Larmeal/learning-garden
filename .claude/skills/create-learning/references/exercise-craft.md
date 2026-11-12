# Exercise craft: evidence that a lesson can stand on

Learned while building the Iceberg subject (2026-11-12: 14 exercises, Spark and PyIceberg together). Read it before writing the first exercise
of a subject. The point of an exercise is not to pass: it is to **find out what is true before the lesson says it**. Four times in that subject the
real output was different from what the author expected, and each time the surprise became the best part of a lesson.

## Run first, write the claim second

- Write the exercise with prints and loose asserts, run it, look at the output, then tighten the asserts to what you saw. Paste the real
  output into the lesson.
- When the output contradicts your guess, **change the lesson, not the output**. Examples that were all wrong at first and then taught:
  PyIceberg retries a collision by itself (the author expected `CommitFailedException`); `INSERT OVERWRITE` replaces the whole table by default
  (the author expected one partition); the changelog view refuses a range that holds delete files (the capstone had to change); a delete file
  can stay behind after compaction.
- A claim about how something works inside (the order of a commit, which SQL the catalog runs) is checked in the source before it is written:
  `grep -n` the constant or the method in the checkout under `E:\Development\Project\open-source\<repo>` and tag the claim **source** with
  the file and the name. If you only read the class names, say "ยังไม่ได้ไล่โค้ด" next to it.
- A claim that could not be run (no server, no cluster) stays in the lesson, tagged "ไม่ได้รัน" with the reason. Do not drop it and do not
  pretend. Say in the hand-back which parts are like that.
- Do not leave a "try it yourself" Callout whose result you did not check. Check it, or delete it.

## Shape

- `subjects/<id>/code/exercises/NN_<topic>.py`, one per lesson (sometimes one per page), numbered like the lessons. A docstring that says what the
  lesson asserts, then numbered sections `# ---- 1. ... ----` that match the Steps of the lesson. `print` what the lesson will show.
- A shared `lab.py` (see `subjects/iceberg/code/lab.py`): a throwaway root folder per exercise, a session factory, helpers that list files. Keep
  the exercises short by moving setup there.
- `verify.py` runs every exercise, checks the pinned versions first, and prints PASS or FAIL with the tail of the output. Update it with every
  exercise. `pyproject.toml` pins the version of what you teach.
- Deterministic numbers: a lesson prints file counts, so make the engine write the same number of files every time (Spark with one core writes
  one file per partition value). Say in the lesson that the number depends on this.

## Windows, WSL and Spark (the owner's machine)

- Anything that makes Hadoop write local files, or that talks to the JVM over sockets, runs in WSL. Exercises call
  `relaunch_in_wsl_if_windows(__file__)` first; `run_wsl.sh` holds the one-time setup as comments (JDK, a venv, the jars) and says why.
- The Spark of the Spark subject is not always the one a library supports. Check **before** planning the lessons what the library publishes
  (Maven Central, PyPI), and pick a version pair that exists. Iceberg 1.12.0 had runtimes for Spark 4.0 and 4.1 only, so its subject runs
  Spark 4.1.3 in its own venv. Say so in the lesson ("Callout note") and in CLAUDE.md.
- Calling WSL from Git Bash: `wsl.exe -e bash -lc '...'` (single quotes; with `-d Ubuntu --` the Windows `PATH` gets expanded and breaks on
  parentheses). A file written to `/tmp` by Git Bash is **not** the `/tmp` of WSL, and a Windows Python started from Git Bash sees `/tmp` as
  `C:\Users\<you>\AppData\Local\Temp`. Put scripts in the repo or in the scratchpad and pass full paths. Pipe Java noise away when you read
  the output: `grep -v -E '^\s+at |WARN|log4j|\[Stage|^Caused by'`.
- `SparkSession.builder` is a **shared** object in PySpark: options of a stopped session leak into the next. Use `SparkSession.Builder()` for
  a fresh one, or configure every catalog you need in one session (a second catalog `hlab` next to `lab`).
- Two engines on one catalog is a strong teaching device (Spark and PyIceberg on one SQLite catalog): each engine's view of the same files
  shows what is in the files and what is in the engine. Look for such a shared meeting point in every subject.
- Timestamps: set `spark.sql.session.timeZone` to UTC when a lesson uses a timestamp literal.
- `pkill` does not exist in Git Bash. To stop a preview server use PowerShell:
  `Get-NetTCPConnection -LocalPort 4399 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`.

## Books and other references the owner has

The owner keeps books outside the repo, as markdown clippings: `E:\Development\Project\personal-project\personal-knowledge\Clippings\book\`
(folders `data-engineer`, `data-governance`, `data-quality`, ...). **At the start of a subject, look there for a book on the topic**
(`ls` the folders, `grep -il` the topic), and when the owner names one, read the chapters your lessons cover before writing. Use it three ways:
as a **source** (tag **book**, chapter and printed page, see below), as the **structure of a figure** (the book's pictures are often the way
the owner already thinks about the topic: copy the layering and the numbered steps into the labs), and as a **check** on your explanation.
The clippings usually contain the captions and the text around a figure but not the picture; say that in `docs/sources.md` and do not claim
to have seen the figure.

Printed page from a clipping: the page headers survive as lines like `29`, `58 Chapter 3: ...` or `Reading Queries ... | 59`. Take the nearest header
above the passage, accept that it can be one page off, and say so in `docs/sources.md`. Write `docs/sources.md` with the path of the clipping, the
page offsets and which figures were described and not seen.

## An exercise that feeds a lab

An exercise can write the data of a lab: `15_under_the_covers.py --write` saves what it read from the files as `site/src/components/labs/iceberg/underCovers.json`, and the lab imports
that file (see `lab-craft.md`, "One picture per operation"). `relaunch_in_wsl_if_windows` passes the extra arguments on to WSL. An exercise that imports a package only the WSL venv has (`fastavro`)
fails on the Windows Python before it can re-launch, so run it with `wsl.exe -d Ubuntu -- bash -lc "cd /mnt/e/.../code && ./run_wsl.sh exercises/NN_x.py --write"`.

## When the owner asks to go deeper on one topic ("เจาะลึก")

On 2026-11-12 the owner asked for copy-on-write against merge-on-read in depth. What worked, so do it without being told:

1. **A sub-page `in-depth.mdx` of the lesson** (same slugs in English, a one-sentence link from the lesson page to it) and a **new exercise** that is run first.
2. **Measure the price before showing the files**: the same change in both options, on a table big enough that the difference is visible (100,000 rows, not 5), printed from the snapshot summary. Keep the
   table in the page and say which column is the point (rows written; bytes of a tiny file include Parquet overhead).
3. **Then the real files, one picture per statement** (see `lab-craft.md`, "One picture per operation"), including the kinds of file the topic adds (here delete files and delete manifests).
4. **Probe the claim that sounds obvious.** "Delete files pile up" was false for Spark (it folds old positions into one new delete file); "compaction removes the delete files" was false (a dangling one stays,
   and an option that is off by default removes it). Each took one extra experiment and became a section. Read the option's default in the source before you write it.
5. **Say what was not run** (equality deletes: Spark SQL does not write them) and give it from the book with chapter and page, tagged as such.
6. `fileview.py` in `subjects/iceberg/code/` reads a table from its files (json, fastavro, pyarrow) for any exercise that feeds a lab: reuse it, extend it for the new file kinds, and name every metadata.json
   in commit order (v1 is the one of CREATE TABLE) so that the names in the pictures match the numbers in the file names.
7. Printed pages from a clipping: a page header is the **top** of its page, so a passage belongs to the nearest header **above** it (an index that lists "34" can mean the section starts there).
