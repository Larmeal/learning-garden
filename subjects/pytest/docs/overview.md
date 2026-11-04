# Pytest subject

Eight lessons (Thai and English), each with a quiz, built on one small code base: a shopping cart in
`code/src/shop/`. Every number that a lesson prints (tests collected, passed, skipped, deselected, coverage lines) comes
from a real run with **Pytest 9.2.0** on Python 3.14 (the environment `uv sync` creates; `requires-python` is 3.12 or
newer). `code/verify.py` re-runs everything and fails if a stated number changes.

| # | Lesson | Phase | Exercise | Shows |
|---|---|---|---|---|
| 1 | `first-test` | A | `exercises/01_first_test`, `demos/01_failures` | discovery rules, `. F E`, exit codes, reading a traceback |
| 2 | `assertions` | A | `exercises/02_assertions`, `demos/02_assertions` | assert introspection, `approx`, `raises`, `warns` |
| 3 | `fixtures` | B | `exercises/03_fixtures` | fixtures, `yield`, scope, `conftest.py`, `tmp_path`, `autouse`, factory, params |
| 4 | `parametrize` | B | `exercises/04_parametrize` | `parametrize`, ids, stacking, `pytest.param` |
| 5 | `markers` | B | `exercises/05_markers`, `demos/05_markers` | `skip`, `skipif`, `xfail`, strict, custom marks, `-m` |
| 6 | `isolation` | C | `exercises/06_isolation` | `monkeypatch`, `unittest.mock`, patch where used, fakes, `capsys`, `caplog` |
| 7 | `project` | C | `verify.py` (command-line checks) | config in `pyproject.toml`, `-k`, `-m`, `-x`, `--lf`, `-n`, `--cov`, `--setup-show` |
| 8 | `test-design` | D | `exercises/08_design`, `demos/08_order_dependent` | AAA, behaviour over internals, boundaries, shared state, capstone |

## Layout

- `exercises/NN_name/`: tests that must pass (some are skipped or xfailed on purpose). Run one with
  `uv run pytest exercises/03_fixtures`.
- `demos/NN_name/`: tests that fail on purpose, kept out of `testpaths` so a plain `uv run pytest` is green.
  `verify.py` states how many failures each one must produce.
- `src/shop/`: the code under test. `net.py` raises `ConnectionError` so a test that forgets to replace the network
  fails loudly instead of calling out.

## Run

```
cd subjects/pytest/code
uv sync
uv run pytest              # exercises only, 85 passed, 2 skipped, 3 xfailed
uv run python verify.py    # exercises, demos and the command-line checks (add --show to print the raw output)
```

## Not covered (possible next work)

Hypothesis and property-based testing, `pytest-mock`, `pytest-asyncio`, writing a plugin or hook, `pytest-randomly`,
doctest and unittest interop, snapshot testing. Labs: none yet (the lessons are text, code and output).
