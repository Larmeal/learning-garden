# Verified findings (Data Security)

Every statement in a lesson is tagged **ran** (produced by an exercise in `code/exercises/` with Python 3.14.9 and `cryptography` 47.0.0 on Windows, no network), **book** (chapter and the printed
page where it starts; `docs/sources.md` has the page offsets) or **author** (advice, framing or a guess, said so in the lesson). No source tree was read, so there is no **source** tag.
`code/verify.py` re-runs the 12 exercises (179 checks; exercise 12 writes the real 2,000 people for the labs) and `node verify_labs.mts` (14 checks) runs the grouping and joining code of the labs on the same rows and exits non-zero if one changes. The people are synthetic and seeded, so the numbers repeat. Two timings
(`02_pseudonymization.py`, about 1.6 s for a table of a million hashes) belong to the computer that ran them.

| Lesson | Claim | Tag | Where |
|---|---|---|---|
| sensitive-data | 2,000 synthetic people; email and phone 2,000 distinct values, birth 1,900, zip 12, sex 2, diagnosis 7 | ran | `01_sensitive_data.py` |
| sensitive-data | regexes find phone numbers in 200 rows and e-mails in 106 rows of the notes column | ran | `01_sensitive_data.py` |
| sensitive-data | people alone in their group: sex 0, +zip 0, +birth year 450, +month 1,757, +full date 1,992 | ran | `01_sensitive_data.py` |
| sensitive-data | finding sensitive and hidden personal data; the spectrum of identifiability and disclosure risk | book | Jarmul ch. 1 p. 5 and 14; Arbuckle ch. 2 p. 23 and 24 |
| pseudonymization | a table of all 1,000,000 six digit SHA-256 values undoes 2,000 of 2,000; a 600,000 guess dictionary finds all 654 e-mails of a domain | ran | `02_pseudonymization.py` |
| pseudonymization | a salt per row stops the dictionary and the join (0 of 2,000); HMAC joins 2,000 of 2,000 and the dictionary without the key finds nothing; random tokens do not join; a new key breaks every old link | ran | `02_pseudonymization.py` |
| pseudonymization | pseudonymization and how it differs from anonymization | book | Jarmul ch. 1 p. 22 |
| linkage-attack | voter list of 1,413 of 2,000; the join names 1,409 correctly of 1,410 rows left with one voter; month and year 1,294, year 502, year and 3 digit zip 273, year and 2 digit zip 0; a 2 digit zip with the full date 1,363; year and 5 digit zip: 711 named, 502 right | ran | `03_linkage.py` |
| linkage-attack | linkage attacks, the Netflix Prize, singling out | book | Jarmul ch. 4 p. 85, 88, 90 (Netflix not run) |
| k-anonymity | k and rows to suppress by age band and zip (1,872 at the exact year; 38; 10 at 10 years and a 3 digit zip), average group 1.9 to 166.7, 20 year band adds nothing | ran | `04_k_anonymity.py` |
| k-anonymity | 5 groups (62 people) with one diagnosis, zip 109 has HIV for 169 of 181, 2-diversity fails | ran | `04_k_anonymity.py` (the clinic area is the author's assumption) |
| k-anonymity | k-anonymity and its limits | book | Jarmul ch. 2 p. 54 and ch. 10 p. 267 |
| differential-privacy | count of HIV 351; the density ratio between neighbouring tables is at most e^epsilon and reaches it (1.105, 1.649, 2.718, 7.389); overlap e^(-epsilon/2); average error 1/epsilon | ran | `05_dp_basics.py` |
| differential-privacy | sensitivity of a mean 30, 300, 3,000 for 2,000, 200, 20 people; unbounded without a clip; randomized response epsilon ln 7, estimate 0.1687 against 0.1755, error 26 against under 1 | ran | `05_dp_basics.py` |
| differential-privacy | the definition, the Laplace mechanism, randomized response, sensitivity | book | Cowan ch. 2 p. 26 to 30, 37, 38; Jarmul ch. 2 p. 30, 31, 43 |
| privacy-budget | the average of fresh answers approaches the truth (13.1, 3.49, 0.26, 0.54, 0.01); an accountant stops at 10 queries of 0.1; a stored answer costs nothing; splitting epsilon 1 gives error 1, 10, 100; a histogram over 12 zips costs epsilon once; clamping makes an empty group average 0.994 | ran | `06_privacy_budget.py` |
| privacy-budget | composition and postprocessing | book | Cowan ch. 2 p. 43 and 44; Jarmul ch. 2 p. 45 |
| encryption-at-rest | 37 bytes per value; a moved ciphertext is caught; AES-SIV leaks equality (7 ciphertexts, the most frequent is flu); rotating the master key rewrites 180 bytes; deleting a data key makes table and backup unreadable; an injected condition makes the app decrypt all 300 values | ran | `07_encryption.py` |
| encryption-at-rest | the 92,500,000 bytes of rewriting without envelope encryption | author | computed from row counts the author chose (100,000, 2,000,000, 400,000), no such rows were encrypted |
| encryption-at-rest | key rotation as a real question | book | Jarmul ch. 10 p. 265 |
| access-masking | three views (9 / 5 / 5 columns, 600 / 307 / 600 rows); the authorizer refuses the base table, a sub query, another role's view and the audit table; purpose refused; the token joins and the mask does not; 509 small groups held back; DLP finds 60 phone numbers, 32 e-mails and a Luhn card number; the log holds 8 answered and 5 refused | ran | `08_access_masking.py` |
| access-masking | Python's statement cache lets a guest skip the authorizer; `cached_statements=0` closes it | ran | `08_access_masking.py` (found while writing the exercise) |
| access-masking | data loss prevention, access control, safe people and safe settings | book | Jarmul ch. 4 p. 102 to 105; Arbuckle ch. 3 p. 49 and 52 |
| secure-computation | secret sharing gives 161,000, a share is uniform (9% to 11% per last digit), two of three shares are too; secure aggregation of 100 clients is exact, masked values are far from real ones, the sum is wrong when client 17 drops out; PSI with a 127 bit prime finds exactly 120 of 300, sizes and probing leak | ran | `09_secure_computation.py` |
| secure-computation | encrypted computation, privacy against secrecy, PSI, secure aggregation | book | Jarmul ch. 7 p. 163, 166, 186, 189 |
| data-lifecycle | consent 115 / 19 / 66 and a campaign from users alone reaching 200; retention removes 696 of 1,000 and customer_360 still counts them; one user in 6 tables, a delete from users leaves 5, the lineage walk deletes all; a backup holds the user, an erasure log applied on restore removes them | ran | `10_lifecycle.py` |
| data-lifecycle | consent kept with the data, rights of the data subject, controller and processor | book | Jarmul ch. 3 p. 66; ch. 8 p. 202 and 204 (not run, not legal advice) |
| capstone | stages 0 and 1 name 1,409; stage 2 (10 suppressed) names 0, salary error 0.03%, diagnosis count error 0.57%; the difference attack gets 100% against exact numbers; at epsilon 1 69.7%, 0.1 52.5%, 5 95.9%; stage 3 names 0, salary error 0.63%, count error 0.70% | ran | `11_capstone.py` |
| capstone | the Five Safes | book | Arbuckle ch. 3 p. 44 to 57 |
| capstone | matching each safe to what the subject did | author | |
| every lesson | choosing random or deterministic encryption by the variety of values; not using the attacker's error rate as the only measure | author | |

## Not run

Homomorphic encryption and federated learning, OpenDP and other production differential privacy libraries, noise that is safe against floating point attacks, advanced composition, a real
KMS or HSM, searchable encryption, roles and row level security of a real database, bcrypt-like products for tokenization, real vaults, GDPR and CCPA as law, attackers with sources
other than the voter list, and any real data.

## Labs (redrawn 2026-11-19)

The owner said the first labs explained nothing, so all twelve were drawn again around the objects of each lesson. Where a lab shows a number it is computed in the browser from the real rows
(`labPeople.json`, written by `exercises/12_lab_people.py`) or read from a JSON that an exercise wrote, and `verify_labs.mts` checks the browser code against the numbers of exercises 01, 03 and 04
(0, 0, 450, 1,757, 1,992 people alone; 1,410 named and 1,409 right; 1,294, 502, 273 and 0 right with coarser keys; 1,872 cut at exact values; 38 and 10 cut at k = 5; 5 groups of 62 people with one
diagnosis). Illustrations, not measurements: the 100 noisy answers per world in the lesson 5 lab (a fixed seed, the formula is the measured number), the noisy counts in the last column of the capstone
lab, the three people and the random pieces of the secret sharing lab (a small modulus), the four customers and the guess list of the pseudonym lab (the hashes are real).

A bug found while doing this: `06_privacy_budget.py --write` made a new random generator for every answer, so the curve of the average error was constant (8.83 for every m). It is fixed, and the lab now
uses 200 answers of the exercise, where the error of the average is 13.1 (1 answer), 3.5 (10), 1.95 (50) and 1.29 (200).
