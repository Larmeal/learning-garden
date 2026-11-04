"""Currency conversion. It looks up a rate over the network, so tests have to replace that lookup."""

import os

from shop.net import fetch_json


def fetch_rate(currency: str) -> float:
    data = fetch_json(f"https://rates.example.invalid/latest?base=THB&to={currency}")
    return data["rate"]


def convert(amount_thb: float, currency: str | None = None) -> float:
    """Convert a THB amount. The currency defaults to the SHOP_CURRENCY environment variable."""
    currency = currency or os.environ.get("SHOP_CURRENCY", "THB")
    if currency == "THB":
        return amount_thb
    return round(amount_thb * fetch_rate(currency), 2)
