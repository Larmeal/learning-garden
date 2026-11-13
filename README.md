# Learning Garden

A personal learning garden: a website that holds the lessons for things I want to learn, one subject at a time. Each time I finish a lesson, a plant grows in the garden. Progress is stored in the browser's localStorage, so there is no sign-up.

Read it at https://larmeal.github.io/learning-garden/

The lessons on the site are written in Thai, and every subject also has an English version under `/en/`, with a language switch in the header. Code, comments and tooling docs are in English.

## Subjects

| Subject | Lessons | What it covers |
|---|---|---|
| Apache Spark | 14 | A distributed compute engine, from everyday use to reading Spark's internals |
| Apache Iceberg | 14 | An open table format: how a table is laid out in files, how writes commit, and how engines read it |
| Great Expectations | 14 | Writing data quality rules as code and placing them in a real pipeline |
| Data Quality | 13 | Data quality assurance: rules, measurement, monitoring and incident response, independent of any one tool |
| Pytest | 15 | Writing tests you can trust, then how pytest collects, runs and reports them inside |
| Pydantic | 12 | Type hints that validate real data, and how the validation works inside |
| Guitar | 11 | From picking up a guitar for the first time to improvising and transcribing by ear |
| Music theory | 9 | Notes, rhythm, scales, chords and song form, written for people who play but never studied theory |
| Singing | 10 | How the voice works and how to train it, with labs that synthesize the voice in the browser |

Each lesson has a quiz. Some have interactive labs in the page, and the subjects with code have runnable exercises that check the numbers the lessons state.

## Repo layout

```
site/                 the website (Astro, MDX, React)
subjects/<id>/        everything about a subject that is not the website
  code/               runnable exercises, one environment per subject
  docs/               overview and evidence notes
  graphs/             knowledge graphs of source code (some subjects only)
.github/workflows/    the build and deploy to GitHub Pages
```

Lessons live in `site/src/content/lessons/<id>/` (Thai) and `site/src/content/lessons-en/<id>/` (English). Each subject's metadata (name, colors, phases) is in `site/src/content/subjects/<id>.json`.

## Run the website on your own computer

You need **Node.js 22.23.4 or newer** (the deploy workflow uses Node 24) and npm. Nothing else: no database, no account, no environment variables.

```bash
git clone https://github.com/Larmeal/learning-garden.git
cd learning-garden/site
npm ci
npm run dev
```

Then open http://localhost:4321/. The first page can take a few seconds to compile.

This works the same on Windows (PowerShell or Git Bash), macOS and Linux. If port 4321 is taken, run `npm run dev -- --port 4400`.

| Command (from `site/`) | What it does |
|---|---|
| `npm run dev` | Start the site for editing, with the dev tools described below |
| `npm run build` | Build the static site into `site/dist/`. It fails on a broken lesson, a bad `requires` or a missing English page, so it doubles as a check |
| `npm run preview` | Serve the built site (run `npm run build` first) |
| `npm run check:refs` | Fail when a lesson mentions another lesson without linking to it, or links to a page or heading that does not exist |
| `npm run sync` | List the lessons where the Thai and English text are out of step (`npm run sync -- --check` exits with an error if any are) |

The deploy workflow also runs the music facts check, from the repo root: `node subjects/music-theory/code/verify.mts` (Node 22.18 or newer). `node subjects/singing/code/verify.mts` does the same for the numbers on the singing pages.

Your progress (which lessons you finished, which questions you answered) is kept in your browser's localStorage, so it stays on that browser and does not follow you to another computer.

### Publish your own copy

Fork the repo, then in the fork open Settings > Pages and set Source to "GitHub Actions". Every push to `main` runs [.github/workflows/pages.yml](.github/workflows/pages.yml), which builds the site and publishes it at `https://<your-name>.github.io/<repo>/`. The workflow sets `SITE_URL` and `BASE_PATH` for you. To build for another address by hand, set the same two variables:

```bash
SITE_URL=https://example.com BASE_PATH=/garden npm run build      # PowerShell: $env:SITE_URL=...; $env:BASE_PATH=...
```

## Run the exercises

The lessons state numbers (row counts, query plans, file layouts, error messages), and each subject with code has exercises that reproduce them and `assert` that the numbers still hold. Every subject's `code/` folder is its own [uv](https://docs.astral.sh/uv/) project with a lock file. Install uv once; it also downloads the Python it needs (3.12 or newer), so you do not have to install Python yourself.

| Subject | What you need | Run (from the `code/` folder) |
|---|---|---|
| Data Quality | uv | `uv sync`, then `uv run python 01_fit_for_use.py` |
| Great Expectations | uv | `uv sync`, then `uv run python 01_first_validation.py` |
| Pydantic | uv | `uv sync`, then `uv run python verify.py` |
| Pytest | uv | `uv sync`, then `uv run python verify.py` |
| Apache Spark | uv, **JDK 17 or 21**, Linux, macOS or WSL | `uv sync`, then `uv run python exercises/01_architecture.py` or `uv run python verify.py` |
| Apache Iceberg | uv, **JDK 17 or 21**, Linux, macOS or WSL | `bash setup.sh` once, then `uv run python exercises/01_first_table.py` or `uv run python verify.py` |

Notes:

- Data Quality, Great Expectations, Pydantic and Pytest run on Windows, macOS and Linux. For Data Quality, `node verify_monitoring.mts` (Node 22.18 or newer) checks that the TypeScript detectors of the threshold lab match the Python scores.
- `verify.py` runs every exercise of the subject and reports which ones pass. Pydantic and Pytest take about a minute, Spark about 20 minutes, Iceberg about 6. Give it numbers to run only some: `uv run python verify.py 01 06`.
- **Spark and Iceberg on Windows:** run them inside WSL (Ubuntu), where they behave like Linux. Install a JDK and uv inside WSL, clone the repo inside the WSL file system (not under `/mnt/c`, which is slow), and follow the Linux steps. If you start them from Windows instead, the exercises try to re-launch themselves in WSL through `run_wsl.sh`, a script written for the author's machine (a JDK in `~/spark-lab`, a distribution named Ubuntu), so you will most likely want to skip it.
- **Iceberg:** `setup.sh` checks for Java and uv, downloads the two jars the exercises load into Spark (the Iceberg runtime and SQLite JDBC, about 40 MB) to `~/iceberg-lab/jars`, and runs `uv sync`. Set `ICEBERG_LAB_JARS` to keep the jars somewhere else. Iceberg 1.12.0 has no runtime for Spark 4.2 yet, so this subject pins PySpark 4.1.3 while the Spark subject uses 4.2.0. Do not share one virtual environment between them.
- The exercises write throwaway files (`spark-warehouse/`, `/tmp/iceberg-lab/`, `metastore_db/`) that are git-ignored.
- The Great Expectations exercises print their results and do not assert them; the others assert. `docs/verified-findings.md` in each subject says which claim of a lesson was run, which was read from source and which is the author's opinion.

### What is not in the repo

The lessons for Data Quality and Singing cite books, and the lessons on pytest, Pydantic and Iceberg cite functions from source code. The books and the source checkouts are kept outside the repo, so you cannot re-open those citations yourself. For Data Quality, Singing and Iceberg, `docs/sources.md` lists what was used; for the others, `docs/verified-findings.md` tags each claim as ran, source or author. The knowledge graphs of the source code (`subjects/*/graphs/`) are in the repo.

## Tools that only exist in `npm run dev`

None of these are part of a build, so they never reach the published site.

- **View | Edit** on a lesson page: edits that lesson's `.mdx` in the page layout and saves to the file. A save is refused, and the file left as it was, when the text does not compile, the frontmatter does not match the schema, or the page then fails to render. It only answers to `localhost`.
- **Translation check**: the editor shows which units of a lesson the other language has not followed (`site/tools/translation-sync.mjs`).
- **Notes** (speech bubble in the Astro dev toolbar): click a part of a page or select text, write what is wrong, and the note is saved to `.audit/comments.json` with where it points (the lesson file, the component, the viewport, the theme). The folder is created on the first note and is git-ignored because the repo is public. Code is in `site/dev-notes/`.

## Deploy

A push to `main` triggers GitHub Actions, which checks the music facts and the references between lessons, builds `site/` and publishes it to GitHub Pages. See [.github/workflows/pages.yml](.github/workflows/pages.yml).

## Add a subject

1. Create `site/src/content/subjects/<id>.json`, copying `spark.json`.
2. Create `site/src/content/lessons/<id>/` with at least one lesson.
3. Optionally add labs in `site/src/components/labs/<id>/` and code and docs in `subjects/<id>/`.

The `<id>` is part of every URL and of the key that stores progress, so do not rename it once the subject exists. Every lesson needs an English twin in `site/src/content/lessons-en/<id>/` with the same slug, and every mention of another lesson must be a link; `npm run build` and `npm run check:refs` tell you when something is missing.
