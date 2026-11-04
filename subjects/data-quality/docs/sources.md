# Sources

The lessons paraphrase these books in Thai and English and cite the section number (or chapter number) plus the page. No long passage is copied, and the PDFs are not in this repo. They live in `E:\books\` on the owner's machine.

| Short name | Book | Used for |
|---|---|---|
| **DMBOK2** | DAMA-DMBOK: Data Management Body of Knowledge, 2nd ed., chapter 13 "Data Quality" (and section 4.4 of the Reference and Master Data chapter) | definitions, dimensions, rules, metrics, SLA, techniques, reporting |
| **DQF** | Data Quality Fundamentals, Barr Moses, Lior Gavish, Molly Vorwerck (O'Reilly) | data downtime, observability pillars, testing tools, monitoring, incident management, SLA/SLI/SLO, ownership, certification |
| **Medallion** | Building Medallion Architectures, Piethein Strengholt | where to check in a pipeline, intrusive and nonintrusive validation, data contracts |
| **DDIA** | Designing Data-Intensive Applications, 2nd ed., Martin Kleppmann and Chris Riccomini, chapter 13 | end-to-end argument, "Trust, but Verify", auditability |
| **Contracts** | Driving Data Quality with Data Contracts, Andrew Jones (Packt, 2023) | what a data contract is, producer ownership, schema evolution, where to enforce checks |
| **Ten Steps** | Executing Data Quality Projects, 2nd ed., Danette McGilvray (Morgan Kaufmann) | running a data quality project: business need, dimensions to assess, business impact, root cause, improvement, communication |
| **Governance** | Data Governance: The Definitive Guide, Evren Eryurek, Uri Gilad, Valliappa Lakshmanan and others (O'Reilly) | roles, data classes and policies, quality as part of governance, quality for machine learning |
| **FoDE** | Fundamentals of Data Engineering, Joe Reis and Matt Housley (O'Reilly) | data quality and accountability across the data engineering lifecycle, DataOps |

Not used: Container Security (Liz Rice), unrelated.

## Tags used in the lessons

| Tag in the lesson | Meaning |
|---|---|
| หนังสือ: DMBOK2 หัวข้อ 2.1 หน้า 473 ถึง 474 | stated by that section of the book, on those pages (English: `section 2.1, pages 473 to 474`) |
| หนังสือ: DQF บทที่ 5 หน้า 133 ถึง 135 | stated by that chapter of the book, on those pages (English: `chapter 5, pages 133 to 135`). DQF, Medallion and DDIA have no numbered sections, so the chapter number and the pages of the relevant part are given |
| รัน: `NN_name.py` | produced by running that exercise in `subjects/data-quality/code/` |
| ผู้เขียน | the lesson author's own framing, choice or example, not a standard |

## Cautions about the sources

- DQF was written by founders of a data observability vendor. Survey figures it cites (for example "30 to 40% of
  time") are tagged as the authors' claims. The cost formula is a way of thinking, and its example numbers are not data.
- DMBOK2 says there is no single agreed set of dimensions (section 1.3.3). Lessons teach the DAMA UK six plus integrity
  and reasonability from Table 29, as vocabulary. Table 29 runs over two pages: accuracy, completeness and consistency are on
  page 458, integrity, reasonability, timeliness, uniqueness and validity on page 459 (checked with `pdftotext`, PDF pages
  462 and 463). The DAMA UK six definitions are on page 457. The markdown copy of DMBOK2 stops before chapter 13, so read
  these from the PDF.
- ISO 8000 is mentioned in DMBOK2 section 1.3.5 only as a standard "being developed". It is not taught from the
  standard itself. ISO/IEC 25012 was not found in the parts of the books that were read, so it is not cited.
- "Data contract" is covered by Medallion chapter 12, which itself warns that the term is ambiguous and has no standard
  definition. Lesson 6 follows that caution. The Open Data Contract Standard and Data Contract Specification are
  named in that chapter but their texts were not read.
- The breaking / review / safe classification of schema changes (lesson 6), the three-way reading of a scorecard
  (lesson 10), the condensed RACI table (lesson 10), the thresholds, owners and SLO numbers, and the synthetic
  time series (lesson 7) are the lesson author's. They are labelled as such in each lesson.
- Contracts was written by an engineer who introduced data contracts at GoCardless (a fintech) and is arguing for the
  approach. Its sample code is for a specific stack (BigQuery, Pulumi, Confluent schema registry). The lessons take the
  ideas, not the tools. The industry survey figures it quotes in chapter 1 are not used.
- Ten Steps is a methodology from a consultant. Its worked examples are the author's client stories. The lessons use
  the structure of the method and its definitions, and say where an example is the book's.
- Governance and FoDE are used for short passages only (data quality in governance, roles and data classes, data
  accountability, DataOps). Their chapter 5 and chapter 2 numbers on the cost of bad data come from other sources and
  are not repeated.
- The text of the four newer books was read from markdown conversions kept outside the repo, not from the PDFs, and the
  markdown has no page markers. Pages for these books come from each book's table of contents and are given as the page
  range of the section or chapter. Only Contracts and Ten Steps could be matched against a PDF.
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

- Contracts: chapters 1 and 2 (all), chapter 4 (assigning responsibility), chapter 6 (evolving schemas, migrating
  consumers, governance and controls), chapter 10 (monitoring and enforcing). Chapters 3, 5, 7, 8 and 9 and the publishing
  patterns of chapter 10 were skimmed through their headings only.
- Ten Steps: also the dimension steps 3.3 to 3.7 (Data Integrity Fundamentals including the validity and referential integrity rows of Table 4.3.5, the accuracy decision flow, uniqueness terms, the consistency and timeliness descriptions), read for the dimension deep-dive pages. Page ranges are the table of contents ones: 3.3 pages 128 to 135, 3.4 pages 135 to 140, 3.5 pages 140 to 146, 3.6 pages 146 to 148, 3.7 pages 148 to 151.
- Ten Steps: chapter 3 (information life cycle, dimensions table, business impact techniques table), the step summary
  tables of steps 1 to 6, 8 and 9, the benefit vs. cost matrix, the root cause categories, and the communication notes
  of steps 1 and 5. The detailed instructions of each substep were not read.
- Governance: chapter 5 (data quality, scorecard, prioritization, annotation, profiling), chapter 2 (data classes and
  policies) and chapter 3 (the table of hats).
- FoDE: chapter 2, data accountability and data quality (pages 54 to 56) and the start of the DataOps section.

Not read: DQF chapters 2, 7, 9 and 10 (lineage design, data mesh, case studies, predictions), DQF chapter 4 schema
monitors in detail, DMBOK2 chapters other than the two above, the rest of Medallion, DDIA outside chapter 13.

## Page numbers

Pages are the numbers printed on the book pages, not the page counter of the PDF viewer. To open a page in the PDF
viewer, add the offset of the book (the viewer's page counter is the printed page plus the offset):

| Book | Offset | Example |
|---|---|---|
| DMBOK2 | +4 | printed page 473 is PDF page 477 |
| DQF | +20 | printed page 133 is PDF page 153 |
| Medallion | +22 | printed page 329 is PDF page 351 |
| DDIA | +24 | printed page 575 is PDF page 599 |
| Contracts | +17 | printed page 22 is PDF page 39 |
| Ten Steps | +19 | printed page 168 is PDF page 187 |

Governance and FoDE: their PDFs are not in `E:\books`, so no offset was checked. Their pages are the numbers printed
in the book's own table of contents.

A range such as "pages 473 to 474" covers the whole section, so the passage can be anywhere in it. The ranges for DQF,
Medallion and DDIA come from the book's table of contents and from searching the text; they point at the part of the
chapter that holds the claim, not at one line.

