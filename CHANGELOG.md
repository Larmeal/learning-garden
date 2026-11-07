# Changelog

Notable changes to the learning garden, newest first. Dates are when the change was made.

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
