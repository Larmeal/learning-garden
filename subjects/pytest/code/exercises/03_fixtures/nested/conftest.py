"""A conftest.py closer to the tests overrides the fixture of the same name from the parent folder."""

import pytest

from shop.cart import Cart


@pytest.fixture
def cart():
    cart = Cart()
    cart.add("override", price=1)
    return cart
