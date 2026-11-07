# Learning Garden

A personal learning garden: a website that holds the lessons for things I want to learn, one subject at a time. Each time I finish a lesson, a plant grows in the garden. Progress is stored in the browser's localStorage, so there is no sign-up.

Read it at https://larmeal.github.io/learning-garden/

The lessons on the site are written in Thai, and every subject also has an English version under `/en/`, with a language switch in the header. Code, comments and tooling docs are in English.

## Subjects

| Subject | Lessons | What it covers |
|---|---|---|
| Apache Spark | 14 | A distributed compute engine, from everyday use to reading Spark's internals |
| Great Expectations | 14 | Writing data quality rules as code and placing them in a real pipeline |
| Data Quality | 13 | Data quality assurance: rules, measurement, monitoring and incident response, independent of any one tool |
| Pytest | 15 | Writing tests you can trust, then how pytest collects, runs and reports them inside |
| Pydantic | 12 | Type hints that validate real data, and how the validation works inside |
| Guitar | 11 | From picking up a guitar for the first time to improvising and transcribing by ear |
| Music theory | 9 | Notes, rhythm, scales, chords and song form, written for people who play but never studied theory |

Each lesson has exercises and a quiz. Some have interactive labs in the page, and the subjects with code have runnable exercises that check the numbers the lessons state.

## Repo layout

```
site/                 the website (Astro, MDX, React)
subjects/<id>/        everything about a subject that is not the website
  code/               runnable exercises, one environment per subject
  docs/               overview and evidence notes
  graphs/             knowledge graphs of source code (some subjects only)
```

Lessons live in `site/src/content/lessons/<id>/`. Each subject's metadata (name, colors, phases) is in `site/src/content/subjects/<id>.json`.

## Run it locally

Node 22.23.4 or newer is required.

```bash
cd site
npm install
npm run dev       # start the site for editing
npm run build     # build, which also catches broken lessons
npm run preview   # serve the built site
npm run sync      # list the lessons where Thai and English are out of step
```

The Python exercises of each subject are their own `uv` project (on Windows some Spark exercises re-launch themselves in WSL, see [run_wsl.sh](subjects/spark/code/run_wsl.sh)). For Data Quality:

```bash
cd subjects/data-quality/code
uv sync
uv run python 01_fit_for_use.py
```

## Tools that only exist in `npm run dev`

None of these are part of a build, so they never reach the published site.

- **View | Edit** on a lesson page: edits that lesson's `.mdx` in the page layout and saves to the file. A save is refused, and the file left as it was, when the text does not compile, the frontmatter does not match the schema, or the page then fails to render.
- **Translation check**: the editor shows which units of a lesson the other language has not followed (`site/tools/translation-sync.mjs`).
- **Notes** (speech bubble in the Astro dev toolbar): click a part of a page or select text, write what is wrong, and the note is saved to `.audit/comments.json` with where it points (the lesson file, the component, the viewport, the theme). The file is git-ignored because the repo is public. Code is in `site/dev-notes/`.

## Deploy

A push to `main` triggers GitHub Actions, which builds `site/` and publishes it to GitHub Pages. See [.github/workflows/pages.yml](.github/workflows/pages.yml).

## Add a subject

1. Create `site/src/content/subjects/<id>.json`, copying `spark.json`.
2. Create `site/src/content/lessons/<id>/` with at least one lesson.
3. Optionally add labs in `site/src/components/labs/<id>/` and code and docs in `subjects/<id>/`.

The `<id>` is part of every URL and of the key that stores progress, so do not rename it once the subject exists.
