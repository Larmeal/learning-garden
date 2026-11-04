"""Three ways a test can go wrong. Run on purpose to read the output (see verify.py for the expected counts)."""

import pytest

from shop.cart import Cart


def test_wrong_total():
    cart = Cart()
    cart.add("apple", price=10, qty=3)
    assert cart.total() == 31


def test_wrong_list():
    cart = Cart()
    cart.add("apple", price=10)
    cart.add("pear", price=20)
    assert cart.skus() == ["apple", "banana"]


def test_exception_inside_the_code_under_test():
    cart = Cart()
    cart.add("apple", price=10, qty=0)


@pytest.fixture
def broken_fixture():
    raise RuntimeError("setup failed")


def test_uses_a_broken_fixture(broken_fixture):
    assert True
