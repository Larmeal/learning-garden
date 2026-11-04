"""Lesson fixtures, deep dive: request, finalizers, dynamic names, scope callables, usefixtures, and the order of things."""

import pytest

from shop.cart import Cart

ORDER: list[str] = []


# --- request: the fixture asks about the test that asked for it -----------------------------------------

@pytest.fixture
def who_asked(request):
    return {
        "name": request.node.name,
        "scope": request.scope,
        "fixturename": request.fixturename,
        "module": request.module.__name__.split(".")[-1],
        "has_cls": request.cls is not None,
    }


def test_request_describes_the_asking_test(who_asked):
    assert who_asked == {
        "name": "test_request_describes_the_asking_test",
        "scope": "function",
        "fixturename": "who_asked",
        "module": "test_fixtures_in_depth",
        "has_cls": False,
    }


class TestInsideAClass:
    def test_cls_is_set(self, who_asked):
        assert who_asked["has_cls"] is True


# --- request.param and indirect parametrization ---------------------------------------------------------

@pytest.fixture
def cart_of(request):
    """The test says how many apples; the fixture builds the cart (indirect parametrization)."""
    cart = Cart()
    cart.add("apple", price=10, qty=request.param)
    return cart


@pytest.mark.parametrize("cart_of, total", [(1, 10), (3, 30)], indirect=["cart_of"])
def test_indirect_hands_the_value_to_the_fixture(cart_of, total):
    assert cart_of.total() == total


# --- addfinalizer: several cleanups registered along the way --------------------------------------------

@pytest.fixture
def resource(request):
    ORDER.append("open")
    request.addfinalizer(lambda: ORDER.append("close first-registered"))
    request.addfinalizer(lambda: ORDER.append("close second-registered"))
    return "res"


def test_uses_resource(resource):
    ORDER.append("test")


def test_finalizers_run_in_reverse_order_of_registration():
    assert ORDER[-4:] == ["open", "test", "close second-registered", "close first-registered"]


# --- getfixturevalue: choose the fixture at run time ----------------------------------------------------

@pytest.fixture
def small():
    return Cart()


@pytest.fixture
def large():
    cart = Cart()
    cart.add("tv", price=2000)
    return cart


@pytest.mark.parametrize("name, empty", [("small", True), ("large", False)])
def test_getfixturevalue_looks_up_by_name(request, name, empty):
    assert request.getfixturevalue(name).is_empty() is empty


def test_unknown_name_error(request):
    with pytest.raises(LookupError) as info:  # FixtureLookupError is a LookupError, and not a public name
        request.getfixturevalue("no_such_fixture")
    assert info.type.__name__ == "FixtureLookupError"
    assert info.value.argname == "no_such_fixture"


# --- usefixtures: need the effect, not the value --------------------------------------------------------

@pytest.fixture
def sets_flag():
    ORDER.append("flag set")
    yield
    ORDER.append("flag cleared")


@pytest.mark.usefixtures("sets_flag")
def test_usefixtures_runs_the_fixture_without_a_parameter():
    assert ORDER[-1] == "flag set"


# --- name=: the function name and the fixture name can differ -------------------------------------------

@pytest.fixture(name="shopping_cart")
def make_shopping_cart():
    return Cart()


def test_fixture_name_can_be_overridden(shopping_cart):
    assert shopping_cart.is_empty()


# --- scope as a callable: decided when the fixture is first needed --------------------------------------

def scope_from_config(fixture_name, config):
    return "session" if config.getoption("--setup-show", default=False) else "function"


@pytest.fixture(scope=scope_from_config)
def maybe_shared():
    return object()


def test_scope_callable_a(maybe_shared):
    pass


def test_scope_callable_b(maybe_shared):
    pass


# --- a fixture that fails in setup, and one that fails in teardown --------------------------------------

def test_a_failing_setup_prevents_the_call(pytester):
    pytester.makepyfile(
        """
        import pytest

        @pytest.fixture
        def broken():
            raise RuntimeError("no")

        def test_x(broken):
            print("never printed")
        """
    )
    result = pytester.runpytest("-s")
    result.assert_outcomes(errors=1)
    assert "never printed" not in result.stdout.str()


def test_the_autouse_fixture_of_a_conftest_applies_to_every_test_below_it(pytester):
    pytester.makeconftest(
        """
        import pytest

        @pytest.fixture(autouse=True)
        def note(request):
            print("NOTE", request.node.name)
        """
    )
    pytester.makepyfile("def test_a(): pass\n\ndef test_b(): pass\n")
    result = pytester.runpytest("-s")
    result.stdout.fnmatch_lines(["*NOTE test_a*", "*NOTE test_b*"])
