# Sources

No book was used. Everything is **ran** (an exercise asserts it), **source** (read in the Polars checkout) or **author**.

- Polars source: `E:\Development\Project\open-source\polars`, shallow clone of tag `py-2.1.0` (not part of this repo).
  Files read: `crates/polars-plan/src/plans/optimizer/mod.rs` (order of optimizer rules), `crates/polars-config/src/lib.rs`
  (`DEFAULT_IDEAL_MORSEL_SIZE = 100_000`, `POLARS_IDEAL_MORSEL_SIZE`), `crates/polars-stream/src/nodes/` (file names of the nodes),
  `py-polars/src/polars/lazyframe/frame.py` (docstring of `explain`: `engine="auto"` falls back to `"streaming"`),
  `py-polars/src/polars/dataframe/frame.py` (`explode` defaults `empty_as_null=False`, `keep_nulls=True`).
- Versions: Polars 2.1.0, pandas 3.1.1, pyarrow 26.0.1, numpy 2, psutil 7.2.2 (see `code/pyproject.toml` and `uv.lock`).
- Machine of the timings: one Windows 11 computer with 16 threads. All timings are minimums of 2 to 3 runs and are printed, never asserted as exact numbers.
