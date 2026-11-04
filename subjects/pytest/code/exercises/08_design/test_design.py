"""Lesson test-design and the capstone: tests that describe behaviour, written around the checkout feature."""

import pytest

from shop.cart import Cart, EmptyCartError
from shop.checkout import PaymentDeclined, checkout
from shop.pricing import discount_for, shipping_fee


class FakeGateway:
    def __init__(self, accept=True):
        self.accept = accept
        self.charges = []

    def charge(self, amount, order_id):
        self.charges.append((amount, order_id))
        return self.accept


@pytest.fixture
def cart_with_one_apple():
    cart = Cart()
    cart.add("apple", price=100)
    return cart


# Arrange, Act, Assert: three visible blocks, one behaviour per test, a name that reads like a sentence.

def test_checkout_charges_the_cart_total(cart_with_one_apple):
    # Arrange
    gateway = FakeGateway()
    # Act
    charged = checkout(cart_with_one_apple, gateway, "A-1")
    # Assert
    assert charged == 100
    assert gateway.charges == [(100, "A-1")]


def test_checkout_applies_the_coupon_before_charging(cart_with_one_apple):
    gateway = FakeGateway()
    checkout(cart_with_one_apple, gateway, "A-2", coupon="SAVE20")
    assert gateway.charges == [(pytest.approx(80), "A-2")]


def test_checkout_empties_the_cart_after_a_successful_charge(cart_with_one_apple):
    checkout(cart_with_one_apple, FakeGateway(), "A-3")
    assert cart_with_one_apple.is_empty()


def test_a_declined_card_leaves_the_cart_untouched(cart_with_one_apple):
    with pytest.raises(PaymentDeclined):
        checkout(cart_with_one_apple, FakeGateway(accept=False), "A-4")
    assert cart_with_one_apple.qty("apple") == 1


def test_checkout_of_an_empty_cart_never_reaches_the_gateway():
    gateway = FakeGateway()
    with pytest.raises(EmptyCartError):
        checkout(Cart(), gateway, "A-5")
    assert gateway.charges == []


def test_an_unknown_coupon_is_an_error_and_charges_nothing(cart_with_one_apple):
    gateway = FakeGateway()
    with pytest.raises(KeyError):
        checkout(cart_with_one_apple, gateway, "A-6", coupon="NOPE")
    assert gateway.charges == []
    assert cart_with_one_apple.qty("apple") == 1


# Test behaviour through the public interface. This test would break if `_lines` were renamed, and would not
# notice if total() were wrong. The two after it describe what a caller can see.

def test_brittle_version_looks_inside(cart_with_one_apple):
    assert list(cart_with_one_apple._lines) == ["apple"]


def test_robust_version_uses_the_public_interface(cart_with_one_apple):
    assert cart_with_one_apple.skus() == ["apple"]
    assert cart_with_one_apple.total() == 100


# Boundaries are where bugs live: test both sides of every threshold.

@pytest.mark.parametrize("total, fee", [(499.99, 50), (500, 0), (500.01, 0)])
def test_shipping_threshold_boundary(total, fee):
    assert shipping_fee(total) == fee


# A regression test starts as the bug report and stays as protection.

def test_coupon_lookup_is_case_insensitive():
    """Bug report #12: 'save10' typed in lower case was rejected."""
    assert discount_for("save10") == discount_for("SAVE10")
