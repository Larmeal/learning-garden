# Data Quality: plan

Subject id `data-quality` (permanent, part of every URL and progress key). Focus: Data Quality **Assurance**, the system
that keeps data fit for use over time. Balanced between concepts and hands-on work, for someone who writes SQL and
Python. Tool-neutral: one tool, Great Expectations, has its own subject and is linked by lesson title, not by URL.

Sources are listed in `sources.md`; every claim in a lesson carries a tag (book, ran, author).

## Lessons (all 11 written at stage `sprout`)

| # | Slug | Phase | Main sources | Exercise | Lab |
|---|---|---|---|---|---|
| 1 | `assurance-basics` | A | DMBOK2 1.2, 1.3, 2.1 to 2.7, 4.1, 4.2; DQF ch.1, 5 | `01_fit_for_use.py` | |
| 2 | `dimensions` | A | DMBOK2 1.3.3, Tables 29 and 30, Figure 92 | `02_dimensions.py` | `DimensionLab` |
| 3 | `profiling` | B | DMBOK2 2.3 to 2.5 | `03_profiling.py` | |
| 4 | `rule-design` | B | DMBOK2 2.3, 2.7.1, 4.4, Table 30; DQF ch.3 | `04_rules.py` | |
| 5 | `checkpoints` | B | Medallion ch.1, 3; DMBOK2 2.7.2, Table 31, 4.1; DQF ch.3, 5 | `05_checkpoints.py` | |
| 6 | `agreements` | C | Medallion ch.12 (data contracts); DMBOK2 2.7.4 and 4.4 of the reference and master data chapter; DQF ch.5 | `06_contract.py` | `ContractLab` |
| 7 | `monitoring` | C | DQF ch.4, 5, 6, 8; DMBOK2 4.5 | `07_monitoring.py`, `verify_monitoring.mts` | `ThresholdLab` |
| 8 | `reconciliation` | C | DDIA ch.13 (end-to-end argument, Trust but Verify); DQF ch.3, 5 | `08_reconcile.py` | |
| 9 | `incidents` | D | DQF ch.6; DMBOK2 2.7.3, 4.2, 4.6 | `09_incident.py` | |
| 10 | `ownership-scorecard` | D | DMBOK2 2.6, 2.7.4, 2.7.5; DQF ch.5, 8 | `10_scorecard.py` | |
| 11 | `capstone` | D | all | `11_capstone.py` | |

Each lesson is a `format: steps` page plus a quiz. No sub-pages were needed.

## Exercises

`code/` is its own `uv` project (DuckDB, pandas, PyYAML). Shared modules:

- `dqlab.py` builds customers, orders and payments with defects planted in fixed numbers (`PLANTED`)
- `dqrules.py` is the rule registry (14 rules with owner, threshold, severity, status) and its lint
- `dqcontract.py` reads `contracts/*.yaml`, checks a table against a contract and classifies changes between versions

An exercise passes only when what it finds equals what was planted, or when its stated expectation holds. Results go in
`verified-findings.md`. `07_monitoring.py --write` regenerates `monitoring.json` for the threshold lab, and
`node subjects/data-quality/code/verify_monitoring.mts` checks that the lab's TypeScript detectors give the same scores.

## Status and what is not done

- Everything builds (`npm run build`) and every exercise runs. **No page has been looked at in a browser.** The labs
  were not clicked through and their TSX was not type checked (there is no `tsc` in `site/`).
- The monitoring lab's maths is checked against Python (33 parameter settings). Its look and behaviour are not.
- The extracted book text lives only in a session scratchpad. If the books change or are re-read, extract again with
  `pdftotext -layout`.
- Not covered on purpose: reasonability as its own exercise, privacy and PII, data quality for machine learning,
  streaming in depth, any tool other than a mention of dbt, GX, Deequ and Airflow.
- Possible next work: a sub-page on schema and lineage monitors (DQF ch.4 and 7), a lesson on data as a product and
  data mesh (DQF ch.8 and 9), and evergreen passes that replace `author` claims with sources where they exist.
