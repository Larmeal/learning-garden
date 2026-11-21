"""Lesson 5: nested data. LIST, STRUCT, MAP and ENUM are column types, and JSON is a text column you can reach into or open up.

Asserts that a LIST holds many values in one cell and UNNEST turns it back into rows, that LIST_TRANSFORM and LIST_FILTER work on a list without leaving the row, that a STRUCT is
reached with a dot and a MAP with a key, that a JSON column is read with `->>` and opened into columns, that an ENUM stores a fixed set of strings and refuses any other, and that a
LIST of STRUCTs (an order with its lines) can be built from two flat tables and flattened back to the same rows.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ddb import check, connect, main_guard, make_shop, show, table  # noqa: E402

import duckdb  # noqa: E402


def main() -> None:
    con = connect()
    make_shop(con)

    # ---- 1. LIST: many values in one cell ----
    per = con.sql("select customer_id, list(order_id order by order_id) as ids from orders where customer_id <= 3 group by customer_id order by customer_id").fetchall()
    show("list() collects the rows of a group into one cell", table([[r[0], len(r[1]), str(r[1][:4])[:-1] + ", ...]"] for r in per], ["customer_id", "orders", "first order ids"]))
    n = dict(con.sql("select customer_id, count(*) from orders where customer_id <= 3 group by all").fetchall())
    check("each list has as many elements as the customer has orders", all(len(r[1]) == n[r[0]] for r in per))
    back = con.sql("select customer_id, unnest(ids) as order_id from (select customer_id, list(order_id) as ids from orders where customer_id <= 3 group by all)").fetchall()
    check("UNNEST turns the lists back into the same rows", len(back) == sum(n.values()) and {r[1] for r in back} == {x for r in per for x in r[1]})
    check("list_transform with a lambda changes every element", con.sql("select list_transform([1, 2, 3], x -> x * x)").fetchone()[0] == [1, 4, 9])
    check("list_filter keeps the elements that pass", con.sql("select list_filter([1, 2, 3, 4], x -> x % 2 = 0)").fetchone()[0] == [2, 4])
    check("a list is indexed from 1 and sliced with both ends", con.sql("select ([10, 20, 30, 40])[2], ([10, 20, 30, 40])[2:3]").fetchone() == (20, [20, 30]))
    check("list_aggregate runs an aggregate over one cell", con.sql("select list_aggregate([3, 1, 2], 'max'), list_sort([3, 1, 2])").fetchone() == (3, [1, 2, 3]))
    check("a list of strings can be searched with list_contains", con.sql("select list_contains(['a', 'b'], 'b'), 'b' in ['a', 'b']").fetchone() == (True, True))

    # ---- 2. STRUCT and MAP ----
    check("struct_pack builds a STRUCT and a dot reads a field", con.sql("select struct_pack(a := 1, b := 'x').b").fetchone()[0] == "x")
    check("the row() form is a STRUCT with unnamed fields and a name can be given with {}", con.sql("select {'city': 'Bangkok', 'zip': 10110}.zip").fetchone()[0] == 10110)
    check("a MAP is read by its key, and a missing key is NULL", con.sql("select map {'a': 1, 'b': 2}['b'], map {'a': 1}['z']").fetchone() == (2, None))
    try:
        con.sql("select struct_pack(a := 1).z").fetchall()
        raise AssertionError("a missing STRUCT field must fail")
    except duckdb.BinderException as e:
        check("a field that is not in the STRUCT is a Binder Error that names the key and the fields there are", 'Could not find key "z"' in str(e), str(e)[:80])
    check("map_keys and map_values return the two lists", con.sql("select map_keys(map {'a': 1, 'b': 2}), map_values(map {'a': 1, 'b': 2})").fetchone() == (["a", "b"], [1, 2]))

    # ---- 3. an order with its lines: a LIST of STRUCTs from flat tables ----
    nested = con.sql(
        """select customer_id, list(struct_pack(order_id := order_id, total := round(qty * unit_price, 2)) order by order_id) as orders
           from orders where customer_id <= 2 group by customer_id order by customer_id"""
    ).fetchall()
    first = nested[0][1][0]
    check("each cell holds a list of STRUCTs, and a field of the first one is reached with a dot", set(first) == {"order_id", "total"}, str(first))
    flat = con.sql(
        """select customer_id, o.order_id, o.total from (
             select customer_id, unnest(orders) as o from (
               select customer_id, list(struct_pack(order_id := order_id, total := round(qty * unit_price, 2))) as orders from orders where customer_id <= 2 group by customer_id))"""
    ).fetchall()
    ref = con.sql("select customer_id, order_id, round(qty * unit_price, 2) from orders where customer_id <= 2").fetchall()
    check("unnest on a LIST of STRUCTs gives back the flat rows of customers 1 and 2", sorted(flat) == sorted(ref), f"{len(flat)} vs {len(ref)}")
    check("the nested table keeps customers as rows: two rows for two customers", len(nested) == 2)

    # ---- 4. JSON as text, and opened up ----
    con.execute("create table events (id int, payload json)")
    con.execute(
        """insert into events values
           (1, '{"user": {"name": "Anna", "age": 31}, "items": [{"sku": "A1", "qty": 2}, {"sku": "B2", "qty": 1}]}'),
           (2, '{"user": {"name": "Bo"}, "items": []}'),
           (3, '{"user": {"name": "Chai", "age": 40}, "items": [{"sku": "A1", "qty": 5}]}')"""
    )
    names = con.sql("select payload->>'$.user.name' from events order by id").fetchall()
    check("->> reads a path out of JSON text as a string", names == [("Anna",), ("Bo",), ("Chai",)])
    ages = con.sql("select (payload->>'$.user.age')::int from events order by id").fetchall()
    check("a missing key is NULL, and ::int casts the text", ages == [(31,), (None,), (40,)])
    typed = con.sql("select json_transform(payload, '{\"user\": {\"name\": \"VARCHAR\", \"age\": \"INTEGER\"}, \"items\": [{\"sku\": \"VARCHAR\", \"qty\": \"INTEGER\"}]}') as p from events order by id").fetchall()
    check("json_transform turns the text into a STRUCT with a LIST of STRUCTs", typed[0][0]["items"][1] == {"sku": "B2", "qty": 1}, str(typed[0][0]))
    sold = con.sql(
        """select i.sku, sum(i.qty) as qty from (
             select unnest(json_transform(payload->'$.items', '[{"sku": "VARCHAR", "qty": "INTEGER"}]')) as i from events)
           group by all order by all"""
    ).fetchall()
    check("shredding the items array into rows and grouping by sku gives A1 = 7 and B2 = 1", sold == [("A1", 7), ("B2", 1)], str(sold))

    # ---- 5. ENUM ----
    con.execute("create type status_t as enum ('paid', 'shipped', 'cancelled', 'refunded')")
    con.execute("create table small (order_id int, status status_t)")
    con.execute("insert into small select order_id, status::status_t from orders limit 1000")
    check("an ENUM column holds the strings of its set", con.sql("select count(*) from small where status = 'paid'").fetchone()[0] > 0)
    try:
        con.execute("insert into small values (1, 'lost')")
        raise AssertionError("lost is not in the enum")
    except Exception as e:  # noqa: BLE001
        msg = str(e)
    check("a value outside the set is refused", "Conversion Error" in msg and "lost" in msg, msg[:100])
    order = con.sql("select enum_range(null::status_t)").fetchone()[0]
    check("enum_range lists the set in the order it was declared", order == ["paid", "shipped", "cancelled", "refunded"])
    check("an ENUM sorts by its declared order, not alphabetically", con.sql("select status from (select 'refunded'::status_t as status union all select 'paid'::status_t) order by status").fetchall() == [("paid",), ("refunded",)])


main_guard(main)
