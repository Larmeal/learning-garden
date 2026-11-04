"""The other default file pattern: *_test.py is collected too."""

from shop.pricing import apply_discount


def test_ten_percent_off_one_hundred():
    assert apply_discount(100, 10) == 90
