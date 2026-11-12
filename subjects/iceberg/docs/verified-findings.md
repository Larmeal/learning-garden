# Verified findings (Iceberg)

Tags: **ran** (asserted by an exercise in `code/exercises/` on Spark 4.1.3 + Iceberg 1.12.0 + PyIceberg 0.12.0), **source** (read in the
Iceberg 1.12.0 source tree at `E:\Development\Project\open-source\iceberg`, tag `apache-iceberg-1.12.0`, commit 212aa894e919ff9fdf89160da4aadcbe6858ac01,
or in its knowledge graph `graphs/iceberg-current/`), **author** (advice, framing or an inference, not checked), **docs** (read in the
documentation, not run). `code/verify.py` re-runs every exercise (inside WSL, see `code/run_wsl.sh`).

| Lesson | Claim | Tag |
|---|---|---|
| what-is-iceberg | Spark creates a v2 table, one Parquet file per partition value, two `metadata.json` after CREATE + INSERT, one manifest, one manifest list | ran (01) |
| what-is-iceberg | the JDBC catalog row holds `metadata_location` and `previous_metadata_location` | ran (01) |
| what-is-iceberg | PyIceberg's SqlCatalog and Iceberg's JdbcCatalog (`jdbc.schema-version=V1`) share the same SQLite tables, so Spark and PyIceberg work on the same tables | ran (01) |
| what-is-iceberg | Spark `timestamp` is Iceberg `timestamptz`; PyIceberg rejects an Arrow timestamp without timezone (`Mismatch in fields`) | ran (01) |
| what-is-iceberg | a Spark session sees 4 rows before `REFRESH TABLE` and 5 after a PyIceberg append | ran (01) |
| what-is-iceberg | Spark INSERT on a stale table succeeds on top of PyIceberg's snapshot, no row lost | ran (01) |
| what-is-iceberg | JDBC commit is `UPDATE ... WHERE metadata_location = <old>` | source (`JdbcUtil.java` `V1_DO_COMMIT_TABLE_SQL`, `JdbcTableOperations.doCommit`) |
| what-is-iceberg | problems of a plain folder of files (partial writes, schema change) | author |
| what-is-iceberg | Iceberg 1.12.0 has Spark runtimes for 4.0 and 4.1 only; built against Spark 4.1.3 | source (`gradle/libs.versions.toml`), Maven Central checked 2026-11-12 |
| table-anatomy | file counts per kind; older `metadata.json` unchanged by a later commit (SHA-256); `metadata-log` lists older files | ran (02) |
| table-anatomy | manifest list rows 1, 2, 3; manifests shared between snapshots; only 3 manifests exist | ran (02) |
| table-anatomy | manifest entry `status` 1, `sequence_number` null (inherited from the manifest list), data_file keys, bounds decoded from bytes | ran (02) |
| table-anatomy | bounds equal the Parquet min/max; Parquet stores the same field ids | ran (02) |
| table-anatomy | Spark `.snapshots`, `.manifests`, `.files` equal what is read from the files | ran (02) |
| table-anatomy | `status` 0/1/2, `content` 1 = delete manifest, sequence number inheritance | source (`format/spec.md`) |
| table-anatomy | manifest merge default `commit.manifest.min-count-to-merge` = 100, not reached | source (`TableProperties.java`) |
| table-anatomy | why the metadata is split in layers; metrics modes can drop column stats | author |
| schema-partitioning | field ids for top-level and nested columns, `last-column-id` 13, ids stored in Parquet | ran (03) |
| schema-partitioning | Spark to Iceberg type names (`bigint`, `timestamp`, `timestamp_ntz`, array, map, struct) | ran (03) |
| schema-partitioning | rename keeps the id, old rows readable; drop + add same name gets a new id (14), old values do not return | ran (03) |
| schema-partitioning | `ts_day` is not a column, filter on `ts` plans 1 of 5 files, `country` filter plans 5 of 5 | ran (03) |
| schema-partitioning | day partition value = days since 1970-01-01; month partition value 672 = 2026-01 | ran (03) |
| schema-partitioning | `bucket(4, user_id)` from Spark and from PyIceberg's `BucketTransform` agree | ran (03) |
| schema-partitioning | the eight transforms | source (`format/spec.md`) |
| schema-partitioning | Hive-style table scans every partition when `dt` is not filtered | author |
| writing | `INSERT INTO` is `append`; `INSERT OVERWRITE` static replaces the whole table, dynamic only the touched partitions; `writeTo` append / overwritePartitions / overwrite(filter) (the filter does not filter the dataframe) / create | ran (04) |
| writing | a failed INSERT (division by zero) leaves no snapshot and no rows | ran (04) |
| writing | PyIceberg 0.12.0 `overwrite` with a filter is two snapshots (`delete`, `append`); a collision is retried by PyIceberg itself (log `retrying (1/4)`), with `commit.retry.num-retries=0` it is `CommitFailedException` | ran (04) |
| writing | retry defaults 4 / 100 ms / 1 min / 30 min | source (`TableProperties.java`, `SnapshotProducer.commit`) |
| writing | orphan files left by a job that dies after writing data files; isolation level checks of overwrite | author |
| reading | files planned for six filters (8, 2, 1, 1, 8, 0 of 8); 2 of 8 manifests overlap one day; Spark `BatchScan` shows the filter and snapshotId; `inspect` and Spark metadata tables agree; `readable_metrics` | ran (05) |
| reading | the evaluator classes (`ManifestEvaluator`, `InclusiveMetricsEvaluator`, `ResidualEvaluator`) in the order manifest, file, row | source (class names and places only, not read line by line) |
| row-level | copy-on-write delete rewrites the file (`overwrite`, 1 added 1 deleted); the default mode is copy-on-write and not stored on a new table | ran (06), source (`TableProperties.java`) |
| row-level | merge-on-read v2: `delete` with one position delete file, `total-records` still 10, `files` content 0 and 1, `position_deletes` pos 2; UPDATE and MERGE write data file + delete file; PyIceberg reads them | ran (06) |
| row-level | v3: deletion vector in a Puffin file (`added-dvs`), read by Spark and PyIceberg 0.12.0; whole-partition DELETE is metadata only; PyIceberg delete is copy-on-write and upsert is 3 commits | ran (06) |
| evolution | six ALTERs write no data file, 7 schemas kept, old rows read with new schema, int to bigint ok, bigint to int refused, `VERSION AS OF` uses the old schema, PyIceberg `update_schema` | ran (07) |
| evolution | `REPLACE PARTITION FIELD` keeps old files, specs 0 and 1 coexist, planning per spec; PyIceberg `update_spec`; `WRITE ORDERED BY` and `sort_order_id` | ran (07) |
| time-travel | `VERSION AS OF`, `TIMESTAMP AS OF`, PyIceberg `scan(snapshot_id)`, `snapshot_as_of_timestamp`; `snapshot-id` reader option refused in Spark 4.1 / Iceberg 1.12.0 (use `versionAsOf`) | ran (08) |
| time-travel | tag, branch (main does not move), PyIceberg append to a branch, `fast_forward`, rollback keeps all snapshots, `set_current_snapshot`, WAP with `cherrypick_snapshot`, changelog view | ran (08) |
| time-travel | changelog view cannot read a range with delete files | ran (14) |
| catalogs | Hadoop catalog files (`vN.metadata.json`, `version-hint.text`), `StaticTable`, `register_table`, `cache-enabled=false`, env-var config of PyIceberg (read at import), rename keeps files, DROP vs PURGE | ran (09) |
| catalogs | Hive, Glue, Nessie, REST exist in the source tree; REST was not run | source (folder listing), not run |
| maintenance | `rewrite_manifests` 20 to 1; `rewrite_data_files` 20 to 1 (`replace`), old files stay until `expire_snapshots`; sort strategy; expire keeps current + tagged; old metadata.json stay; `remove_orphan_files` refuses under 24 h, ignores young files, finds an old stray file; PyIceberg `maintenance` has only `expire_snapshots` | ran (10) |
| maintenance | defaults of `previous-versions-max` (100), `delete-after-commit` (false), snapshot age (5 days), minimum snapshots (1) | source (`TableProperties.java`) |
| migration | `add_files` copies nothing, table points at original files; `snapshot` leaves the source untouched; `migrate` replaces in place and leaves `old_backup_`; error `Cannot set a custom location for a path-based table`; PyIceberg `add_files` | ran (11) |
| streaming | one snapshot per micro-batch, `queryId` and `epochId` in the summary, restart without new files adds no snapshot, Iceberg table as stream source, `start-snapshot-id` exclusive / `end-snapshot-id` inclusive, empty result over an overwrite, PyIceberg `incremental_append_scan` | ran (12) |
| spec-versions | default version 2; keys of v1, v2, v3; v1 refuses merge-on-read delete; upgrade yes, downgrade refused; `_row_id` and `_last_updated_sequence_number`; views in the catalog (`VIEW`, gzip metadata, PyIceberg `list_views` not implemented); `compute_table_stats` Puffin file | ran (13) |
| spec-versions | what else each version adds; statistics are optional | source (`format/spec.md`, not exercised), author |
| capstone | the whole flow: branch audit, publish, MERGE, comparison with VERSION AS OF, compaction + expire with a tag, one dangling position delete file stays after compaction | ran (14) |
| under-the-covers | one table through CREATE, INSERT x2, MERGE (copy-on-write: `overwrite`, 1 added 1 deleted, a manifest with a DELETED entry, the old manifest dropped from the new manifest list, the untouched manifest reused), PyIceberg `plan_files` for `amount > 200` gives 1 of 2 files, time travel to snapshot 1 gives 2 rows, compaction gives `replace` with 3 manifests and the old data files still on disk; the content of every file is dumped to `underCovers.json` for the lab | ran (15) |
| row-level in depth | one UPDATE and one DELETE of a row in a 100,000-row table (5 files): copy-on-write rewrites 20,000 / 19,999 rows, merge-on-read writes 1 row + 1 delete file / only 1 delete file; a position delete file holds `file_path` and `pos` and lives in a manifest with `content = 1`; Spark folds the earlier positions of a data file into one new delete file (the old one is DELETED in a new manifest), so a data file needs at most 1 delete file (`plan_files()`: 2 delete files and 2 positions after UPDATE + DELETE, then 3 and 3, 4, 5 after three DELETEs in one file); `rewrite_data_files` with `delete-file-threshold=1` rewrites the data files but leaves the dangling delete file (`removed_delete_files_count` 0), and `remove-dangling-deletes=true` removes it without a new data file; mixed modes per statement (DELETE merge-on-read, UPDATE copy-on-write) | ran (16) |
| row-level in depth | defaults of `delete-file-threshold` (Integer.MAX_VALUE) and `remove-dangling-deletes` (false) | source (`BinPackRewriteFilePlanner.java`, `RewriteDataFiles.java`) |
| row-level in depth | equality deletes: written by other engines, slow to read, sequence-number rule; not exercised (Spark SQL does not write them) | book (chapter 2 pp. 33-34, chapter 4 p. 89), not run |
