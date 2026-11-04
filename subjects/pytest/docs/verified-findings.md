# Verified findings (Pytest)

Every statement in a lesson is tagged **ran** (produced by `code/` with Pytest 9.2.0 on Python 3.14), or **author** (the
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
| project | plain `pytest` = 85 passed, 2 skipped, 3 xfailed; `-k coupon` = 3 passed, 19 deselected | ran | `verify.py` |
| project | `-x`, `--lf`, `--ff` on `demos/01_failures`; `-n 2` gives the same result as serial | ran | `verify.py` |
| project | coverage table; Missing line 34 of `cart.py`, line 21 of `pricing.py` | ran | `verify.py` |
| test-design | 12 tests in `08_design` pass, boundary values, failure paths | ran | `exercises/08_design` |
| test-design | order-dependent pair: 2 passed together, `test_total` alone fails | ran | `demos/08_order_dependent`, `verify.py` |
| all | what makes a good test, brittle versus robust, advice on mocks, coverage, skips and strict xfail, folder layout | author | |

## Not checked

- Behaviour on other Pytest versions. The lessons name 9.2.0; older versions may print slightly different text.
- Windows paths appear in some quoted output (`src\shop\cart.py`). On Linux and macOS they use `/`.
- The pages were built (`npm run build`) but not looked at in a browser, and the quizzes were not clicked through.
