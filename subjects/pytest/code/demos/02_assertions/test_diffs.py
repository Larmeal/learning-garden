"""Failing assertions on purpose, to read the diffs Pytest prints."""

import pytest


def test_float_equality():
    assert 0.1 + 0.2 == 0.3


def test_dict_diff():
    got = {"sku": "apple", "qty": 3, "price": 10}
    want = {"sku": "apple", "qty": 2, "price": 10, "note": "gift"}
    assert got == want


def test_string_diff():
    assert "total: 30 THB" == "total: 31 THB"


def test_approx_diff():
    assert 0.5 == pytest.approx(0.3)


def test_raises_not_raised():
    with pytest.raises(ValueError):
        int("42")
