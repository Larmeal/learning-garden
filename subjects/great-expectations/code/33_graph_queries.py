"""Lesson: internals. Questions the knowledge graph of GX 1.9.3 can answer, asked with a few lines of Python.

Run: uv run python 33_graph_queries.py [output.json]
"""

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

G = Path(__file__).resolve().parents[1] / "graphs" / "gx-current" / "knowledge-graph.json"
g = json.loads(G.read_text(encoding="utf-8"))
nodes = {n["id"]: n for n in g["nodes"]}
print("nodes:", len(g["nodes"]), "| edges:", len(g["edges"]), "| layers:", len(g["layers"]), "| tour steps:", len(g["tour"]))

print("\n--- 1. layers ---")
layers = [{"name": l["name"], "nodes": len(l["nodeIds"])} for l in g["layers"]]
for l in layers:
    print(f"  {l['name']:34} {l['nodes']}")

print("\n--- 2. the most imported files ---")
imported = Counter(e["target"] for e in g["edges"] if e["type"] == "imports" and e["target"].startswith("file:"))
top = [(t.removeprefix("file:great_expectations/"), n) for t, n in imported.most_common(8)]
for name, n in top:
    print(f"  {n:4} {name}")

print("\n--- 3. who imports validation_definition.py ---")
target = "file:great_expectations/core/validation_definition.py"
who = sorted(e["source"].removeprefix("file:great_expectations/") for e in g["edges"] if e["type"] == "imports" and e["target"] == target)
print(f"  {len(who)} files:", who[:10])

print("\n--- 4. an inheritance chain ---")
parent = defaultdict(list)
for e in g["edges"]:
    if e["type"] == "inherits":
        parent[e["source"]].append(e["target"])
start = next((i for i, n in nodes.items() if n["type"] == "class" and n["name"] == "ExpectColumnValuesToNotBeNull"), None)
chain, cur, seen = [], start, set()
while cur and cur not in seen:
    seen.add(cur)
    chain.append(nodes[cur]["name"] if cur in nodes else cur)
    nxt = parent.get(cur, [])
    cur = nxt[0] if nxt else None
print("  " + " -> ".join(chain))

print("\n--- 5. the tour the graph carries ---")
for t in g["tour"]:
    print(f"  {t['order']:2}. {t['title']}")

print("\n--- 6. what the graph does not have ---")
print("  calls edges:", sum(1 for e in g["edges"] if e["type"] == "calls"), "of", len(g["edges"]))

if len(sys.argv) > 1:
    Path(sys.argv[1]).write_text(json.dumps({"layers": layers, "top_imported": [{"file": n, "count": c} for n, c in top]}, ensure_ascii=False, indent=1), encoding="utf-8")
    print("wrote", sys.argv[1])
