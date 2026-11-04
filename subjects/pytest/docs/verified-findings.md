# Verified findings (Pytest)

Every statement in a lesson is tagged **ran** (produced by `code/` with Pytest 9.2.0 on Python 3.14), **source** (read in the
pytest 9.2.0 source, by function name; the knowledge graph in `graphs/pytest-current/` is the map) or **author** (the
lesson author's advice or framing). No book or web page was used. `code/verify.py` re-checks every number below and
exits non-zero if one changes.

| Lesson | Claim | Tag | Where |
|---|---|---|---|
| first-test | 6 tests collected; `cart_extra.py`, `make_cart`, `check_total_is_ten` are not | ran | `exercises/01_first_test`, `verify.py` |
| first-test | `*_test.py` is collected as well as `test_*.py` | ran | `discount_test.py` |
| first-test | a file named on the command line is collected whatever its name (1 failed) | ran | `verify.py` |
| first-test | `FFFE`, 3 failed + 1 error; text of the four traceback kinds | ran | `demos/01_failures` |
| first-test | exit code 0 (pass), 1 (fail), 5 (nothing selected) | ran | `verify.py` |
| assertions | `0.1 + 0.2 != 0.3`; `approx` default tolerance prints `0.3 ± 3.0e-07` | ran | `exercises/02_assertions`, `demos/02_assertions` |
| assertions | `raises`: type, `match` is a search, `info.value`, subclass, lines before the raising line still run, `DID NOT RAISE` | ran | `exercises/02_assertions`, `demos/02_assertions` |
| assertions | `warns`, and `simplefilter("error")` to assert no warning | ran | `exercises/02_assertions` |
| assertions | dict, string and approx diffs | ran | `demos/02_assertions` |
| fixtures | fresh fixture per test, conftest, `tmp_path`, factory, autouse, params (12 passed from 11 functions) | ran | `exercises/03_fixtures/test_fixtures.py` |
| fixtures | nearest `conftest.py` wins, a fixture in the test file wins over both | ran | `exercises/03_fixtures/nested` |
| fixtures | setup/teardown order and scope letters in `--setup-show`; module scope connects once | ran | `exercises/03_fixtures`, `verify.py` |
| fixtures | teardown after `yield` runs when the test fails | ran | `demos/03_teardown` |
| parametrize | 4 tests from a 4-row table, ids, custom ids, stacking 3x2 = 6 with `total` first in the id, xfail row | ran | `exercises/04_parametrize` |
| parametrize | a wrong row fails alone (1 failed, 2 passed) | ran | `demos/04_one_row_fails` |
| markers | 10 tests = 6 passed, 2 skipped, 2 xfailed; `-m` results 4/2/2/2, 2/8, 1/9 | ran | `exercises/05_markers`, `verify.py` |
| markers | strict xfail that passes becomes a failure; unknown mark is a warning; `--strict-markers` fails collection | ran | `demos/05_markers`, `verify.py` |
| isolation | unpatched network call raises `ConnectionError`; `monkeypatch` restores; patching `net.fetch_json` does not affect `rates` | ran | `exercises/06_isolation` |
| isolation | fake and `mock.Mock` gateways both work; `capsys`, `caplog`, time as an argument, replacing `datetime` | ran | `exercises/06_isolation` |
| project | removing `pythonpath` breaks `import shop` at collection | ran | `verify.py` |
| project | plain `pytest` = 188 passed, 3 skipped, 6 xfailed; `-k coupon` on `test_parametrize.py` = 3 passed, 19 deselected | ran | `verify.py` |
| project | `-x`, `--lf`, `--ff` on `demos/01_failures`; `-n 2` gives the same result as serial | ran | `verify.py` |
| project | coverage table: `cart.py` 100%, only line 21 of `pricing.py` is missing | ran | `verify.py` |
| test-design | 12 tests in `08_design` pass, boundary values, failure paths | ran | `exercises/08_design` |
| test-design | order-dependent pair: 2 passed together, `test_total` alone fails | ran | `demos/08_order_dependent`, `verify.py` |
| all | what makes a good test, brittle versus robust, advice on mocks, coverage, skips and strict xfail, folder layout | author | |

## Added with the deeper pass (2026-11-05)

Where a claim is `source` only, the lesson names the function in `_pytest/` and does not use line numbers.

| Lesson | Claim | Tag | Where |
|---|---|---|---|
| first-test (in-depth) | sizes of `--tb` styles (39, 24, 17, 12 lines), `-v/-q/-qq`, `-l`, `--durations`, `--maxfail`, `-r` | ran | `internals/08_output_flags.py` |
| first-test (in-depth) | exit codes 0 to 5 and their causes | ran + source | `internals/01_startup.py`, `11_hook_validation.py`, `12_collection_options.py`, `ExitCode` in `config/__init__.py` |
| assertions (in-depth) | excinfo, `check=`, exception groups, `group_contains`, warns as a list, outcomes, `__tracebackhide__`, approx corners | ran | `exercises/02_assertions/test_assertions_in_depth.py` |
| fixtures (in-depth) | `request`, indirect, `addfinalizer` order, `getfixturevalue`, `usefixtures`, `name=`, computed scope | ran | `exercises/03_fixtures/test_fixtures_in_depth.py` |
| parametrize (in-depth) | `ids=` forms, auto ids (`x5`), `pytest_generate_tests`, build order of param fixtures, empty set | ran | `exercises/04_parametrize/test_parametrize_in_depth.py` |
| markers (in-depth) | `pytestmark`, `iter_markers` order `[3, 2, 1]`, `-m` grammar, `-k` ignores case, xfail forms | ran | `exercises/05_markers/test_marks_in_depth.py` |
| isolation (in-depth) | spec and autospec, `side_effect`, `call_args_list`, `patch.dict`, monkeypatch methods, network guard | ran | `exercises/06_isolation/test_mocking_in_depth.py` |
| project (in-depth) | config file precedence, empty `pytest.ini`, rootdir, `-o`, `PYTEST_ADDOPTS`, unknown key, import modes, conftest layering | ran | `internals/09_config_layout.py` |
| builtin-plugins | capture levels, log level default, warnings, `.pytest_cache`, `--lf/--ff/--sw`, junitxml, subtests | ran | `internals/10_builtin_plugins.py` |
| how-pytest-runs | 39 hook calls for two tests, 30 default plugins, 5 essential, `-p no:` rules, hook validation | ran | `internals/01_startup.py`, `02_hook_order.py`, `11_hook_validation.py` |
| how-pytest-runs | `_main`, `wrap_session`, `ExitCode`, `firstresult` and `historic` hooks | source | `config/__init__.py`, `main.py`, `hookspec.py` |
| collection | node tree, naming rules, custom patterns, `norecursedirs`, `--ignore`, `--deselect`, collection errors | ran | `internals/03_collection_tree.py`, `12_collection_options.py` |
| collection | `Session.collect` walk, `pytest_collect_directory`, `_genfunctions`, `Metafunc` | source | `main.py`, `python.py` |
| fixture-engine | closure order, cached exception, override asking its own name, ScopeMismatch, teardown errors, `SetupState` log | ran | `internals/04_setupstate.py`, `13_fixture_engine.py` |
| fixture-engine | `FixtureDef.execute` four steps, `SetupState.teardown_exact` | source | `fixtures.py`, `runner.py` |
| run-protocol | nine kinds of report and the summary counts | ran | `internals/05_reports.py` |
| run-protocol | `runtestprotocol`, `CallInfo`, the xfail wrapper on `makereport`, `nextitem = None` on stop | source | `runner.py`, `skipping.py` |
| assertion-rewriting | rewritten code, files that are and are not rewritten, `register_assert_rewrite`, `PYTEST_DONT_REWRITE`, `--assert=plain`, `.pyc` name | ran | `internals/06_rewrite.py` |
| plugins | a 76-line plugin, pytester tests, hook call order, entry-point loading, `PYTEST_DISABLE_PLUGIN_AUTOLOAD` | ran | `plugins/shop_plugin.py`, `exercises/09_plugins`, `internals/07_entry_point.py`, `14_hook_order_control.py` |
| test-design (in-depth) | five smells and their fixes, flaky counter | ran | `exercises/08_design/test_smells.py` |

Not verified by a run (tagged author or source only in the lessons): the `-r` letters other than `f E s`, `--tb=auto`,
`PYTEST_PLUGINS`, `--runxfail`, `cache.get/set`, `--nf`, the import-mode limits of `importlib`.

## Not checked

- Behaviour on other Pytest versions. The lessons name 9.2.0; older versions may print slightly different text.
- Windows paths appear in some quoted output (`src\shop\cart.py`). On Linux and macOS they use `/`.
- The pages were built (`npm run build`) but not looked at in a browser, and the quizzes were not clicked through.
- Internal links between pytest lessons were checked against the ids in the built pages (152 links, 0 broken at the time).
