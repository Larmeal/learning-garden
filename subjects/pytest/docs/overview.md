# Pytest subject

Fifteen lessons (Thai and English), each with a quiz, and eight of them with an `in-depth` sub-page. Built on one small
code base, a shopping cart in `code/src/shop/`. Every number a lesson prints comes from a real run with **Pytest 9.2.0**
(Python 3.14 in the `uv` environment, `requires-python` 3.12 or newer). The lessons on pytest internals also cite
functions of the pytest 9.2.0 source (`E:\Development\Project\open-source\pytest`, tag `9.2.0`, commit `ae1d0ff`), which
is what the knowledge graph in `graphs/pytest-current/` covers (`src/` only, 81 files). Function and file names are cited,
not line numbers.

| # | Lesson | Phase | Main exercise | Sub-page |
|---|---|---|---|---|
| 1 | `first-test` | A | `exercises/01_first_test`, `demos/01_failures` | `in-depth`: output flags, `--tb`, exit codes (`internals/08_output_flags.py`) |
| 2 | `assertions` | A | `exercises/02_assertions/test_assertions.py` | `in-depth`: excinfo, exception groups, outcomes, approx corners |
| 3 | `fixtures` | B | `exercises/03_fixtures/test_fixtures.py` | `in-depth`: request, indirect, finalizers, getfixturevalue |
| 4 | `parametrize` | B | `exercises/04_parametrize/test_parametrize.py` | `in-depth`: ids, `pytest_generate_tests`, empty sets |
| 5 | `markers` | B | `exercises/05_markers/test_markers.py` | `in-depth`: marks on classes, `-m`/`-k` grammar, xfail forms |
| 6 | `isolation` | C | `exercises/06_isolation/test_isolation.py` | `in-depth`: autospec, side_effect, network guard |
| 7 | `project` | C | `verify.py` | `in-depth`: config precedence, rootdir, import modes (`internals/09_config_layout.py`) |
| 8 | `builtin-plugins` | C | `internals/10_builtin_plugins.py` | capture, logging, warnings, cache, junitxml, subtests |
| 9 | `how-pytest-runs` | D | `internals/01_startup.py`, `02_hook_order.py`, `11_hook_validation.py` | |
| 10 | `collection` | D | `internals/03_collection_tree.py`, `12_collection_options.py` | |
| 11 | `fixture-engine` | D | `internals/04_setupstate.py`, `13_fixture_engine.py` | |
| 12 | `run-protocol` | D | `internals/05_reports.py` | |
| 13 | `assertion-rewriting` | D | `internals/06_rewrite.py` | |
| 14 | `plugins` | E | `plugins/shop_plugin.py`, `exercises/09_plugins`, `internals/07_entry_point.py`, `14_hook_order_control.py` | |
| 15 | `test-design` | E | `exercises/08_design/test_design.py`, `demos/08_order_dependent` | `in-depth`: five test smells (`test_smells.py`) |

## Layout

- `exercises/NN_name/`: tests that must pass (some skip or xfail on purpose). A folder may hold a main file and a
  `*_in_depth.py` file; the lessons name the file.
- `demos/NN_name/`: tests that fail on purpose, outside `testpaths`.
- `internals/NN_*.py`: scripts that build a throwaway project, run pytest on it (in-process through `pytest.main`, or in a
  fresh interpreter with `run_sub`) and assert what a lesson states. `_lab.py` holds the helpers.
- `plugins/shop_plugin.py`: the plugin of lesson 14. `conftest.py` at the code root loads `pytester`.
- `src/shop/`: the code under test. `net.py` raises `ConnectionError` so a test that forgets to replace the network fails.

## Run

```
cd subjects/pytest/code
uv sync
uv run pytest              # exercises only: 188 passed, 3 skipped, 6 xfailed
uv run python verify.py    # exercises, demos, command-line checks and every internals script (--show prints raw output)
```

## Not covered (possible next work)

Hypothesis and property-based testing, `pytest-mock`, `pytest-asyncio`, writing a plugin that adds a collector or a new
item type, `pytest-randomly`, doctest and unittest interop, snapshot testing, Windows versus Linux differences in the
quoted output. Labs: none yet (the lessons are text, code and output). Quizzes of the older lessons (1 to 7 and 15) were
not extended for their new `in-depth` pages.
