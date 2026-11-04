"""Lesson assertions: approx, raises, warns, and what a failing assert tells you."""

import warnings

import pytest

from shop.cart import Cart, EmptyCartError
from shop.pricing import apply_discount, old_total


def test_float_sums_need_approx():
    assert 0.1 + 0.2 != 0.3
    assert 0.1 + 0.2 == pytest.approx(0.3)


def test_approx_with_explicit_tolerance():
    assert 100.04 == pytest.approx(100, abs=0.05)
    assert 100.04 != pytest.approx(100, abs=0.01)
    assert 100.04 == pytest.approx(100, rel=1e-3)


def test_approx_on_a_list_and_a_dict():
    assert [0.1 + 0.2, 1.1 + 2.2] == pytest.approx([0.3, 3.3])
    assert {"a": 0.1 + 0.2} == pytest.approx({"a": 0.3})


def test_raises_checks_the_type():
    cart = Cart()
    with pytest.raises(ValueError):
        cart.add("apple", price=10, qty=0)


def test_raises_with_match_checks_the_message():
    cart = Cart()
    with pytest.raises(ValueError, match=r"qty must be positive, got -1"):
        cart.add("apple", price=10, qty=-1)


def test_match_is_a_search_so_a_part_of_the_message_is_enough():
    with pytest.raises(ValueError, match="positive"):
        Cart().add("apple", price=10, qty=0)


def test_everything_before_the_raising_line_inside_the_block_still_happens():
    cart = Cart()
    with pytest.raises(ValueError):
        cart.add("apple", price=10)  # does not raise
        cart.add("apple", price=10, qty=0)  # raises here, the block ends
    assert cart.qty("apple") == 1


def test_raises_gives_access_to_the_exception():
    cart = Cart()
    with pytest.raises(EmptyCartError) as info:
        cart.apply_coupon("SAVE10")
    assert "empty cart" in str(info.value)
    assert info.type is EmptyCartError


def test_a_subclass_also_matches():
    with pytest.raises(LookupError):
        Cart().remove("ghost")  # KeyError is a LookupError


def test_warns_catches_a_deprecation():
    with pytest.warns(DeprecationWarning, match="old_total"):
        assert old_total([1, 2, 3]) == 6


def test_no_warning_for_the_new_code():
    with warnings.catch_warnings():
        warnings.simplefilter("error")
        assert apply_discount(100, 10) == pytest.approx(90)


def test_assert_with_a_message():
    cart = Cart()
    cart.add("apple", price=10)
    assert cart.qty("apple") == 1, "one apple was added, so qty must be 1"


def test_comparing_sets_ignores_order():
    cart = Cart()
    cart.add("b", price=1)
    cart.add("a", price=1)
    assert set(cart.skus()) == {"a", "b"}
    assert cart.skus() == ["a", "b"]
