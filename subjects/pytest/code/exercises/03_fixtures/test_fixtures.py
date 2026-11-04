"""Lesson fixtures: setup, teardown with yield, scope, tmp_path, autouse."""

import pytest

from shop.cart import Cart


def test_fixture_from_conftest(cart):
    assert cart.is_empty()


def test_fixture_that_uses_another_fixture(filled_cart):
    assert filled_cart.total() == 50


def test_every_test_gets_a_fresh_cart(filled_cart):
    filled_cart.add("kiwi", price=5)
    assert filled_cart.qty("kiwi") == 1


def test_the_previous_test_did_not_leak(filled_cart):
    assert filled_cart.qty("kiwi") == 0


def test_save_and_load_with_tmp_path(filled_cart, tmp_path):
    path = tmp_path / "cart.json"
    filled_cart.save(path)
    assert path.exists()
    again = Cart.load(path)
    assert again.total() == filled_cart.total()
    assert again.skus() == filled_cart.skus()


# --- order of setup and teardown --------------------------------------------------------------------------

EVENTS: list[str] = []


@pytest.fixture(scope="module")
def connection():
    EVENTS.append("connect")
    yield "conn"
    EVENTS.append("disconnect")


@pytest.fixture
def transaction(connection):
    EVENTS.append("begin")
    yield connection
    EVENTS.append("rollback")


def test_first_user_of_the_fixtures(transaction):
    EVENTS.append("test 1")


def test_second_user_of_the_fixtures(transaction):
    EVENTS.append("test 2")


def test_the_events_show_scope():
    # connection is module scoped: connected once, still open here. transaction is per test: begin/rollback twice.
    assert EVENTS == ["connect", "begin", "test 1", "rollback", "begin", "test 2", "rollback"]


# --- autouse and a fixture that returns a function ----------------------------------------------------------

@pytest.fixture(autouse=True)
def count_tests(request):
    """autouse: runs for every test in this file even though no test names it."""
    COUNT.append(request.node.name)


COUNT: list[str] = []


def test_autouse_ran_for_this_test():
    assert COUNT[-1] == "test_autouse_ran_for_this_test"


@pytest.fixture
def make_cart():
    """A factory fixture: the test decides how many carts and what is in them."""

    def make(**items):
        cart = Cart()
        for sku, price in items.items():
            cart.add(sku, price=price)
        return cart

    return make


def test_factory_fixture(make_cart):
    a = make_cart(apple=10)
    b = make_cart(apple=10, pear=20)
    assert (a.total(), b.total()) == (10, 30)


@pytest.fixture(params=["SAVE10", "SAVE20"])
def coupon(request):
    return request.param


def test_a_parametrized_fixture_runs_the_test_once_per_param(filled_cart, coupon):
    assert filled_cart.apply_coupon(coupon) < filled_cart.total()
