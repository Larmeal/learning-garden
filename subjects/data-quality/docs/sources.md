# Sources

The lessons paraphrase these books in Thai and cite the section. No long passage is copied, and the PDFs are not in
this repo. They live in `E:\books\` on the owner's machine. Page numbers are not used because they differ between
editions; section numbers and chapter names are.

| Short name | Book | Used for |
|---|---|---|
| **DMBOK2** | DAMA-DMBOK: Data Management Body of Knowledge, 2nd ed., chapter 13 "Data Quality" (and section 4.4 of the Reference and Master Data chapter) | definitions, dimensions, rules, metrics, SLA, techniques, reporting |
| **DQF** | Data Quality Fundamentals, Barr Moses, Lior Gavish, Molly Vorwerck (O'Reilly) | data downtime, observability pillars, testing tools, monitoring, incident management, SLA/SLI/SLO, ownership, certification |
| **Medallion** | Building Medallion Architectures, Piethein Strengholt | where to check in a pipeline, intrusive and nonintrusive validation, data contracts |
| **DDIA** | Designing Data-Intensive Applications, 2nd ed., Martin Kleppmann and Chris Riccomini, chapter 13 | end-to-end argument, "Trust, but Verify", auditability |

Not used: Container Security (Liz Rice), unrelated.

## Tags used in the lessons

| Tag in the lesson | Meaning |
|---|---|
| หนังสือ: DMBOK2 §x | stated by that section of the book |
| หนังสือ: DQF ch.x | stated by that chapter of the book |
| รัน: `NN_name.py` | produced by running that exercise in `subjects/data-quality/code/` |
| ผู้เขียน | the lesson author's own framing, choice or example, not a standard |

## Cautions about the sources

- DQF was written by founders of a data observability vendor. Survey figures it cites (for example "30 to 40% of
  time") are tagged as the authors' claims. The cost formula is a way of thinking, and its example numbers are not data.
- DMBOK2 says there is no single agreed set of dimensions (section 1.3.3). Lessons teach the DAMA UK six plus integrity
  and reasonability from Table 29, as vocabulary.
- ISO 8000 is mentioned in DMBOK2 section 1.3.5 only as a standard "being developed". It is not taught from the
  standard itself. ISO/IEC 25012 was not found in the parts of the books that were read, so it is not cited.
- "Data contract" is covered by Medallion chapter 12, which itself warns that the term is ambiguous and has no standard
  definition. Lesson 6 follows that caution. The Open Data Contract Standard and Data Contract Specification are
  named in that chapter but their texts were not read.
- The breaking / review / safe classification of schema changes (lesson 6), the three-way reading of a scorecard
  (lesson 10), the condensed RACI table (lesson 10), the thresholds, owners and SLO numbers, and the synthetic
  time series (lesson 7) are the lesson author's. They are labelled as such in each lesson.
- DQF's RACI table (Table 8-1) came out garbled in the text extraction, so it is described but not reproduced.

## What was read

Read in the relevant parts, from text extracted with `pdftotext -layout`:

- DMBOK2 chapter 13: sections 1.2, 1.3.1 to 1.3.5, 2.1 to 2.7 (all), 4.1 to 4.6, 5 (first part); reference and master
  data chapter section 4.4
- DQF: table of contents, preface, chapter 3 (testing, dbt, GX, Deequ, Airflow, circuit breakers), chapter 4 (known and
  unknown unknowns, freshness, distribution, null rate, precision, recall, F-score; the schema and lineage sections were
  only skimmed), chapter 5 (ingestion, five pillars, ROI, SLA/SLI/SLO), chapter 6 (incident management, RCA,
  postmortem, incident commander), chapter 8 (ownership, certification steps 1 to 7; the Toast case study and the
  remaining parts were not read)
- Medallion: chapter 3 Bronze and Silver; chapter 12 "Data Contracts" (all four subsections); chapter 1 and 4 for one
  sentence each about quality by layer
- DDIA: chapter 13 "The end-to-end argument", "Trust, but Verify", "Designing for auditability", "The end-to-end
  argument again"

Not read: DQF chapters 2, 7, 9 and 10 (lineage design, data mesh, case studies, predictions), DQF chapter 4 schema
monitors in detail, DMBOK2 chapters other than the two above, the rest of Medallion, DDIA outside chapter 13.
