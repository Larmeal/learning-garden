"""One wrong row in a parametrized test fails alone. The other rows still run and pass."""

import pytest

from shop.pricing import apply_discount


@pytest.mark.parametrize(
    "total, percent, expected",
    [
        (100, 10, 90),
        (100, 50, 40),  # wrong on purpose: 50% of 100 is 50
        (200, 50, 100),
    ],
)
def test_rows(total, percent, expected):
    assert apply_discount(total, percent) == pytest.approx(expected)
