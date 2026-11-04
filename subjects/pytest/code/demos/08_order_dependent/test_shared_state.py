"""Tests that share state through a module-level object. They pass together and fail when run alone."""

from shop.cart import Cart

cart = Cart()  # created once at import time and shared by every test below


def test_add():
    cart.add("apple", price=10)
    assert cart.qty("apple") == 1


def test_total():
    assert cart.total() == 10  # only true if test_add ran first
