# Sources (Iceberg)

No book was used. Everything comes from running the code and from the Iceberg source.

- Apache Iceberg 1.12.0, tag `apache-iceberg-1.12.0`, commit `212aa894e919ff9fdf89160da4aadcbe6858ac01`, checked out at
  `E:\Development\Project\open-source\iceberg` (outside this repo). The knowledge graph of `api/src/main` and `core/src/main` is in
  `graphs/iceberg-current/` (4,038 nodes, 14 layers, a 15 step tour; analysed 2026-11-12).
- Spec: `format/spec.md`, `format/puffin-spec.md`, `format/view-spec.md` of the same checkout.
- Spark 4.1.3 (PySpark 4.1.3) with `iceberg-spark-runtime-4.1_2.13-1.12.0.jar` from Maven Central, run in WSL with Temurin 21.
- PyIceberg 0.12.0 (`pyiceberg[sql-sqlite,pyiceberg-core]`), `pyarrow`, `fastavro` for reading manifests by hand.
- Catalog used by the exercises: Iceberg `JdbcCatalog` on SQLite (`jdbc.schema-version=V1`) shared with PyIceberg's `SqlCatalog`; `sqlite-jdbc` 3.46.1.3.

Not available: an Iceberg runtime for Spark 4.2 (none on Maven Central on 2026-11-12), so this subject does not use the Spark 4.2.0 of the Spark subject.

## Book (kept outside the repo)

- Tomer Shiran, Jason Hughes and Alex Merced, *Apache Iceberg: The Definitive Guide* (O'Reilly). A markdown clipping is at
  `E:\Development\Project\personal-project\personal-knowledge\Clippings\book\data-engineer\Apache Iceberg - The Definitive Guide.md`. The figures are not in the
  clipping (only their captions), so the labs follow the order and layering that the text and the captions describe. Citations give chapter and printed page:
  chapter 2 p. 29 (figure 2-1, the three layers), chapter 3 p. 46 (figure 3-2, the write path) and p. 59 (figure 3-6, the read path), chapter 4 p. 86 (the copy-on-write versus merge-on-read table), p. 88-89 (position and equality deletes), p. 90 (setting a mode per statement) and chapter 2 pp. 33-34 (equality deletes, figure 2-5). The page numbers were read from the page headers in the clipping and could be one off where the clipping does not show a header.

## Article

- Jason Hughes, Dremio, *Apache Iceberg: An Architectural Look Under the Covers*, https://www.dremio.com/resources/guides/apache-iceberg-an-architectural-look-under-the-covers/ (read
  2026-11-12 through a page fetch). The owner pointed to it as the way they want Iceberg explained: one table, one statement at a time (CREATE, INSERT, MERGE, SELECT, time
  travel, compaction), each as a numbered sequence with a picture. The sub-page "Under the covers" of lesson 2 copies that **shape**, not the text or the pictures
  (the fetch returned the text only, the figures were empty placeholders, so we did not see them). Every file content on that page comes from our own run (`exercises/15_under_the_covers.py`).
