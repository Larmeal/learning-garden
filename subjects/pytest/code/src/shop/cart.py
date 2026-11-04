"""A small shopping cart. It is the code under test in every Pytest exercise."""

import json
from dataclasses import dataclass
from pathlib import Path


class EmptyCartError(Exception):
    """Raised when something needs items but the cart has none."""


@dataclass
class Line:
    sku: str
    price: float
    qty: int

    @property
    def subtotal(self) -> float:
        return self.price * self.qty


class Cart:
    def __init__(self) -> None:
        self._lines: dict[str, Line] = {}

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Cart) and self._lines == other._lines

    def is_empty(self) -> bool:
        return not self._lines

    def add(self, sku: str, price: float, qty: int = 1) -> None:
        if qty <= 0:
            raise ValueError(f"qty must be positive, got {qty}")
        if price < 0:
            raise ValueError(f"price must not be negative, got {price}")
        if sku in self._lines:
            self._lines[sku].qty += qty
        else:
            self._lines[sku] = Line(sku, price, qty)

    def remove(self, sku: str) -> None:
        if sku not in self._lines:
            raise KeyError(sku)
        del self._lines[sku]

    def qty(self, sku: str) -> int:
        return self._lines[sku].qty if sku in self._lines else 0

    def skus(self) -> list[str]:
        return sorted(self._lines)

    def total(self) -> float:
        return sum(line.subtotal for line in self._lines.values())

    def apply_coupon(self, code: str) -> float:
        """Return the total after a coupon. SAVE10 takes 10% off, FREE takes everything off."""
        if self.is_empty():
            raise EmptyCartError("cannot apply a coupon to an empty cart")
        from shop.pricing import discount_for

        return self.total() * (1 - discount_for(code) / 100)

    def save(self, path: Path) -> None:
        data = [{"sku": l.sku, "price": l.price, "qty": l.qty} for l in self._lines.values()]
        Path(path).write_text(json.dumps(data), encoding="utf-8")

    @classmethod
    def load(cls, path: Path) -> "Cart":
        cart = cls()
        for row in json.loads(Path(path).read_text(encoding="utf-8")):
            cart.add(row["sku"], row["price"], row["qty"])
        return cart
