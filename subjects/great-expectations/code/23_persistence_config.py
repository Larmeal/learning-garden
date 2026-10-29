"""Lesson: context-stores. A file context survives between processes, config_variables.yml substitution, and the
error you get when you ask for a cloud context without credentials.

Run: uv run python 23_persistence_config.py
"""

import os
import sqlite3
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

root = Path(tempfile.mkdtemp(prefix="gx_persist_"))
here = Path(__file__).parent

BUILD = textwrap.dedent(
    """
    import sys; sys.path.insert(0, {here!r})
    import great_expectations as gx, great_expectations.expectations as gxe, pandas as pd
    ctx = gx.get_context(mode="file", project_root_dir={root!r})
    src = ctx.data_sources.add_pandas("people_src")
    bdef = src.add_dataframe_asset("people").add_batch_definition_whole_dataframe("whole")
    suite = ctx.suites.add(gx.ExpectationSuite(name="people_suite"))
    suite.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="id"))
    vd = ctx.validation_definitions.add(gx.ValidationDefinition(name="people_vd", data=bdef, suite=suite))
    cp = ctx.checkpoints.add(gx.Checkpoint(name="people_cp", validation_definitions=[vd]))
    r = cp.run(batch_parameters={{"dataframe": pd.DataFrame({{"id": [1, 2]}})}})
    print("PROCESS A: ran, success =", r.success, "| results stored =", len(ctx.validation_results_store.list_keys()))
    """
)
LOAD = textwrap.dedent(
    """
    import sys; sys.path.insert(0, {here!r})
    import great_expectations as gx, pandas as pd
    ctx = gx.get_context(mode="file", project_root_dir={root!r})
    print("PROCESS B: loaded; suites =", [s.name for s in ctx.suites.all()], "| checkpoints =", [c.name for c in ctx.checkpoints.all()])
    cp = ctx.checkpoints.get("people_cp")
    r = cp.run(batch_parameters={{"dataframe": pd.DataFrame({{"id": [1, None]}})}})
    print("PROCESS B: ran the stored checkpoint, success =", r.success, "| results stored =", len(ctx.validation_results_store.list_keys()))
    """
)
py = sys.executable
for name, code in (("A", BUILD), ("B", LOAD)):
    out = subprocess.run([py, "-c", code.format(here=str(here), root=str(root))], capture_output=True, text=True, env={**os.environ, "PYTHONIOENCODING": "utf-8"})
    lines = [l for l in out.stdout.splitlines() if l.startswith("PROCESS")]
    print("\n".join(lines) or out.stderr[-400:])

import great_expectations as gx  # noqa: E402

print("\n--- config_variables.yml ---")
db = Path(tempfile.mkdtemp(prefix="gx_cfg_")) / "t.db"
con = sqlite3.connect(db)
con.execute("create table t (n int)")
con.execute("insert into t values (1)")
con.commit()
con.close()
ctx = gx.get_context(mode="file", project_root_dir=tempfile.mkdtemp(prefix="gx_cfgctx_"))
cfg = Path(ctx.root_directory) / "uncommitted" / "config_variables.yml"
print("config file exists:", cfg.exists())
cfg.write_text(f"MY_DB_URL: sqlite:///{db.as_posix()}\n", encoding="utf-8")
ctx2 = gx.get_context(mode="file", project_root_dir=Path(ctx.root_directory).parent)
os.environ.pop("MY_DB_URL", None)
src = ctx2.data_sources.add_sqlite("viafile", connection_string="${MY_DB_URL}")
asset = src.add_table_asset("t", table_name="t")
print("stored connection_string:", src.connection_string)
try:
    batch = asset.add_batch_definition_whole_table("w").get_batch()
    print("from the yml file       : batch rows =", batch.head().data.shape[0] if hasattr(batch.head(), "data") else "ok")
except Exception as e:  # noqa: BLE001
    print("from the yml file       :", type(e).__name__, "|", str(e).replace(chr(10), " ")[:140])

os.environ["MY_DB_URL"] = "sqlite:///does_not_exist_dir/none.db"
try:
    asset.add_batch_definition_whole_table("w2").get_batch()
    print("env var set to a bad url: worked")
except Exception as e:  # noqa: BLE001
    print("env var set to a bad url:", type(e).__name__, "|", str(e).replace(chr(10), " ")[:120], "<- env var wins over the file")

print("\n--- mode=cloud without credentials ---")
for k in [k for k in os.environ if k.startswith("GX_CLOUD")]:
    os.environ.pop(k)
try:
    gx.get_context(mode="cloud")
except Exception as e:  # noqa: BLE001
    print(type(e).__name__, "|", str(e).replace(chr(10), " ")[:200])
