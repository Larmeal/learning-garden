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
- Python exercises: each subject's `code/` is its own `uv` project. From `subjects/spark/code/`, run `uv sync` once and
  then `uv run python main.py`.
- Per-subject notes (for example `subjects/spark/graphs/RESUME.md`) say how that subject's tooling is resumed.

## Current subjects

- `spark` (lessons on the site, code, docs and a knowledge graph of the Spark v4.2.0 source in `subjects/spark/graphs/`).
- `great-expectations` (14 lessons on the site with labs in `components/labs/great-expectations/`, runnable exercises in
  `subjects/great-expectations/code/` pinned to GX 1.24.1, an overview and evidence notes in `docs/`, and a knowledge graph
  of v1.9.3 in `graphs/`). Claims in the lessons are tagged ran/source in `docs/verified-findings.md`. Spark behaviour is
  not verified. `code/make_lab_data.py` regenerates the data of the metric lab.
