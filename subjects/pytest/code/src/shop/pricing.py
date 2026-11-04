"""Pricing rules: discount codes, percentage discounts, tax."""

import warnings

COUPONS = {"SAVE10": 10, "SAVE20": 20, "FREE": 100}


def discount_for(code: str) -> int:
    """Percent off for a coupon code. Unknown codes raise KeyError."""
    return COUPONS[code.upper()]


def apply_discount(total: float, percent: float) -> float:
    """Take `percent` off `total`. Percent must be between 0 and 100."""
    if not 0 <= percent <= 100:
        raise ValueError(f"percent must be between 0 and 100, got {percent}")
    return total * (1 - percent / 100)


def with_tax(subtotal: float, rate: float = 0.07) -> float:
    return subtotal * (1 + rate)


def old_total(prices: list[float]) -> float:
    """Kept for old callers. Use Cart.total() instead."""
    warnings.warn("old_total() is deprecated, use Cart.total()", DeprecationWarning, stacklevel=2)
    return sum(prices)


def shipping_fee(total: float) -> float:
    """Free shipping from 500, otherwise 50."""
    return 0.0 if total >= 500 else 50.0
