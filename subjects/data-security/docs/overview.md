# Data Security

A path for someone who holds data about real people and wants to know what happens to those people when the data is stored, used and released. Eleven lessons in Thai and English, each with a
quiz and one or two animated labs. Everything runs on 2,000 synthetic people on this computer: in-memory SQLite, real AES-GCM and AES-SIV, and nothing is sent over a network.

## Lessons

| # | Lesson | Phase | Labs |
|---|---|---|---|
| 1 | Sensitive data, and the columns that point at a person | A | `IdentifiabilityLab` |
| 2 | Pseudonymization, and hashes of identifiers | A | `PseudonymLab` |
| 3 | Linkage attack | A | `LinkageLab` |
| 4 | k-anonymity, and the price of coarsening | B | `KAnonLab` |
| 5 | Differential privacy | B | `LaplaceLab` |
| 6 | The privacy budget | B | `BudgetLab` |
| 7 | Encrypting stored data, and envelope encryption | C | `EnvelopeLab` |
| 8 | Who sees what, with roles, views, masking and a scan of what leaves | C | `AccessMaskLab` |
| 9 | Computing on data nobody sees | C | `SecretShareLab`, `PsiLab` |
| 10 | The life of data, with consent, retention and deletion | D | `LineageLab` |
| 11 | Capstone, releasing a table safely | D | `ReleaseLab` |

Twelve labs in `site/src/components/labs/data-security/`. Four are clock labs (`PseudonymLab`, `LaplaceLab`, `SecretShareLab`, `LineageLab`), two are step labs (`EnvelopeLab`, `PsiLab`) and six have controls and a picture. Each draws what its lesson talks about (a crowd of 2,000 dots, a guess list hitting a table, voters piling up beside an anonymous row, blocks of people, two piles of noisy answers, a running average and a jar of coins, chests and keys, a table seen by three roles, pieces handed between people, padlocked boxes, a delete request travelling a graph, four parcels side by side). `ds.tsx` has the shared
pieces (`Key` legend, `PersonGlyph`) and `peopleLib.ts` groups and joins the real people in the browser.

## Code

`subjects/data-security/code/` is its own `uv` project (Python 3.12 or newer, `cryptography` 47.0.0). `dslab.py` has `check`, `show` and `done` and `people.py` makes the synthetic people and a voter list.
Exercises `01` to `12` assert what the lessons print and `verify.py` re-runs them. Every exercise takes `--write` and saves the JSON that a lab reads
(`identifiability.json`, `pseudonym.json`, `linkage.json`, `kanon.json`, `laplace.json`, `budget.json`, `envelope.json`, `access.json`, `securecomp.json`, `lifecycle.json`, `release.json`).

## Backlog

- Run the same measures with a production library (OpenDP) and compare with the hand written noise.
- Lessons on synthetic data, on federated learning and homomorphic encryption (Jarmul ch. 5 to 7), and on a data protection impact assessment (Jarmul ch. 8).
- A lesson that follows one column through a real warehouse (a lakehouse with column masking), linking to the Iceberg and Data Quality subjects.
- Replace the synthetic voter list with a measure of how much of a real population a public source covers.
