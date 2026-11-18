# Sources of the Data Security subject

## Books (kept outside the repo)

PDFs in `E:\books\Networking & Security\Security\Data Privacy\`. They were converted to text with `pdftotext -layout` (one page per form feed) into a scratch folder, so a claim can be
given a printed page. The text has captions and the words around a figure, but not the figures: **no figure of any book was seen**.

| Book | Used for | Page offset (printed page = PDF page minus offset) |
|---|---|---|
| *Practical Data Privacy: Enhancing Privacy and Security in Data*, Katharine Jarmul (O'Reilly, 2023). 11 chapters. Cited as **Jarmul** here and as "Practical Data Privacy" in the lessons | finding sensitive data and pseudonymization (ch. 1), anonymization, differential privacy, privacy budgets, k-anonymity (ch. 2), consent and local collection (ch. 3), privacy attacks and data security (ch. 4), encrypted computation (ch. 7), GDPR (ch. 8), key rotation and "why isn't k-anonymity enough" (ch. 10) | 30. Checked on 12 topics (linkage attacks p. 88, Laplace mechanism p. 38, k-anonymity p. 54, key rotation p. 265, consent p. 66, controller and processor p. 204 and others, all matching the table of contents). |
| *Building an Anonymization Pipeline: Creating Safe Data*, Luk Arbuckle and Khaled El Emam (O'Reilly, 2020). 8 chapters. Cited as **Arbuckle** here and as "Building an Anonymization Pipeline" in the lessons | the identifiability spectrum and disclosure risk (ch. 2), the Five Safes (ch. 3), safe people and safe settings | 16. Checked on 4 pages (Five Safes p. 44, identifiability spectrum p. 23, disclosure risk p. 24, safe outputs p. 57). |
| *Hands-On Differential Privacy*, Ethan Cowan, Michael Shoemate and Mayana Pereira (O'Reilly, 2024). 13 chapters. Cited as **Cowan** here and as "Hands-On Differential Privacy" in the lessons | the definition of differential privacy, randomized response, the Laplace mechanism, composition and postprocessing (ch. 2) | 22. Checked on 5 pages (Laplace p. 37, randomized response p. 30, composition p. 43, postprocessing p. 44, privacy unit p. 27). |

Page rule, as in the other subjects: a citation gives the chapter and the printed page where the section starts, for example `Practical Data Privacy บทที่ 2 หน้า 54`.
Never the section sign or "ch.". A page header is the top of its page, so a passage belongs to the nearest header **above** it. The text was searched with a small script
(`fp.py`, not kept in the repo); a page may be one off.

## Not used

No source tree was read. `cryptography` 47.0.0 (AES-GCM, AES-SIV) and Python 3.14's `hashlib`, `hmac`, `sqlite3`, `random` and `re` are used as the real thing. The legal text of GDPR
and CCPA was **not** read: where a lesson speaks of the rights of a data subject it retells the book and says so. Homomorphic encryption, federated learning (Jarmul ch. 6 and 7),
the Python libraries of the books (OpenDP and others) and the code of the books were not run.

## Models and made-up data

- **The people**: 2,000 synthetic people (`people.py`) made with `random.Random(7)`. The names come from two short lists. The area of a specialist clinic (zip 10900, where 169 of 181 people
  have the same diagnosis) is an assumption of the author, made with a separate random stream so that nothing else changes. The voter list covers 70.5% of them and is made from the table itself.
- **Noise**: Laplace noise is made by an inverse CDF transform written in the exercises. It is fine for learning and is not safe against floating point attacks, which a production library handles.
- **The platform** of lesson 10 (6 tables and a backup) and the permissions of lesson 8 (SQLite's authorizer) are small examples written for the lessons.
