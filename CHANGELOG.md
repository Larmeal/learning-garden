# Changelog

Notable changes to the learning garden, newest first. Dates are when the change was made.

## 2026-11-13

### Changed
- Iceberg: the feedback texts (`why`) of 80 quiz questions and the Thai strings of its eight labs were rewritten in the owner's voice with `/thaihumanize`: whole clauses with connectors, "เรา" instead of a bare "แบบฝึกวัดได้...", and no clipped noun phrases. Only the wording moved, so every number, error message and link is the same and the English pages are recorded as in step. The labs were audited again in headless Edge (40 labs on 14 pages, no overlap, no idle control, no sideways scroll).

## 2026-11-12

### Added
- A new subject, `iceberg` (Thai and English): 14 lessons, each with a quiz. They cover what Iceberg is, the files inside a table, schema and partitioning, writes and commits (including two writers that collide), reads and scan planning, row-level changes (copy-on-write, merge-on-read, deletion vectors), schema and partition evolution, time travel with branches, tags and write-audit-publish, catalogs, table maintenance, migrating existing data, streaming and incremental reads, format versions with views and statistics, and a capstone. Everything the lessons print comes from exercises `01` to `14` in `subjects/iceberg/code/` that run Spark 4.1.3 with Iceberg 1.12.0 and PyIceberg 0.12.0 in WSL, on one catalog shared by both engines (Iceberg `JdbcCatalog` and PyIceberg `SqlCatalog` on the same SQLite file). There is no Iceberg runtime for Spark 4.2 yet, which is why this subject does not use the Spark 4.2.0 of the Spark subject. The knowledge graph of Iceberg 1.12.0 (`api` and `core`) is in `subjects/iceberg/graphs/`. Seven labs for it in `components/labs/iceberg/` (the three layers of a table growing commit by commit, the seven steps of a write, two writers racing for the catalog pointer, a read going down the layers, which files a filter skips, copy-on-write against merge-on-read, and snapshots with main, a tag and a branch), laid out after the figures that the book *Apache Iceberg: The Definitive Guide* describes, with text of 14 to 18 units or more, a legend of the three states (new, in use, skipped), plain-language names next to the technical ones, and a one-line banner in the picture for each step. No `in-depth` pages yet, and a REST catalog could not be run. Notes, sources and findings are in `subjects/iceberg/docs/`.
- Iceberg lesson 2 has a sub-page, "Under the covers" (Thai and English), after the explanation in the Dremio guide *Apache Iceberg: An Architectural Look Under the Covers*. It follows one table through `CREATE TABLE`, two `INSERT`s, `MERGE INTO`, a `SELECT` with a filter, time travel and compaction. Each statement has its own picture (`UnderCoversLab`) that walks through numbered steps, draws the files of the catalog, metadata and data layers (new, reused, skipped), and shows the real content of any file you click (the `metadata.json` fields, the manifest list rows, the manifest entries with their statuses and bounds, the rows of a data file). Those contents are read from disk by `exercises/15_under_the_covers.py --write`, so no number in the pictures is invented. The page ends with a table of how many files each statement writes.
- Iceberg lesson 6 has a sub-page, "Copy-on-write and merge-on-read in depth" (Thai and English). It prices one changed row in both modes on a table of 100,000 rows (20,000 rows rewritten against 1 row plus a delete file), then shows six pictures built from the real files (`UnderCoversLab` now also draws delete files and delete manifests): a copy-on-write DELETE, a merge-on-read DELETE with the content of the position delete file, an UPDATE (Spark folds the old positions into one new delete file, so a data file needs one delete file at most), a SELECT that filters with the delete file, a compaction that leaves a dangling delete file behind, and the clean-up with `remove-dangling-deletes`. It also covers a different mode per statement and how to choose, with the comparison table of the book. Equality deletes are described from the book and were not run. New exercise `16_cow_mor_in_depth.py`.

## 2026-11-10

### Changed
- Data Quality, lesson 2 (Dimensions) and its eight deep-dive pages (Thai and English) are rewritten to be easier to picture. Each page opens with real rows from the dataset and one everyday picture that it keeps using, explains each SQL query line by line, and gives every common misreading its own Step instead of a bold-label form. Citations come once at the end of a paragraph. The headings that other lessons link to are unchanged, except on the Reasonability page, whose misreading headings were renamed and the two capstone links updated.
- `13_dimension_pitfalls.py` now also asserts the numbers of the new examples (the bad-day copy for Reasonability, the data-set-level completeness copy, the tolerance table). The prose was not read through by a person yet, and the labs and the light theme were not clicked again.

## 2026-11-09

### Added
- A new subject, `singing` (Thai only): ten lessons on how the singing voice works and how to practise, each with a quiz, plus in-depth pages for the vocal folds and for resonance. Written from two books (Davids and LaTour, *Vocal Technique*; Titze, *Principles of Voice Production*), cited by printed page.
- Labs for it in `components/labs/singing/`: the anatomy of head and torso, a breathing cycle, the vocal folds in slow motion (top view, cross-section, airflow, harmonics), the three onsets, registers and voice ranges, a vocal tract with source, filter and output graphs, a one-pipe tube, a vowel chart, vowel modification for a soprano, vibrato, a microphone pitch mirror and a warm-up player that plays guide notes.
- `site/src/lib/voice.ts`, `tract.ts`, `pitch.ts`: a small voice synthesizer (the sounds are made in the browser, not recorded), a map from mouth shape to formants and a pitch detector. `node subjects/singing/code/verify.mts` checks the numbers that the lessons state about them (191 checks). Notes, sources and what was not checked are in `subjects/singing/docs/`.
- `tools/lesson-refs.mjs` treats a number after "Davids", "LaTour" or "Titze" as a book chapter, and knows the `singing` subject.
- Guitar: a page "Anatomy: ส่วนประกอบของกีต้าร์โปร่ง" (Thai and English) in lesson 0 with an animated acoustic guitar (`AcousticAnatomy`): press a part or walk through them to read what it is and what it does next to the drawing, look through the body at the bracing, truss rod and blocks, and follow a plucked string into the room in five steps. The quiz has three more questions.
- Glossary: eight more parts (heel, rosette, binding, bracing, bridge pin, soundboard, bout, end pin), a "Fret Buzz" entry, and a "See also" row of links between related terms (for example Action to Fret Buzz, Saddle, Truss Rod and Setup). Terms are shown with a capital letter on every word.

### Changed
- The register lab of the singing subject now draws Chest, Mix, Head and Chest belt side by side on one clock: the folds in cross-section, one cycle of the airflow with the closed part shaded and a moving dot, and the first ten harmonics (H2 and H5 below H1 in dB). A speed switch slows or stops the drawing.
- The vocal tract lab glides the tongue, jaw, lips and graphs to a new pose instead of jumping, shades the band around each formant on the filter and output graphs, and has a three-line guide to reading the graphs.
- The anatomy lab "เครื่องดนตรีที่เรียกว่าเสียงร้อง" (and the head and torso drawing it shares with the breathing and vocal tract labs) looks more finished: hair, eye, ear and rounded teeth on the head, shoulders on the trunk that fades out at the bottom, three coloured panels for power, source and filter that light up with the group buttons, a dot on every part, and a pulsing ring with the name of the part you chose. The air path is drawn as a pale tube with white dots.
- The lesson side navigation (`.lesson-aside`) reserves room for its scrollbar (`scrollbar-gutter: stable`, no sideways scroll). Before, the scrollbar could appear and disappear while the pointer was over a long title, which changed the width, wrapped the title onto a second line and made the list shake.
- The Action entry of the glossary now explains both sides: a low action is easy to press but can give Fret Buzz, a high action is clear but needs more force.

## 2026-11-08

### Added
- Spark: a page "Spark คืออะไร ประวัติ และปัญหาที่มันแก้" ("What Spark is, its history, and the problems it solves", Thai and English,
  `foundations/overview`) in lesson 0: what Spark is, Google MapReduce and Hadoop, where MapReduce got stuck (reusing data between jobs),
  the RDD idea (lineage), what the paper's speedups depend on (first iteration against later ones, the 2014 sort that ran on disk), a
  timeline from 2009 to 4.2 and where this path answers each problem. Every fact links to its source (papers, Apache release pages,
  Databricks blog); nothing on the page was run. Lesson 0 points to it from the top.
- Spark overview page: the timeline is an interactive lab (`SparkTimelineLab`): the line fills as you move down it, every period opens a card
  with what happened, where this path covers it and the source, and a play button walks through the periods. Thai and English.
- The Thai text of that page was rewritten after the owner's own edits to the first section (see "Thai prose" in `claude.md`).
- Links between lessons point at the heading the sentence is about, not only at the lesson (about 420 links in each language, chosen
  one by one; where no heading is clearly the one the link stays on the lesson). Thai and English point at the same heading.
- `npm run check:refs` also fails on a link to a heading that no longer exists (ids made with `github-slugger` the way the build
  makes them; checked against all 506 pages of the built site), and `node tools/lesson-refs.mjs --backlinks <page or page#heading>`
  lists everything that links to a page or heading, so a heading is not renamed blind. `--graph` prints every link as JSON.
- The dev editor (View | Edit) lists, above the text, every link to the lesson page being edited and to its headings.
- References to pages of another subject by title (the guitar and music-theory lessons name each other, Data Quality names the
  Great Expectations lesson) and page names written without quotes ("the page on data contracts in practice") are links too.
- `site/tools/lesson-refs.mjs` (`npm run check:refs`, also a step of the deploy workflow): every mention of another lesson must be a
  link. It finds "บทที่ 5", "บท 5", "lesson 5", "บทถัดไป", "the next lesson", a page named by its title and "lesson 5, page
  \"Title\"", links them with `--fix`, and fails on a mention that is not linked and on a link that points at no page. A number after
  a book name in Data Quality ("Ten Steps บทที่ 3 หน้า 42") is a book chapter and is left alone.
- The `q` and `why` of a `<Question>` and the `title` of a `<Callout>` render `[text](/path/)` links (`src/lib/inline-links.ts`). The
  key under which a question's answer is stored is the text without the link, so saved answers still match.

### Fixed
- Links to the wrong lesson: in music-theory the text counted lessons from 1 while the pages are numbered from 0, so six references
  now say the number the page shows and point at the right lesson (for example slash chords are in lesson 5, chords). Three
  Great Expectations references to a lesson of the Spark path pointed at a Great Expectations lesson, and "the next lesson" in the
  guitar fretboard lesson pointed at open chords where it means barre chords.

### Changed
- About 440 mentions of other lessons in the Thai and English lessons of every subject were plain text and are now links, and the
  four frontmatter summaries that named lesson numbers say "the earlier lessons".
- Thai and English: link-only differences were marked as in step (`npm run sync -- --accept`).
- Checked with the impeccable detector (`npx impeccable detect <url>`, run from outside the repo, nothing installed) and by eye on
  desktop, phone and dark mode. The detector no longer reports low contrast, skipped headings or undersized text on the pages
  it was run on.
- Dark mode: the gold marker behind the highlighted word of the home title is weaker (`--hl`), so light text on it is readable.
- Headings: the "pages in this lesson", "on this page" and lesson list blocks and the phase and plant titles of a subject page are
  `<h2>` instead of `<h4>` or `<h3>`, so no level is skipped. Their look is unchanged.
- Text of 10.5px (tile tags, page tags, fretboard labels) is 11px. The numbers under the plants of the subject scene are larger,
  and hidden on a phone where the tiles show them.
- Home page: the footer of each subject card sits at the bottom and the taglines reserve two lines, so the plant beds and buttons
  line up across a row.
- Tables in lessons on a phone: inline code in a cell (`spark://host:7077`) is no longer broken at every letter, which had made
  that column one letter wide and the rows hundreds of pixels tall. Cells and text are tighter, and a table wider than the screen
  scrolls sideways with a soft shadow on the side that has more.
- Home page: each subject card has a ledge and a plant bed tinted with that subject's own accent (the lighter variant in dark
  mode), the hover ledge uses it too, and tagline text uses `text-wrap: pretty` so a single word is not left on the last line.
- Phone: the site name no longer wraps in the header, lesson tiles are two to a row, the bottom bar of the subject page stacks its
  title above the two buttons instead of squeezing the title, and diagrams that scroll sideways show a soft shadow on the side that
  has more.

## 2026-11-07

### Added
- Thai and English lessons are tracked together. `site/tools/translation-sync.mjs` cuts every lesson page into units (the title and
  summary, then one unit per `<Step>`, or per `##` section on a page without cards) and keeps the hash and edit time of both
  languages in `site/translation-sync.json`. An edit that the other language did not follow is reported. Run `npm run sync` from
  `site/` to update the file and list what is behind, `npm run sync -- --check` to only check (exit code 1 when something is
  behind), or `npm run sync -- --accept <lesson key> [unit numbers]` to say that two versions agree.
- The dev editor (`astro dev` only) shows the result of that check: a warning panel with the units that are behind, a dot on the
  Edit button, a button that copies what has to be translated, a link to the other language, and a button to mark a page as in step.

- A "Notes" app in the Astro dev toolbar (`astro dev` only, code in `site/dev-notes/`). In comment mode a click on an element, a
  right click or a drag over text opens a small form (category and text); the arrow keys change which level is picked. The note is
  saved to `.audit/comments.json` (git-ignored, the repo is public) with the quoted text or the element path, the component and
  lesson file, the viewport, the theme, the language and the step. Saved notes show as numbered badges and highlights, in a panel
  per page, with replies, Resolve and delete. The file is read again when the window gets focus, so replies written into it show
  up. It is wired in `astro.config.mjs` as the `gardenNotes()` integration and does nothing in a build.

### Changed
- README: lists all seven subjects with their lesson counts, says that every subject has an English version, and describes the
  dev-only tools.
- The dev editor now replaces only the lesson text, in the same column as the page, and grows with its text, so the header, the
  lesson list and the title stay where they were. In step-by-step mode it uses the long layout while editing.
- Spark `FormatLab` is redone: pick the columns a query needs and see CSV (stored row by row) and Parquet (stored column by column)
  side by side, with every cell marked as read and used, read but thrown away, or not read. A play button reads both files cell by
  cell at the same speed.

### Fixed
- Spark labs where text or dots covered each other: `RolesFlowLab` (merge label over the group title), `YarnAllocLab` (container
  marks over the heading), `AqeFlowLab` (dots crossing the executor titles), `ShuffleWriterLab` (dots over the file labels and
  stacked on each other), `WorkerReuseLab` (fork lines through words, clipped daemon caption), `ClusterLaunchLab` (two step numbers
  on the same spot), `StragglerLab` (time needle label close to the caption). `LazyLab`: the cache checkbox label wraps as a sentence.

## 2026-11-06

### Added
- A dev-only View | Edit switch on lesson pages (`astro dev` only, never in a build). Edit shows the MDX source of the page and saves
  it to the file. View is refused, and the file is left as it was, when the text does not compile, when the frontmatter does not
  match the schema or `requires` points to a missing lesson, or when the page then fails to render.

### Changed
- The step-by-step switch moved to the header. Spark `ArchitectureLab` and `PipelineStagesLab` were replaced by tables, and the
  phase pills of the optimizer lab were restyled so that every pill has the same size.
- English text says "lesson" instead of "chapter" in the Spark labs and lessons. Three diagram labels of the Great Expectations
  lessons were shortened so that they fit on a phone.

## 2026-11-05

### Added
- English versions of the `spark`, `great-expectations`, `guitar` and `music-theory` lessons, and bilingual labs (every lab takes a
  `lang` prop).
- Spark: cluster manager sub-pages (standalone, YARN, Kubernetes), exercises `06b` and `11b`, and twenty-four animated labs on a
  shared step player.
