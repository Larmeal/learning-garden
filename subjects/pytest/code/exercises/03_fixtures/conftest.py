"""Fixtures shared by every test file in this folder (a conftest.py is picked up without any import)."""

import pytest

from shop.cart import Cart


@pytest.fixture
def cart():
    return Cart()


@pytest.fixture
def filled_cart(cart):
    """A fixture can ask for another fixture by naming it as a parameter."""
    cart.add("apple", price=10, qty=3)
    cart.add("pear", price=20)
    return cart
