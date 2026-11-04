"""Lesson parametrize: one test body, many cases."""

import pytest

from shop.pricing import apply_discount, discount_for, shipping_fee


@pytest.mark.parametrize(
    "total, percent, expected",
    [
        (100, 0, 100),
        (100, 10, 90),
        (100, 100, 0),
        (250, 20, 200),
    ],
)
def test_apply_discount(total, percent, expected):
    assert apply_discount(total, percent) == pytest.approx(expected)


@pytest.mark.parametrize("percent", [-1, 101, 1000])
def test_apply_discount_rejects_bad_percent(percent):
    with pytest.raises(ValueError, match="between 0 and 100"):
        apply_discount(100, percent)


@pytest.mark.parametrize(
    "total, fee",
    [
        pytest.param(499.99, 50.0, id="just-below-the-line"),
        pytest.param(500, 0.0, id="exactly-on-the-line"),
        pytest.param(0, 50.0, id="empty"),
    ],
)
def test_shipping_fee(total, fee):
    assert shipping_fee(total) == fee


@pytest.mark.parametrize("code", ["SAVE10", "save10", "Save10"])
def test_coupon_codes_ignore_case(code):
    assert discount_for(code) == 10


@pytest.mark.parametrize("percent", [0, 50])
@pytest.mark.parametrize("total", [100, 200, 300])
def test_stacked_parametrize_makes_every_combination(total, percent):
    assert apply_discount(total, percent) <= total


@pytest.mark.parametrize(
    "code, expected",
    [
        ("SAVE10", 10),
        ("SAVE20", 20),
        pytest.param("NOPE", None, marks=pytest.mark.xfail(raises=KeyError, reason="unknown code is not handled yet")),
    ],
)
def test_param_with_a_mark(code, expected):
    assert discount_for(code) == expected
