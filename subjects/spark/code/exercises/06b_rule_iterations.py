"""Chapter 6 (in depth): how many rounds does a FixedPoint batch of the Optimizer run?

RuleExecutor runs a batch again and again until the plan stops changing (`curPlan.fastEquals(lastPlan)`) and says so at
TRACE level: "Fixed point reached for batch X after N iterations". This exercise turns TRACE on around the analysis and
optimization of three queries, reads those lines from the JVM's stderr and prints the batches that needed more than one
round. The lab "RuleLoopLab" quotes these numbers.

On Windows it re-launches itself in WSL (stderr redirection of the JVM is simpler on Linux and Hadoop is not needed).
"""

import os
import re
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from common import relaunch_in_wsl_if_windows  # noqa: E402

relaunch_in_wsl_if_windows(__file__)

# The JVM inherits file descriptor 2, so point it at a file before Spark starts.
log = tempfile.NamedTemporaryFile(delete=False, suffix=".log")
os.dup2(log.fileno(), 2)

from common import get_spark  # noqa: E402

spark = get_spark()
spark.range(0, 1000, 1, 16).createOrReplaceTempView("nums")
spark.sql("CREATE OR REPLACE TEMP VIEW v AS SELECT id, id * 2 AS dbl FROM nums")
spark.range(0, 100000, 1, 8).selectExpr("id AS oid", "id % 100 AS cid", "id % 5 AS status", "id * 3 AS total").createOrReplaceTempView("orders")
spark.range(0, 100).selectExpr("id AS cid", "concat('n', id) AS name").createOrReplaceTempView("customers")

QUERIES = {
    "view": "SELECT id + (1 + 2) AS x FROM v WHERE 1 = 1 AND id > 10",
    "join": "SELECT c.name, o.total FROM orders o JOIN customers c ON o.cid = c.cid WHERE o.status = 3",
    "nested": (
        "SELECT x FROM (SELECT y + 1 AS x FROM (SELECT z + 1 AS y FROM (SELECT id + 1 AS z FROM nums WHERE id > 5) WHERE z < 100) "
        "WHERE y > 0) WHERE x > 1"
    ),
}

for name, sql in QUERIES.items():
    spark._jvm.System.err.println(f"@@@ {name}")
    spark._jvm.System.err.flush()
    spark.sparkContext.setLogLevel("TRACE")
    spark.sql(sql)._jdf.queryExecution().optimizedPlan()
    spark.sparkContext.setLogLevel("WARN")
# The plan change log lists every rule that changed the plan, in order, so the rounds of the nested query can be read.
spark.conf.set("spark.sql.planChangeLog.level", "WARN")
spark._jvm.System.err.println("@@@ changelog")
spark._jvm.System.err.flush()
spark.sql(QUERIES["nested"])._jdf.queryExecution().optimizedPlan()
spark._jvm.System.err.println("@@@ end")
spark._jvm.System.err.flush()
spark.stop()

text = open(log.name, encoding="utf-8", errors="replace").read()
changelog = text.split("@@@ changelog")[1].split("@@@ end")[0]
rounds = {}
current = None
for line in text.splitlines():
    m = re.match(r"@@@ (\w+)", line)
    if m:
        current = m.group(1)
        rounds[current] = {"analyzer": [], "optimizer": []}
        continue
    m = re.search(r"TRACE BaseSessionStateBuilder\$\$anon\$(\d): Fixed point reached for batch (.+?) after (\d+) iterations", line)
    if m and current in rounds:
        kind = "analyzer" if m.group(1) == "1" else "optimizer"
        rounds[current][kind].append((m.group(2), int(m.group(3))))

for name in QUERIES:
    print(f"== {name}: {QUERIES[name]}")
    for kind in ("analyzer", "optimizer"):
        many = [(b, n) for b, n in rounds[name][kind] if n > 1]
        total = len(rounds[name][kind])
        print(f"   {kind}: {total} batches reported a fixed point; more than one round: {many}")

before = "Operator Optimization before Inferring Filters"
after = "Operator Optimization after Inferring Filters"
opt = {n: dict(rounds[n]["optimizer"]) for n in QUERIES}
assert opt["view"][before] == 2, opt["view"]
assert opt["join"][before] == 2 and opt["join"][after] == 2, opt["join"]
assert opt["nested"][before] == 4, opt["nested"]
analyzer_nested = dict(rounds["nested"]["analyzer"])
assert analyzer_nested["Resolution"] == 9, analyzer_nested

# Effective rules of the batch, in order: a name that repeats or goes back in the list starts a new round.
batch_text = changelog.split("=== Result of Batch " + before)[0]
names = re.findall(r"=== Applying Rule org\.apache\.spark\.sql\.catalyst\.optimizer\.(\w+)", batch_text)
start = names.index("PushDownPredicates")
effective = names[start:]
print("effective rules of the batch, in order:", effective)
assert effective == [
    "PushDownPredicates", "CollapseProject", "ConstantFolding", "ReorderAssociativeOperator",
    "PushDownPredicates", "CollapseProject", "ConstantFolding", "ReorderAssociativeOperator",
    "ConstantFolding",
], effective
# 4 rounds = round 1 (four effective rules), round 2 (four), round 3 (ConstantFolding only), round 4 (none: fixed point).

# A batch of FixedPoint runs at least twice when its first round changed the plan: the second round only proves nothing
# changed any more.
print("ok")
