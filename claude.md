# Learning Garden

This repo is a personal learning garden: one website (`site/`) that grows a plant for every lesson the owner finishes,
plus the code, notes and knowledge graphs that back each subject. Spark was the first subject. It is not the project:
the repo is meant to hold everything the owner wants to learn, one subject at a time.

Lesson text on the website is Thai. Code, comments and tooling docs are English. Do not use the em dash in
explanations, docstrings or comments.

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
