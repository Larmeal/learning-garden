"""Lesson parametrize, deep dive: ids, indirect, pytest_generate_tests, scope, and what an empty list does."""

import pytest

from shop.pricing import apply_discount, discount_for


# --- ids: a list, or a function that gets each value -------------------------------------------------------

def label(value):
    return f"{value}pct"


@pytest.mark.parametrize("percent", [10, 20, 50], ids=label)
def test_ids_from_a_function(percent):
    assert apply_discount(100, percent) == pytest.approx(100 - percent)


@pytest.mark.parametrize("code, off", [("SAVE10", 10), ("SAVE20", 20)], ids=["small", "large"])
def test_ids_from_a_list(code, off):
    assert discount_for(code) == off


def test_the_ids_are_part_of_the_name(pytester):
    pytester.makepyfile(
        """
        import pytest

        @pytest.mark.parametrize("x", [1, "a b", None, 2.5, b"z", (1, 2), [3]])
        def test_x(x): ...
        """
    )
    result = pytester.runpytest("--collect-only", "-q")
    names = [l.split("::")[-1] for l in result.stdout.lines if "::" in l]
    assert names == ["test_x[1]", "test_x[a b]", "test_x[None]", "test_x[2.5]", "test_x[z]", "test_x[x5]", "test_x[x6]"]


# --- pytest_generate_tests: parametrize from a hook, by looking at the fixtures a test asks for --------------

def pytest_generate_tests(metafunc):
    if "coupon_code" in metafunc.fixturenames:
        metafunc.parametrize("coupon_code", ["SAVE10", "SAVE20", "FREE"])


def test_generated_per_coupon(coupon_code):
    assert 0 < discount_for(coupon_code) <= 100


# --- scope of the parameters: a module-scoped fixture is rebuilt once per parameter ----------------------------

BUILT: list[str] = []


@pytest.fixture(scope="module", params=["a", "b"])
def resource(request):
    BUILT.append(f"build {request.param}")
    yield request.param
    BUILT.append(f"drop {request.param}")


def test_scoped_one(resource):
    pass


def test_scoped_two(resource):
    pass


def test_scoped_order_groups_tests_by_parameter():
    # pytest reorders so that every test of param "a" runs before the module fixture is rebuilt for "b"
    assert BUILT == ["build a", "drop a", "build b"]


# --- an empty list ----------------------------------------------------------------------------------------

def test_an_empty_parameter_set_skips_the_test(pytester):
    pytester.makepyfile(
        """
        import pytest

        @pytest.mark.parametrize("x", [])
        def test_none(x): ...
        """
    )
    result = pytester.runpytest("-rs")
    result.assert_outcomes(skipped=1)
    result.stdout.fnmatch_lines(["*got empty parameter set*"])


def test_empty_parameter_set_can_be_made_to_fail(pytester):
    pytester.makeini("[pytest]\nempty_parameter_set_mark = fail_at_collect\n")
    pytester.makepyfile(
        """
        import pytest

        @pytest.mark.parametrize("x", [])
        def test_none(x): ...
        """
    )
    result = pytester.runpytest()
    result.assert_outcomes(errors=1)


# --- a parameter that shadows a fixture -------------------------------------------------------------------

@pytest.fixture
def percent():
    return 99


@pytest.mark.parametrize("percent", [10])
def test_a_parameter_beats_a_fixture_of_the_same_name(percent):
    assert percent == 10


# --- parametrize on a class applies to every method --------------------------------------------------------

@pytest.mark.parametrize("sku", ["apple", "pear"])
class TestEveryMethodGetsTheParameter:
    def test_one(self, sku):
        assert sku in ("apple", "pear")

    def test_two(self, sku):
        assert len(sku) > 3
