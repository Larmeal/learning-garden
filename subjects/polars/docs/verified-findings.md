# Verified findings

Tags: **ran** = asserted by `code/exercises/NN_*.py` (`uv run python verify.py`); **source** = read in the Polars checkout at tag `py-2.1.0`; **author** = advice or inference.
Tested with Polars 2.1.0 (Windows, no WSL needed).

| Lesson | Claim | Tag |
|---|---|---|
| 1 | `pl.Series([1, 2.5])` raises TypeError; `strict=False` gives Float64; `["a", None]` is String; all-None is Null | ran 01 |
| 1 | DataFrame has no index; `row(by_predicate=...)`; with_columns leaves the original unchanged | ran 01 |
| 1 | an untouched column shares its values buffer (same address through pyarrow), a recomputed one does not | ran 01 |
| 2 | expression prints as a description; `meta.root_names`, `meta.output_name` | ran 02 |
| 2 | select, with_columns, filter, group_by shape; broadcast of a scalar; ShapeError for 3 against 8 | ran 02 |
| 2 | expressions in one call cannot see each other (ColumnNotFoundError); `when` order matters with null | ran 02 |
| 3 | failing cast raises InvalidOperationError, `strict=False` gives null, float to int truncates, `//` rounds down | ran 03 |
| 3 | Int8 `+` wraps (100+100 = -56), `sum()` gives 200 | ran 03 |
| 3 | comparison with null is null; filter keeps only True; `ne_missing`, `eq_missing`; NaN equals NaN; mean skips null not NaN | ran 03 |
| 3 | sum of all-null is 0; sort puts null first; Decimal, Categorical, Enum, byte length of Thai, weekday, time zone | ran 03 |
| 4 | group_by table, len against count, window `over`, running sum and shift per group, pivot fills 0, unpivot 12 rows, weekly buckets | ran 04 |
| 5 | join counts inner 7, left 8, right 8, full 9, semi 7, anti 1, cross 16; duplicate key gives 11; `validate="m:1"` raises; null keys; suffix; `join_where`; `join_asof`; concat | ran 05 |
| 5 | order of rows after a join is not promised without `maintain_order` | author |
| 6 | LazyFrame schema known before collect; plans before and after (`PROJECT 4/7`, `SELECTION`); flags off change the plan, not the answer; merged with_columns; CSE; SLICE | ran 06 |
| 6 | `profile()` removed in 2.0 | ran 06 |
| 6 | `engine="auto"` falls back to streaming; optimizer rule order | source |
| 7 | CSV inference limits; Parquet statistics (1, 5, 1); sizes 40.5 / 6.3 / 21.4 / 68.0 MB; row groups of a sorted and a shuffled file; hive folders prune to one scan; sink; glob | ran 07 |
| 7 | the scan skips row groups by statistics when reading | author (not measured) |
| 8 | List, explode options, Struct, string and regex expressions, `map_elements` warning | ran 08 |
| 8 | `map_elements` about 6 times slower than an expression for `upper` (one computer) | ran 08 (timed) |
| 9 | group_by 18 to 24 times faster than pandas; Parquet scan about 7 times, CSV about 1.1 to 1.4; threads 1, 4, 16 give 0.25, 0.10, 0.077 s; peak memory 438 against 400 MB | ran 09 (timed) |
| 10 | validity bitmap `01111111`; size of Int64, Int8, Bool, with a null; string layouts; zero copy; chunks; Categorical and Enum physical | ran 10 |
| 10 | streaming calls 56 (largest 121,952), morsel 20,000 gives 256 (largest 20,326), in-memory 41 | ran 10 |
| 10 | default morsel size 100,000; node file names | source |
| 11 | pandas against Polars on four questions agree; integer becomes float64 in pandas; comparison with missing; `from_pandas` NaN to null; AttributeError of pandas-only calls | ran 11 |
| 12 | planted defects found exactly (150, 250, 500, 200, 100, raw region 300); 98,950 clean rows; tier report; 6 of 7 columns read; written Parquet types | ran 12 |
| 12 | keep dropped rows as a quarantine, keep check numbers as history | author |
