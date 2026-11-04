"""Lesson first-test. Plain functions, plain assert. Pytest finds them by name."""

from shop.cart import Cart


def test_new_cart_is_empty():
    cart = Cart()
    assert cart.is_empty()
    assert cart.total() == 0


def test_add_item_increases_total():
    cart = Cart()
    cart.add("apple", price=10, qty=3)
    assert cart.total() == 30


def test_adding_the_same_sku_twice_merges_the_lines():
    cart = Cart()
    cart.add("apple", price=10)
    cart.add("apple", price=10, qty=2)
    assert cart.qty("apple") == 3
    assert cart.skus() == ["apple"]


class TestRemove:
    def test_remove_drops_the_line(self):
        cart = Cart()
        cart.add("apple", price=10)
        cart.remove("apple")
        assert cart.is_empty()

    def test_remove_missing_sku_raises_key_error(self):
        cart = Cart()
        try:
            cart.remove("ghost")
        except KeyError:
            pass
        else:
            raise AssertionError("expected KeyError")


def make_cart():
    """A helper. Its name does not start with test, so Pytest does not run it."""
    cart = Cart()
    cart.add("apple", price=10)
    return cart


def check_total_is_ten():
    """Also not collected: 'check_' is not a test prefix."""
    assert make_cart().total() == 10
