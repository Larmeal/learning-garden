# Verified findings

Claims the lessons make that were checked, and how. `ran` means an exercise in `../code/` produced the number and
asserts it against the planted count. `book` means the cited section says it (read in the extracted text of the PDF,
not copied). `author` means a choice or framing of the lesson author.

All `ran` results use `dqlab.py` (seed 20261101, as-of 2026-11-01 08:00, DuckDB 2.0.0, pandas 3.1.0). Run from
`subjects/data-quality/code/` with `uv sync` once, then `uv run python <file>`.

## Lesson 1, assurance-basics

| Claim | Status | Evidence |
|---|---|---|
| 445 of 500 customers have a usable email (89.0%) | ran | `01_fit_for_use.py`, equals 500 - 40 null - 15 malformed |
| 2,498 of 2,533 non-cancelled orders match the payment system (98.6%) | ran | `01_fit_for_use.py`, 35 mismatches planted |
| (30 + 6) h x 300 = 10,800 | ran | arithmetic only, inputs are made up |
| Quality is fitness for the consumer's purposes | book | DMBOK2 1.3.1 |
| 98% usable email as a target | book | DMBOK2 1.3.3 (example) |
| 99.9% bar for finance | author | invented for the example |
| Ten principles, critical data list | book | DMBOK2 1.2, 1.3.2 |
| Seven activities of DQ management | book | DMBOK2 2.1 to 2.7 |
| Assessment / Control / Assurance split | author | books use "Data Quality Management" |
| TTD, TTR and the cost formula | book | DQF ch.5 |
| "30 to 40% of time", Gartner figure | book (vendor claim) | DQF ch.5, tagged as the authors' claim |

## Lesson 2, dimensions

| Claim | Status | Evidence |
|---|---|---|
| 14 rules find exactly the planted counts | ran | `02_dimensions.py`, `dqlab.check` asserts each |
| Newest order is 2 days 8 h 1 min older than as-of | ran | `02_dimensions.py` |
| No single agreed set of dimensions; Strong-Wang 15, Redman, English, DAMA UK six | book | DMBOK2 1.3.3 |
| Definitions and measurement of each dimension, integrity, reasonability | book | DMBOK2 Table 29 |
| Report both valid% and invalid% | book | DMBOK2 2.7.2, Table 30 |
| A defect can belong to several dimensions | book | DMBOK2 Figure 92 |
| Which dimension each of the 14 rules is filed under | author | some are arguable, see the lab |

## Lesson 3, profiling

| Claim | Status | Evidence |
|---|---|---|
| Column profile values (null%, distinct, min, max) | ran | `03_profiling.py` |
| Email shapes: 445 `a9@a.a`, 15 `a9a.a`, 40 null | ran | `03_profiling.py` |
| Nine country values, five of them spellings of Thailand | ran | `03_profiling.py` |
| A 10% sample found 0 of 6 outliers (seed 7); over 40 seeds: 23 x 0, 12 x 1, 5 x 2, never 6 | ran | `03_profiling.py` |
| Min and max of the text column `email` are meaningless | ran | `03_profiling.py` shows `user100...` and `user9...` |
| Rules are often undocumented and must be reverse engineered | book | DMBOK2 2.3 |
| Looking at the data is the most important part of an assessment | book | DMBOK2 2.4 |
| Profiling does not find root causes or impact | book | DMBOK2 2.5 |
| Shape technique (`a` and `9`), the proposed-rules table | author | |

## Lesson 4, rule-design

| Claim | Status | Evidence |
|---|---|---|
| 14 registered rules find exactly the planted counts; all 14 exceed their own thresholds | ran | `04_rules.py` |
| 6 rules are active and severity error and failing; ORD-TOTAL-SIGN is proposed and never blocks | ran | `04_rules.py` (`gating()`) |
| Same 2.17% measurement fails at thresholds 0, 0.5, 2.0 and passes at 5.0 | ran | `04_rules.py` |
| A deliberately careless rule trips 5 lint problems | ran | `04_rules.py` |
| Benefits of defining rules, six properties of a good rule, rules are reverse engineered | book | DMBOK2 2.7.1, 2.3 |
| Six properties of a good metric | book | DMBOK2 4.4 |
| Example unacceptable levels (80% populated, 1% late) | book (examples) | DMBOK2 Table 30 |
| "Better to do no testing at all" than tests nobody takes seriously | book | DQF ch.3 |
| Rule fields, origin groups, thresholds, owners, impacts, severities | author | `dqrules.py` |

## Lesson 5, checkpoints

| Claim | Status | Evidence |
|---|---|---|
| Thai revenue is split over TH plus 5 spellings; the 5 spellings add up to 292,014.34 | ran | `05_checkpoints.py` country table |
| Publish raw 6,414,003.75 vs quarantine 6,368,087.92; difference 45,915.83 = +48,977.68 duplicates - 3,061.85 negatives | ran | `05_checkpoints.py` (asserted) |
| Quarantine counts 30, 20, 15, 12 equal the planted counts | ran | `05_checkpoints.py` |
| Circuit breaker: 6 blockers on raw data, 3 after quarantine | ran | `05_checkpoints.py` |
| Check granularity counts 15, 10, 20, 1 | ran | `05_checkpoints.py` |
| Element, record, data set levels; in-stream vs batch | book | DMBOK2 2.7.2, Table 31 |
| Bronze and Silver duties; intrusive vs nonintrusive | book | Medallion ch.3 |
| Circuit breaker states and warning to use it only for serious incidents | book | DQF ch.3 |
| dbt, GX, Deequ, Airflow descriptions | book | DQF ch.3 |
| Policies B and C as the two halves of intrusive; dbt tests matched to dimensions | author | |

## Lesson 6, agreements

| Claim | Status | Evidence |
|---|---|---|
| Table vs contract v1: 2 schema problems, 4 rule breaches, freshness 56.0 h vs 24 h | ran | `06_contract.py` |
| v1 to v2: 3 breaking, 1 review, 2 safe | ran | `06_contract.py` (asserted) |
| Test-after-load vs reject-before-load messages | ran | `06_contract.py` |
| Data contract definition, ambiguity, storage options, YAML and GitOps, dbt model contract, ingest contract | book | Medallion ch.12 |
| Contents of a data quality SLA; data sharing agreement | book | DMBOK2 2.7.4; reference and master data chapter 4.4 |
| Breaking / review / safe rules; which fields the contract carries | author | `dqcontract.py`, `contracts/*.yaml` |

## Lesson 7, monitoring

| Claim | Status | Evidence |
|---|---|---|
| Freshness, naive volume, weekday volume, null rate fixed / control limit / rolling: all precision, recall, F1, F2 tables | ran | `07_monitoring.py` (synthetic series, seed 777) |
| Calibration window mean 857, std 242 for rows; null rate mean 0.0605, std 0.0126, limits 0.0228 to 0.0983 | ran | `07_monitoring.py` |
| TypeScript detectors in the lab equal the Python results for 33 parameter settings | ran | `verify_monitoring.mts` |
| Never alerting gets 93.5% accuracy on the null series (86 of 92 days) | ran | arithmetic from `07_monitoring.py` series |
| Known and unknown unknowns; z-score caveats; precision, recall, F-beta; accuracy caveat | book | DQF ch.4 |
| Five pillars | book | DQF ch.5 |
| Control charts, common and special causes | book | DMBOK2 4.5 |
| Anomaly detection alone is a single point of failure; alert fatigue | book | DQF ch.6, ch.8 |
| The series, incident labels, parameter sweeps | author | synthetic, so scores are optimistic |

## Lesson 8, reconciliation

| Claim | Status | Evidence |
|---|---|---|
| Plain-join mart has 2,550 rows vs 2,533 at the source (+17 rows, +48,977.68); deduped mart matches exactly | ran | `08_reconcile.py` (asserted) |
| Orders vs payments gap -34,913.20 = -1,056.50 (35 mismatches) - 33,856.70 (orphan payments); unexplained 0.00 | ran | `08_reconcile.py` (asserted) |
| Golden tests: plain join returns 200 where 100 is expected; deduped passes all 3 | ran | `08_reconcile.py` |
| Singular test: 17 failing rows vs 0 | ran | `08_reconcile.py` |
| System model, database bugs, auditing, end-to-end argument, continuous checks, auditability | book | DDIA ch.13 |
| Unit, functional, integration tests; singular test; limits of coded tests | book | DQF ch.5, ch.3 |
| Idempotent loads and keeping raw data as practical advice | author | |

## Lesson 9, incidents

| Claim | Status | Evidence |
|---|---|---|
| Injected incident: revenue ratio 2.00 on 12 and 13 Sep; 30 duplicate ids; batches B20260912 and B20260913 retried; blast radius of 4 nodes; overstated by 71,120.46; cost 10,800 | ran | `09_incident.py` (asserted); the incident is injected into a clean copy |
| Duplicates follow the calendar (every order twice on 2 days); 30 rows are too few to say anything by country | ran | `09_incident.py` |
| Incident cycle, five RCA steps, three cause groups, five whys, incident commander, status tags, postmortem practices | book | DQF ch.6 |
| Diagnose, options (including "do nothing"), resolve; track in an incident system | book | DMBOK2 2.7.3 |
| Fix where the problem happens; manual fixes in production are very risky; RCA techniques | book | DMBOK2 4.2, 4.6 |
| The story, timeline numbers, action owners | author | invented |

## Lesson 10, ownership-scorecard

| Claim | Status | Evidence |
|---|---|---|
| Average valid% 98.03% while 0 of 14 rules are within threshold and 6 blocking rules fail | ran | `10_scorecard.py` (asserted) |
| Five remediation steps: blocking failures 6 to 0, average 98.03 to 98.69 | ran | `10_scorecard.py` |
| Dropping orders without a customer worsens PAY-ORDER-EXISTS from 20 to 58 rows (valid 99.22% to 97.73%) | ran | `10_scorecard.py` prints payments without an order after each step ([20, 20, 20, 58, 0, 0]) and asserts the dip 98.43 to 98.42 |
| Downtime 126 h of which 107 h detection (85%); halved detection 72.5 h (printed 72); SLO 80 h | ran | `10_scorecard.py` (made-up incident log) |
| Certification checklist result for orders and customers | ran | `10_scorecard.py` |
| What to report | book | DMBOK2 2.7.5 |
| ROI variables, example 90% to 95% | book | DMBOK2 2.6 |
| Business process owners own their data | book | DMBOK2 1.2 |
| Blast radius, roles, RACI, SLA/SLO/SLI steps, downtime formula, seven certification steps, annual cost formula | book | DQF ch.5, ch.8 |
| Mini RACI table, SLO value, incident log, rule weights | author | invented |

## Lesson 11, capstone

| Claim | Status | Evidence |
|---|---|---|
| Six scenarios give: published, published with 1 quarantined row, held x4 (26% bad rows, renamed column, empty batch, 34% volume); 4 tickets; 1 gold row | ran | `11_capstone.py` (asserted) |
| Pipeline order and thresholds (10%, 50%) | author | |

## Found while building

- The first version of the generator let `shipped_ts` run past the as-of time, an unplanned defect that the profile
  exposed. It was fixed in `dqlab.py` (shipping takes 1 or 2 days, and `ingested_at` is capped at as-of). The rule
  that came out of it: after changing a generator, profile the data again before trusting "only planted defects".
