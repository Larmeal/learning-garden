# Verified findings about Great Expectations

What was checked, how, and where to re-run it.

Versions used:
- **1.24.1**: the current release (docs.greatexpectations.io, 2026-10). The scripts in `../code/` pin it and every lesson
  targets it.
- **1.9.3**: the checkout at `open-source/great-expectations` (commit `31bdf47`) that `graphs/gx-current/` was built from.
  The first round of source reading and experiments used it. Where the two differ, the table says so.
- **0.18.21**: the last 0.x line, run once in `08_legacy_018.py` for the comparison in the foundations lesson.

Evidence levels: **ran** = observed by running code, **source** = read in the code but not run.

## Flow of one validation

`Checkpoint.run` > `ValidationDefinition.run` > `v1_validator.Validator.validate_expectation_suite` > old
`Validator.graph_validate` > `MetricsCalculator` / `ValidationGraph.resolve` > `ExecutionEngine.resolve_metrics` >
`Expectation.metrics_validate` > `_validate`. File and function names are the same in 1.9.3 and 1.24.1.
`validation_graph.py` has 0 changed lines between the two versions.

| Finding | Level | Where |
|---|---|---|
| Building context, source, asset, batch definition and suite computes nothing (0 engine calls) | ran | `02` |
| `add_*` returns an object with an id; `ExpectationSuite(...)` and `ValidationDefinition(...)` have `id=None` until added or run. A validation definition serializes its suite and batch definition as name + id, and no data | ran | `17` |
| Adding a suite or data source with an existing name raises `DataContextError`; in a file context the names persist, so a second run of the script hits it. `suites.get`, `suites.add_or_update` work on the existing name | ran | `17` |
| `ValidationDefinition.run` adds itself to the context if its suite and data are already added; otherwise it raises `ValidationDefinitionRelatedResourcesFreshnessError` | ran | `01`, `03` |
| `Checkpoint.add` with a validation definition that is not added raises `CheckpointRelatedResourcesFreshnessError` | ran | scratch |
| Each result is stored in the validation results store inside `ValidationDefinition.run`, before any action | ran | `06` |
| Two `Validator` classes: `v1_validator.py` (thin, used by `ValidationDefinition`) wraps `validator.py` (does the work) | source | both files |
| Each expectation declares metrics (`get_validation_dependencies`) and judges them (`_validate`) | source | `expectations/expectation.py` |
| Metrics of all expectations form one graph resolved in rounds (all metrics whose dependencies are done). A failing metric is retried up to 3 times | ran / source | `02`, `validation_graph.py` |
| The same metric id is computed once for many expectations | ran | `02`, `make_lab_data.py` |
| Every column expectation first needs `table.column_types`, `table.row_count` and `table.columns`; `ExpectTableRowCountToEqual` alone needs only `table.row_count` | ran | lab data |
| `result_format` changes the metric count: 10, 13, 19, 19 (BOOLEAN_ONLY, BASIC, SUMMARY, COMPLETE) for a 5-expectation suite on 1.24.1; 11, 14, 20, 20 on 1.9.3. `ValidationDefinition.run` defaults to SUMMARY | ran | `02` |
| 1.9.3 computed `table.row_count` twice (separate SQL statements); 1.24.1 does not: SQL 6 expectations cost 4 / 7 statements on 1.9.3 and 3 / 6 on 1.24.1 | ran | `05` on both |
| Repeated runs recompute all metrics (19 and 19) | ran | `02` |
| A metric has one implementation per engine class; `metric_value` computes directly, `metric_partial` (aggregate) is deferred and bundled | source | `metric_provider.py`, `execution_engine.py` |
| On SQL, aggregate metrics of one domain become one SELECT (`avg` and `max` together) | ran (SQLite) | `05` |
| On Spark, bundled metrics become one `df.agg(...).collect()` per domain | source only | `sparkdf_execution_engine.py` |
| pandas computes immediately and has no bundling | source | `execution_engine.py` docstring |
| A partitioned SQL batch becomes a WHERE clause | ran (SQLite) | scratch |

## Results and traps

| Finding | Level | Where |
|---|---|---|
| A column-map expectation passes on an empty table; `between` also passes on an all-null column; `not null` does not | ran, all 5 data cases x 3 expectations | `03`, scratch |
| An expectation that cannot be evaluated (missing column) becomes `success=False` with `exception_info`; other expectations still run | ran | `03` |
| `Checkpoint.run` returns a `CheckpointResult` and does not raise on failed data; read `.success` | ran | `03`, `09` |
| `mostly`: `(considered - unexpected) / considered >= mostly`; nulls are not considered. `[10, None, 30, 400]` between 0..120: passes at mostly 0.66, fails at 0.67 | ran | scratch |
| Adding an equal expectation to a suite twice is silently ignored | ran | `03` |
| Suite result keys: `success, results, suite_name, suite_parameters, statistics, meta, id`; each expectation result: `success, expectation_config, result, meta, exception_info`. `expectation_config.severity` defaults to `critical` | ran | `18` |
| The same validation definition run on two DataFrames gives two stored results with different `run_time`; the results store holds both | ran (ephemeral, pandas) | `18` |
| `ExpectColumnValuesToBeUnique` on `[1,2,2,4]` reports `unexpected_count=2` and `partial_unexpected_list=[2,2]` (both rows of a duplicate count) | ran | `18` |
| `result.results` is not always in suite order: when expectations fail with an exception (missing column) GX puts them first. Match results to expectations through `expectation_config`, not by position | ran (1.24.1) | `16` |
| A validation leaves the pandas DataFrame unchanged (9 defect cases) | ran (pandas only) | `16` |
| One suite, nine defect cases: null, duplicate, out of range, bad format, unknown category, renamed column and empty table are each caught; a wrong value inside the allowed range (`13` instead of `31`) passes | ran | `16` |
| A second `get_context()` replaces the global project. 1.9.3: objects of the first context then fail to run. 1.24.1: they still run (objects remember their owner context) | ran on both | `03` |
| `get_context()` order: cloud (env vars), then file (a `gx/` folder), then ephemeral | source / ran | `context_factory.py`, `06` |
| Without batch parameters `get_batch()` returns the last batch. Parameters filter, then the last of the remaining is returned (year+month on a daily regex gives the last file of that month). No match raises `NoAvailableBatchesError` | ran | `04`, scratch |
| 1.24.1: numeric batch parameters should be integers; digit strings still work with a deprecation warning (removal in 2.0) | ran | scratch |
| File-based batch identifiers carry strings; SQL column-partitioned identifiers carry integers | ran | `04`, scratch |
| `${VAR}` in a connection string is stored as text and substituted from the environment at use | ran | scratch |
| `$PARAMETER` suite parameters are filled by `expectation_parameters` | ran | `04` |
| A suite stored in a file context that contains a custom expectation loads with **0 expectations** in a process that did not import the class; running it returns `success=True`, `evaluated_expectations=0` | ran (1.24.1) | `10` |
| A custom expectation without a provider for the engine returns `success=False` with `No provider found ...` in `exception_info` | ran (SQLite) | scratch |
| Severity: `severity="warning"` on an expectation; `result.get_max_severity_failure()` returns the worst failed level | ran | scratch |

## Custom expectations (lesson 12)

Scripts `07`, `11` to `15` in `../code/`. Scripts `07`, `11`, `12`, `13` were also run on 1.9.3 (`uv run --isolated
--no-project --with great-expectations==1.9.3 ...`); the same classes worked, differences are noted per row.

| Finding | Level | Where |
|---|---|---|
| `MetaExpectation.__new__` sets `expectation_type = camel_to_snake(class name)` for every non-abstract class and registers it; a class attribute `expectation_type` is overwritten (docstring says otherwise). Same on 1.9.3 | ran + source | `13`, `expectation.py` |
| `camel_to_snake("ExpectIDsToBeUnique")` is `expect_i_ds_to_be_unique`; `...UTF8` gives `..._utf8` | ran | `13` |
| A ColumnMapExpectation without `map_metric` is abstract and not registered | ran | `11` |
| Defining a class with the name of a built-in replaces it in `_registered_expectations`; only a WARNING (plus renderer warnings) is logged. Same on 1.9.3 | ran | `13` |
| Unknown type in the same process: `InvalidExpectationConfigurationError: Could not add expectation; provided configuration is not valid: <type> not found` | ran | `13` |
| `ExpectationSuite.__init__` catches that error, calls `logger.exception` and skips the expectation. A new process without the import loads 0 of 1 expectations and logs the ERROR three times in one load | ran + source | `13`, `expectation_suite.py` |
| Importing the module before `get_context()` loads 1 of 1 and the run evaluates it | ran | `13` |
| Defining a column-map metric registers 8 names under it: `.condition`, `.unexpected_count`, `.unexpected_count.aggregate_fn` (SQL only), `.unexpected_values`, `.unexpected_value_counts`, `.unexpected_index_list`, `.unexpected_index_query`, `.unexpected_rows` | ran | `11` |
| Metrics requested per result_format for a column-map expectation: BOOLEAN_ONLY 3, BASIC 4, SUMMARY 6, COMPLETE 6 (1.24.1 and 1.9.3 for the first three) | ran | `11` |
| The pandas wrapper drops null rows before the condition runs (`filter_column_isnull`, default True); the condition receives floats when a null forces a float column (`[2.0, 4.0, 7.0, 11.0]`) | ran + source | `11`, `column_condition_partial.py` |
| SQL unexpected-rows query is `WHERE n IS NOT NULL AND n % 2 != 0` | ran (SQLite) | `11` |
| Empty table, all-null column and all-valid data all give `success=True` (vacuous truth branch in `_validate`) | ran + source | `11` |
| `filter_column_isnull = False` with nulls: unexpected_count (3) exceeds the non-null count (2), percent 150, GX raises `InvalidCacheValueError` and the expectation returns `success=False` with `exception_info`. On 1.9.3 it also fails, with `Object of type int64 is not JSON serializable` | ran on both | `11` |
| A condition parameter must be in the metric's `condition_value_keys` and the expectation's `success_keys`; leaving it out of `success_keys` passes `None` and fails with `unsupported operand type(s) for %: 'int' and 'NoneType'`, `result={}`, no raise | ran | `11` |
| Column-pair expectation: the class needs an `ignore_row_if` field and it must be in `success_keys` when the metric lists it in `condition_domain_keys`; without it `result={}` and `Unrecognized value of ignore_row_if ("None")` in `exception_info` | ran | `12` |
| Multicolumn: `ignore_row_if="all_values_are_missing"` (default) skips the all-empty row, `"never"` counts it | ran (pandas) | `12` |
| Aggregate expectation from existing metrics (`column.min`, `column.max`) runs on pandas and SQLite with no SQL written; a metric with `column_aggregate_value` (pandas) and `column_aggregate_partial` (SQL) runs on both | ran | `12` |
| `UnexpectedRowsExpectation`: SQLite gives `observed_value` = row count, `COMPLETE` adds `details.unexpected_rows`; pandas gives `No provider found for unexpected_rows_query.table`; Spark provider exists in source only | ran / source | `12` |
| Same `column % 2 == 0` on a text column: pandas raises `TypeError` (string formatting, `result={}`), SQLite passes (`'a' % 2` is 0, `'7x' % 2` is 1) | ran | `14` |
| Empty table on SQLite gives `unexpected_count=None` (pandas gives 0), still `success=True` | ran | `14` |
| `examples` + `run_diagnostics()` ran 2 cases on pandas and sqlite (4 passed); it also tries other backends and prints connection failures | ran | `14` |
| CI guard (JSON expectation count vs loaded count) reports `2 on disk, 1 loaded -> MISSING CLASSES` for a suite with one custom and one built-in expectation | ran | `14` |
| `registry` holds 59 built-in expectation types after `import great_expectations.expectations` (1.24.1) | ran | `15` |
| `mostly=0.8` passes 5 of 6; `row_condition=Column("country") == "th"` checks 3 of 6 rows; `severity` gives `get_max_severity_failure()` | ran | `15` |
| Pydantic validation on a custom expectation: unknown argument, `mostly=1.5`, empty `column`, bad `severity` all raise `ValidationError` | ran | scratch |
| Not tried: table-level `BatchExpectation` subclass, `QueryExpectation` subclass, Spark conditions, Data Docs rendering of custom expectations, `condition_parser` string row conditions | not verified | |

## Actions, stores and Data Docs

| Finding | Level | Where |
|---|---|---|
| Actions run after all validations; `UpdateDataDocsAction` is moved to the front | ran / source | `06`, `checkpoint.py` |
| An action that raises makes `Checkpoint.run` raise, the actions after it do not run, the results are already stored and Data Docs (if first) already built | ran | `06`, scratch |
| `notify_on` is `all`, `success`, `failure`, or a failure severity | source | `should_notify` |
| Built-in actions in 1.24.1: Slack, Teams, PagerDuty, Opsgenie, Email, SNS, API, UpdateDataDocs | ran (dir of module) | scratch |
| File context layout (`gx/` with `great_expectations.yml`, `expectations/`, `checkpoints/`, `validation_definitions/`, `uncommitted/`); `gx/.gitignore` contains `uncommitted/` | ran | `06`, scratch |
| Data Docs: `uncommitted/data_docs/local_site/index.html`, `expectations/<suite>.html`, `validations/<suite>/__none__/<run>/<batch>.html` | ran | `06` |
| Stores are generic: a `Store` serializes GX objects over a `StoreBackend` (memory, file, S3, GCS, Azure, database, GX Cloud) | source | `data_context/store/` |

## GX 0.18 versus 1.x

0.18.21: `validator = context.sources.pandas_default.read_dataframe(df)`; `validator.expect_*` runs immediately and a
failing expectation is not kept in the suite (0 kept after 2 failures); a checkpoint refers to a suite by name and raises
`DataContextError` if it is not saved. 1.x: expectations are classes, objects are added to the context, runs go through
`ValidationDefinition` and `Checkpoint`. Ran in `08_legacy_018.py`.

## Catalog sizes (source, 1.9.3)

`expectations/core/` base classes: 26 column-map, 15 column-aggregate, 13 batch (table), 3 column-pair, 3 multicolumn,
plus query expectations. A column-map metric is one boolean condition per engine; `.condition`, `.unexpected_count`,
`.unexpected_values` and index metrics are derived from it (also ran: a custom one in `07`).

## Not verified

- Spark runtime behaviour. Only the source of the bundling was read; no Spark job was measured.
- Rendering internals, GX Cloud, the `profile` and `experimental` packages, most of the 60 built-in expectations.
- Substitution from `uncommitted/config_variables.yml` (only environment variables were tested).
- Orchestrators (Airflow, Dagster, Prefect): no integration was tried.
