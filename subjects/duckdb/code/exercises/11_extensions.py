"""Lesson 11: extensions. The core is small, and file formats, remote storage and other databases are loaded on demand. One of them lets a query read a Parquet file over HTTP by asking for byte ranges.

Asserts which extensions are built into the 1.5.6 Python package and which are not, that INSTALL downloads an extension once and LOAD turns it on, that `httpfs` reads a Parquet file from a web server
by byte ranges (a count of rows needs the footer only, a sum of one column needs that column of every row group, a filter on the sorted column needs the column of one row group, `select *` needs the whole file),
that the SQLite scanner reads a SQLite file in place and joins it with a Parquet file, and that the full-text search extension ranks documents. INSTALL needs the internet the first time; later runs use the copy
in `~/.duckdb/extensions`. `--write` saves the byte counts for RangeReadLab (`ranges.json`).
"""

import re
import sqlite3
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ddb import LABS, check, connect, fresh_dir, main_guard, make_shop, show, table, write_json  # noqa: E402

WRITE = "--write" in sys.argv


class RangeHandler(BaseHTTPRequestHandler):
    """A web server for one folder that understands `Range: bytes=a-b`, and counts what it sends."""

    root: Path
    log: list = []

    def log_message(self, *a):  # keep the output clean
        pass

    def _file(self):
        return self.root / self.path.lstrip("/")

    def do_HEAD(self):
        f = self._file()
        self.send_response(200)
        self.send_header("Content-Length", str(f.stat().st_size))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()

    def do_GET(self):
        f = self._file()
        size = f.stat().st_size
        rng = self.headers.get("Range")
        if rng:
            a, b = re.match(r"bytes=(\d*)-(\d*)", rng).groups()
            if a == "":
                start, end = max(0, size - int(b)), size - 1
            else:
                start, end = int(a), min(int(b), size - 1) if b else size - 1
            with open(f, "rb") as fh:
                fh.seek(start)
                data = fh.read(end - start + 1)
            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        else:
            data = f.read_bytes()
            self.send_response(200)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()
        self.wfile.write(data)
        RangeHandler.log.append(len(data))


def main() -> None:
    work = fresh_dir("11")
    con = connect()

    # ---- 1. what is built in ----
    ext = {r[0]: (r[1], r[3]) for r in con.sql("select extension_name, loaded, installed, install_mode from duckdb_extensions()").fetchall()}
    built = sorted(k for k, v in ext.items() if v[1] == "STATICALLY_LINKED")
    show("extensions built into the package", ", ".join(built))
    check("four are built in: core_functions, icu, json and parquet", built == ["core_functions", "icu", "json", "parquet"], str(built))
    check("httpfs, sqlite_scanner and fts are listed but are not built in (a download, once per computer)", all(ext[e][1] != "STATICALLY_LINKED" for e in ("httpfs", "sqlite_scanner", "fts")))
    check("the extension repository lists 30 extensions in this release", len(ext) == 30, str(len(ext)))
    make_shop(con)
    pq = work / "orders.parquet"
    con.execute(f"copy orders to '{pq.as_posix()}' (format parquet)")
    check("Parquet and JSON work without any INSTALL", con.sql(f"select count(*) from '{pq.as_posix()}'").fetchone()[0] == 1_000_000)

    # ---- 2. INSTALL and LOAD ----
    for name in ("httpfs", "sqlite_scanner", "fts"):
        con.execute(f"install {name}")
        con.execute(f"load {name}")
    now = {r[0]: r[1] for r in con.sql("select extension_name, loaded from duckdb_extensions() where extension_name in ('httpfs', 'sqlite_scanner', 'fts')").fetchall()}
    check("after INSTALL and LOAD the three are loaded", now == {"httpfs": True, "sqlite_scanner": True, "fts": True}, str(now))
    check("an installed extension is a file on disk", any((Path.home() / ".duckdb" / "extensions").rglob("httpfs.duckdb_extension")))

    # ---- 3. read a Parquet file over HTTP ----
    RangeHandler.root = work
    server = ThreadingHTTPServer(("127.0.0.1", 0), RangeHandler)
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{port}/orders.parquet"
    size = pq.stat().st_size

    def served(sql: str) -> dict:
        RangeHandler.log = []
        c = connect()
        c.execute("load httpfs")
        c.execute("set enable_external_file_cache = false")
        answer = c.sql(sql.replace("T", f"'{url}'")).fetchall()
        return {"requests": len(RangeHandler.log), "bytes": sum(RangeHandler.log), "answer": answer}

    cases = [
        ("select count(*) from T", "count(*)"),
        ("select sum(qty) from T", "sum(qty)"),
        ("select sum(qty) from T where order_ts >= timestamp '2025-12-26'", "sum(qty) where order_ts >= '2025-12-26'"),
        ("select sum(qty), sum(unit_price) from T", "sum(qty), sum(unit_price)"),
        ("select * from T", "select *"),
    ]
    result = []
    for sql, label in cases:
        r = served(sql)
        result.append({"query": label, "requests": r["requests"], "bytes": r["bytes"], "share": round(r["bytes"] / size, 4), "answer": str(r["answer"][0][0])})
    server.shutdown()
    show(f"bytes the web server sent for each query (the file is {size:,} bytes)", table([[r["query"], r["requests"], f"{r['bytes']:,}", f"{r['share']:.1%}"] for r in result], ["query", "requests", "bytes sent", "of the file"]))
    by = {r["query"]: r for r in result}
    check("count(*) needs only the footer: under 1% of the file", by["count(*)"]["share"] < 0.01, str(by["count(*)"]))
    check("sum(qty) reads one column of every row group: between 1% and 20% of the file", 0.01 < by["sum(qty)"]["share"] < 0.20, str(by["sum(qty)"]))
    check("the same sum with a filter on the last days reads less than half of that (the qty and order_ts of the last row group only)", by["sum(qty) where order_ts >= '2025-12-26'"]["bytes"] < by["sum(qty)"]["bytes"] / 2, str(by["sum(qty) where order_ts >= '2025-12-26'"]))
    check("two columns cost more than one", by["sum(qty), sum(unit_price)"]["bytes"] > by["sum(qty)"]["bytes"])
    check("select * reads the whole file", by["select *"]["share"] > 0.95, str(by["select *"]))
    check("the answers over HTTP are the ones the table gives", by["count(*)"]["answer"] == "1000000" and by["sum(qty)"]["answer"] == str(con.sql("select sum(qty) from orders").fetchone()[0]))

    # ---- 4. another database, in place ----
    lite = work / "legacy.db"
    s = sqlite3.connect(lite)
    s.execute("create table customers_legacy (customer_id integer primary key, tier text)")
    s.executemany("insert into customers_legacy values (?, ?)", [(i, "gold" if i % 10 == 0 else "basic") for i in range(1, 5001)])
    s.commit()
    s.close()
    con.execute(f"attach '{lite.as_posix()}' as legacy (type sqlite, read_only)")
    joined = con.sql(
        f"select l.tier, count(*) from read_parquet('{pq.as_posix()}') o join legacy.customers_legacy l using (customer_id) group by all order by all"
    ).fetchall()
    check("a Parquet file joins a SQLite table in one query", sum(n for _, n in joined) == 1_000_000 and [t for t, _ in joined] == ["basic", "gold"], str(joined))
    gold = con.sql("select count(*) from orders where customer_id % 10 = 0").fetchone()[0]
    check("the gold share equals the orders of customers 10, 20, ...", dict(joined)["gold"] == gold)
    con.execute("create table customers_copy as select * from legacy.customers_legacy")
    check("a table of the other database can be copied in with CREATE TABLE AS", con.sql("select count(*) from customers_copy").fetchone()[0] == 5000)

    # ---- 5. full text search ----
    con.execute("create table docs (id int, body varchar)")
    con.execute(
        "insert into docs values (1, 'duckdb runs inside your process'), (2, 'sqlite is also an embedded database'), (3, 'a duck swims in a pond'), (4, 'duckdb reads parquet files and csv files')"
    )
    con.execute("pragma create_fts_index('docs', 'id', 'body', stemmer = 'english', stopwords = 'english', overwrite = 1)")
    hits = con.sql("select id, fts_main_docs.match_bm25(id, 'duckdb parquet') as score from docs order by score desc nulls last").fetchall()
    check("the document with both words ranks first, the one with neither has no score", hits[0][0] == 4 and hits[-1][1] is None and [h[0] for h in hits if h[1] is not None][:2] == [4, 1], str(hits))

    if WRITE:
        write_json(LABS / "ranges.json", {"fileBytes": size, "rowGroups": 9, "cases": result})


main_guard(main)
