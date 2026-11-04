# Learning Garden

This repo is a personal learning garden: one website (`site/`) that grows a plant for every lesson the owner finishes,
plus the code, notes and knowledge graphs that back each subject. Spark was the first subject. It is not the project:
the repo is meant to hold everything the owner wants to learn, one subject at a time.

Lesson text on the website is Thai, and `data-quality` also has an English version (see "Languages"). Code, comments and
tooling docs are English. Do not use the em dash in explanations, docstrings or comments.

In Thai lesson text, keep technical terms and the nouns that match code or table names in English (dimension, rule,
dataset, row, column, order, customer, threshold) instead of coining Thai words. The owner finds that easier to read.
Only `data-quality` has been rewritten this way so far; write new Thai text like it. In Thai headings and page titles,
start every English word with a capital letter (`## Data Contract คืออะไร`, `## Producer-driven และ Consumer-driven`), but
leave file names, identifiers and anything in backticks as they are (`conftest.py`, `pytest.param`). Body text keeps its
normal case.

## Layout

```
site/                              the garden (Astro 7, MDX, React 19)
  src/content/subjects/<id>.json   one file per subject: name, tagline, category, accent colors, phases
  src/content/lessons/<id>/        lessons of that subject (see "Lesson shapes")
  src/components/                  shared pieces only (Plant, Question, Step, Callout, progress hooks, garden scenes)
  src/components/music/            pieces shared by the music subjects (Fretboard, Keyboard, ChordDiagram, audio, step clock)
  src/lib/music.ts                 note spelling, scales, chords, intervals, fretboard maths (pure, no DOM)
  src/components/labs/<id>/        interactive demos that belong to one subject
  src/lib/garden.ts                subject and lesson grouping, ordering, build-time checks
subjects/<id>/                     everything about a subject that is not the website
  code/                            runnable exercises (own project files and environment)
  docs/                            overview and notes
  graphs/                          knowledge graph snapshots, indexes and helper scripts
```

## Languages

Thai is the original language and keeps the original URLs (`/<subject>/<slug>/`). English lives under `/en/`.

- Interface text is in `site/src/i18n.ts` (`ui.th` and `ui.en`). Every React island and `LessonNav`, `Pips` takes a `lang`
  prop (default `th`). Page bodies are shared views in `site/src/views/`, wrapped by `src/pages/` (Thai) and `src/pages/en/`.
- English lessons are in `site/src/content/lessons-en/<subject>/...` (collection `lessonsEn`) with the same slugs, orders
  and `requires` as the Thai ones, so progress keys (`<subject>/<slug>`) are shared between languages.
- English MDX passes `lang="en"` to every `<Question>` and to labs. Labs keep their text per language in a `TEXT`
  object and take a `lang` prop.
- A subject JSON may have an `en` block (name, tagline, category; optional description and phases). A subject with no
  `lessons-en/<id>/` folder is listed on the English home page as "Thai only" and links to its Thai pages.
- The header switch goes to the same page in the other language when it exists, otherwise to that language's home.
- To translate another subject: add `lessons-en/<id>/`, add the `en` block to its JSON, and give its labs a `lang` prop.
  Build fails if `requires` points to a slug that has no English page.

## Links between lessons

Write a reference to another lesson as a Markdown link with a root-relative path, pointing at the heading the sentence is
about when there is one: `[บท 3](/data-quality/profiling/#ดู-frequency-ของค่าใน-column-ที่มีค่าไม่กี่แบบ)`,
`[lesson 3](/en/data-quality/profiling/#...)`, or a sub-page `[the reasonability page](/en/data-quality/dimensions/reasonability/)`.
The fragment is the slug of the heading text (the `id` on the `<h2>` in the built page, lower case, spaces to hyphens, no
punctuation); `LessonPage.astro` opens the card that holds it. Renaming a heading changes its id and silently breaks links to
it, so after renaming one, search the lessons for the old id. A reference to a whole range ("บท 1 ถึง 10") stays a plain
lesson link.
`MdLink.astro` (passed to `<Content components={{ a: MdLink }} />` in `LessonPage.astro`) puts the GitHub Pages base path in
front of paths that start with `/`, so do not add `BASE_PATH` yourself. This works in lesson text only: inside a `<Question>`
prop (`why`, `q`, `options`) or a `<Callout title>` a Markdown link is not rendered, so leave those as plain text. Every
"lesson N" or "บท N" in the data-quality and pytest lessons is linked this way, numbers being the `order` of the main page.

## Add a subject

1. `site/src/content/subjects/<id>.json` (copy `spark.json`; `category` groups it on the home page).
2. `site/src/content/lessons/<id>/` with at least one lesson.
3. Optional: `site/src/components/labs/<id>/` for demos, `subjects/<id>/` for code, docs and graphs.

The subject `id` is part of every URL and every saved progress key (`<subject>/<slug>` in localStorage). Never rename
an existing id. Categories live in the subject JSON, not in folders, for the same reason.

## Lesson shapes

- `lessons/<id>/<slug>.mdx`: a single page.
- `lessons/<id>/<slug>/index.mdx` plus `<child>.mdx`: a lesson with sub-pages. A child with `kind: quiz` is the quiz.
- Main pages need `order`, `phase`, `level`. `requires` lists slugs in the same subject. `stage` is `seed` (outline),
  `sprout` (usable) or `evergreen`. `format: steps` pages are written with `<Step>` cards.
- A broken `requires` or a sub-page without a main page fails the build (`groupsOf` in `garden.ts`).

## Commands

- Site: from `site/`, `astro dev --background`, then `astro dev status|logs|stop`. `npm run build` to check.
- Deploy: the site is published on GitHub Pages by `.github/workflows/pages.yml` on every push to `main`. The owner changes and checks locally first (`npm run build`, `npm run preview` in `site/`), then pushes. The repo is public, so never commit secrets, tokens or personal data. Never push without the owner asking in that turn.
- Python exercises: each subject's `code/` is its own `uv` project. From `subjects/spark/code/`, run `uv sync` once and
  then `uv run python main.py`.
- Music facts: from the repo root, `node subjects/music-theory/code/verify.mts` (Node 22.18 or newer) checks the scale, chord, interval and fretboard facts that the guitar and music-theory lessons state, and every chord box printed in a lesson.
- Per-subject notes (for example `subjects/spark/graphs/RESUME.md`) say how that subject's tooling is resumed.

## Current subjects

- `spark` (lessons on the site, code, docs and a knowledge graph of the Spark v4.2.0 source in `subjects/spark/graphs/`).
- `great-expectations` (14 lessons on the site, each with sub-pages and a quiz, labs in `components/labs/great-expectations/`,
  numbered runnable exercises `01` to `33` in `subjects/great-expectations/code/` pinned to GX 1.24.1, an overview and evidence notes in `docs/`, and a knowledge graph
  of v1.9.3 in `graphs/`). Claims in the lessons are tagged ran/source in `docs/verified-findings.md`. Spark behaviour is
  not verified. `code/make_lab_data.py` regenerates the data of the metric lab; `26`, `30`, `31`, `32` and `33` write the JSON that the registry, support, call-trace, version-diff and graph labs read.
- `guitar` (11 lessons for any level, each with a quiz: an introduction with history, types, a harmonics page with an animated string and a searchable glossary of English terms (`labs/guitar/glossaryData.ts`), practice method, technique, fretboard, chords, rhythm, barre and CAGED, scales, lead techniques, improvisation, ear and songs; labs in `components/labs/guitar/`; overview and backlog in `docs/overview.md`).
- `music-theory` (9 lessons, each with a quiz: notes, rhythm, intervals, major keys, minor and modes, chords, diatonic harmony, beyond the key, melody and form; labs in `components/labs/music-theory/`; `code/verify.mts` checks the facts). The two music subjects link by lesson title, not by URL. Lab sound is Web Audio and was not listened to in a browser when it was written.
- `data-quality` (13 lessons, each with a quiz: assurance basics, dimensions (with eight deep-dive sub-pages, one per dimension), profiling, rule design, checkpoints, agreements and data contracts (with a deep-dive sub-page, `contracts-in-practice`), monitoring, reconciliation, incidents, ownership and scorecards, capstone, then the optional phase E: running a project with the Ten Steps, and data quality inside data governance; labs `DimensionLab`, `ContractLab`, `ThresholdLab` in `components/labs/data-quality/`). Focus is Data Quality Assurance, tool-neutral; it links to `great-expectations` by lesson title. Exercises `01` to `13` in `subjects/data-quality/code/` (own `uv` project: DuckDB, pandas, PyYAML) run on a synthetic dataset from `dqlab.py` with defects planted in fixed numbers, and each exercise asserts that it finds what was planted or that its stated expectation holds; shared modules are `dqrules.py` (rule registry) and `dqcontract.py` (contracts in `contracts/*.yaml`). `13_dimension_pitfalls.py` asserts every number on the dimension deep-dive pages (a few use a tiny made-up table or a modified copy, and say so). `07_monitoring.py --write` regenerates `monitoring.json` for the threshold lab; `node subjects/data-quality/code/verify_monitoring.mts` checks the lab's TypeScript detectors against the Python scores. Plan, source list (books in `E:\books` and the markdown versions of the newer ones in `E:\Development\Project\personal-project\personal-knowledge\Clippings\book`, none in the repo) and `verified-findings.md` are in `docs/`. Every claim in a lesson is tagged book, ran or author. A book tag gives the section number (or chapter number) and the printed page, for example `DMBOK2 หัวข้อ 2.7.1 หน้า 478` in Thai and `DMBOK2 section 2.7.1, page 478` in English; never use the section sign or `ch.` (the owner finds them unreadable). Page offsets to the PDF viewer are in `docs/sources.md`. Available in Thai and English (English in `lessons-en/data-quality/`, labs take `lang`). The pages were built but never looked at in a browser, and the labs were not clicked through.
- `pytest` (8 lessons, each with a quiz: first test, assertions, fixtures, parametrize, markers, isolation with monkeypatch and mock, project setup and choosing what to run, test design with a closing exercise; Thai and English in `lessons/pytest/` and `lessons-en/pytest/`; no labs yet). Runnable code in `subjects/pytest/code/` (own `uv` project: pytest, pytest-cov, pytest-xdist): the code under test is a shopping cart in `src/shop/`, `exercises/NN_*` must pass and `demos/NN_*` fail on purpose. `uv run python verify.py` re-runs everything and checks every number the lessons print (Pytest 9.2.0); update it when you change an exercise. Claims are tagged ran or author in `docs/verified-findings.md`; no book was used. The pages were built but never looked at in a browser.
