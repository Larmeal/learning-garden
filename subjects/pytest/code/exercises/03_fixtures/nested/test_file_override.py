import pytest

from shop.cart import Cart


@pytest.fixture
def cart():
    """Defined in the test file itself: wins over both conftest.py files."""
    cart = Cart()
    cart.add("local", price=1)
    return cart


def test_a_fixture_in_the_test_file_wins(cart):
    assert cart.skus() == ["local"]
