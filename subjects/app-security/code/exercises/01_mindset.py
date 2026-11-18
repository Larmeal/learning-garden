"""Lesson 1: the security mindset. Three tiny shop functions that each break one of C, I, A, and what a threat model finds.

Asserts that a function that trusts what the client sends loses confidentiality (anyone reads order 2), integrity (the client sets
its own price) and availability (one request can ask for unlimited work), and that the fix in each case is a rule that lives on the
server. Also checks the numbers the lesson prints for the request path (hops and trust boundaries).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from seclab import check, done, show  # noqa: E402

# ---- the toy shop: the data every example uses ----
PRICES = {"pen": 20, "book": 150, "bag": 900}
ORDERS = {
    1: {"owner": "ann", "item": "pen", "qty": 3},
    2: {"owner": "bob", "item": "bag", "qty": 1},
}

# ---- 1. Confidentiality: the server answers whoever asks ----
def get_order_naive(order_id: int, who: str):
    return ORDERS.get(order_id)


def get_order_checked(order_id: int, who: str):
    order = ORDERS.get(order_id)
    return order if order and order["owner"] == who else None


leak = get_order_naive(2, "ann")
show("ann asks for order 2 (the naive handler)", leak)
check("naive handler gives ann the order of bob", leak == ORDERS[2])
check("the checked handler refuses ann", get_order_checked(2, "ann") is None)
check("the checked handler still serves bob", get_order_checked(2, "bob") == ORDERS[2])

# ---- 2. Integrity: the client sends the price ----
def checkout_naive(cart: list[dict]) -> int:
    return sum(line["price"] * line["qty"] for line in cart)


def checkout_checked(cart: list[dict]) -> int:
    return sum(PRICES[line["item"]] * line["qty"] for line in cart)


tampered = [{"item": "bag", "qty": 1, "price": 1}]
show("checkout with price=1 for a bag", f"naive: {checkout_naive(tampered)}   checked: {checkout_checked(tampered)}")
check("naive checkout charges 1 baht for a 900 baht bag", checkout_naive(tampered) == 1)
check("checked checkout ignores the client price and charges 900", checkout_checked(tampered) == 900)

# ---- 3. Availability: work with no limit ----
def search_naive(limit: int) -> int:
    return limit  # rows the database would build


def search_checked(limit: int, cap: int = 100) -> int:
    return min(limit, cap)


check("naive search lets one request ask for 10,000,000 rows", search_naive(10_000_000) == 10_000_000)
check("checked search caps the same request at 100", search_checked(10_000_000) == 100)

# ---- 4. The request path of the lesson lab: hops and trust boundaries ----
PATH = [
    ("browser", "device"),
    ("network", "internet"),
    ("web server", "ours"),
    ("app code", "ours"),
    ("database", "ours"),
]
boundaries = sum(1 for (_, a), (_, b) in zip(PATH, PATH[1:]) if a != b)
show("hops on the request path", " -> ".join(n for n, _ in PATH))
check("the request path has 5 stops and 4 hops", len(PATH) == 5 and len(PATH) - 1 == 4)
check("the path crosses 2 trust boundaries: device to internet, internet to our system", boundaries == 2)

# ---- 5. STRIDE: six letters, six properties ----
STRIDE = {
    "Spoofing": "authentication",
    "Tampering": "integrity",
    "Repudiation": "non-repudiation",
    "Information disclosure": "confidentiality",
    "Denial of service": "availability",
    "Elevation of privilege": "authorization",
}
check("STRIDE names six threats and each breaks a different property", len(STRIDE) == 6 and len(set(STRIDE.values())) == 6)
done()
