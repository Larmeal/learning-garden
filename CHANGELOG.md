# Changelog

Notable changes to the learning garden, newest first. Dates are when the change was made.

## 2026-11-08

### Added
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
