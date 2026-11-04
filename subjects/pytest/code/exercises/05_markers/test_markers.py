"""Lesson markers: skip, skipif, xfail, and your own marks to select tests."""

import sys

import pytest

from shop.cart import Cart, EmptyCartError


@pytest.mark.skip(reason="the invoice PDF feature is not built yet")
def test_invoice_pdf():
    raise AssertionError("never runs")


@pytest.mark.skipif(sys.platform == "plan9", reason="no such platform here, so this test runs")
def test_runs_because_the_condition_is_false():
    assert True


@pytest.mark.skipif(sys.version_info < (3, 99), reason="needs a Python that does not exist yet")
def test_skipped_because_the_condition_is_true():
    raise AssertionError("never runs")


@pytest.mark.xfail(reason="coupons stack, which the business has not decided on yet")
def test_two_coupons_should_not_stack():
    cart = Cart()
    cart.add("apple", price=100)
    after_one = cart.apply_coupon("SAVE10")
    after_two = cart.apply_coupon("SAVE20")
    assert after_two == after_one  # fails today, so it is reported as xfailed


@pytest.mark.xfail(strict=True, reason="strict: if this starts passing we want to know")
def test_known_bug_that_is_still_there():
    assert Cart().total() == 1


@pytest.mark.slow
def test_a_slow_one():
    assert sum(range(1_000_000)) == 499999500000


@pytest.mark.integration
def test_cart_and_coupon_together():
    cart = Cart()
    cart.add("apple", price=100)
    assert cart.apply_coupon("SAVE10") == pytest.approx(90)


@pytest.mark.slow
@pytest.mark.integration
def test_both_marks():
    with pytest.raises(EmptyCartError):
        Cart().apply_coupon("SAVE10")


def test_unmarked():
    assert Cart().is_empty()


def test_imperative_skip():
    if not Cart().is_empty():
        pytest.skip("only runs for an empty cart")
    assert True
