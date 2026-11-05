"""Helpers shared by the exercises: a session, explain() as a string, and a few plan readers."""

import contextlib
import io
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from spark_session import get_spark  # noqa: E402,F401

JOIN_NODES = ["BroadcastHashJoin", "SortMergeJoin", "ShuffledHashJoin", "CartesianProduct", "BroadcastNestedLoopJoin"]


def explain(df, mode=None):
    """What df.explain(...) prints. PySpark prints from Python, so stdout can be captured."""
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        if mode is None:
            df.explain()
        else:
            df.explain(mode)
    return buf.getvalue()


def final_part(text):
    """The Final Plan half of an AQE plan after the DataFrame ran (the whole text when AQE did not apply)."""
    return text.split("== Initial Plan ==")[0]


def join_info(plan_text):
    """(node, build side or None, join type or None) of the first join operator in a plan string."""
    for node in JOIN_NODES:
        m = re.search(rf"{node}\b([^\n]*)", plan_text)
        if m:
            rest = m.group(1)
            side = re.search(r"Build(Left|Right)", rest)
            jt = re.search(r"\b(Inner|LeftOuter|RightOuter|FullOuter|LeftSemi|LeftAnti|Cross)\b", rest)
            return node, side.group(1) if side else None, jt.group(1) if jt else None
    return None, None, None


def partition_sizes(df):
    """Rows per partition, in partition order."""
    return df.rdd.glom().map(len).collect()


def relaunch_in_wsl_if_windows(script_path):
    """On Windows run `script_path` again inside WSL through run_wsl.sh and exit with its status.

    Hadoop cannot write local files on Windows without hadoop.dll, so exercises that save models, tables or
    checkpoints run in WSL (one-time setup is described in run_wsl.sh). Call it before importing pyspark.
    """
    if os.name != "nt":
        return
    import subprocess

    code_dir = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(script_path)), ".."))
    drive, rest = os.path.splitdrive(code_dir)
    wsl_dir = "/mnt/" + drive[0].lower() + rest.replace("\\", "/")
    name = os.path.basename(script_path)
    cmd = f"cd '{wsl_dir}' && ./run_wsl.sh exercises/{name}"
    out = subprocess.run(["wsl.exe", "-d", "Ubuntu", "--", "bash", "-lc", cmd], capture_output=True, text=True)
    print(out.stdout.replace("\x00", "")[-3000:])
    if out.returncode != 0:
        print(out.stderr.replace("\x00", "")[-2000:])
    raise SystemExit(out.returncode)
