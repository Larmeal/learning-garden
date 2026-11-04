"""Lesson test-design, deep dive: five ways a test goes bad, each shown by running a small project, plus the fix."""

import random

import pytest

# Each smell is a project written into a throwaway folder, so the bad version can fail without failing this file.


def passes(pytester, source, *args):
    pytester.makepyfile(source)
    return pytester.runpytest(*args)


# --- 1. the test depends on the order -------------------------------------------------------------------------

ORDER_DEPENDENT = """
    cart = []

    def test_add():
        cart.append("apple")
        assert cart == ["apple"]

    def test_total():
        assert len(cart) == 1
"""

ORDER_FREE = """
    import pytest

    @pytest.fixture
    def cart():
        return []

    def test_add(cart):
        cart.append("apple")
        assert cart == ["apple"]

    def test_total(cart):
        cart.append("apple")
        assert len(cart) == 1
"""


def test_smell_order_dependence(pytester):
    passes(pytester, ORDER_DEPENDENT).assert_outcomes(passed=2)
    # run only the second test, or reverse the order with -p no:... style selection: it fails
    result = pytester.runpytest("test_smell_order_dependence.py::test_total")
    result.assert_outcomes(failed=1)
    pytester.makepyfile(**{"test_smell_order_dependence": ORDER_FREE})
    pytester.runpytest("test_smell_order_dependence.py::test_total").assert_outcomes(passed=1)


# --- 2. the test uses the clock or randomness ---------------------------------------------------------------

def make_discount(rng):
    return rng.choice([0, 10, 20])


def test_smell_randomness_a_seeded_generator_is_repeatable():
    first = [make_discount(random.Random(7)) for _ in range(5)]
    second = [make_discount(random.Random(7)) for _ in range(5)]
    assert first == second


def test_smell_randomness_the_global_generator_is_not_a_fixed_input():
    random.seed(7)
    a = [random.choice([0, 10, 20]) for _ in range(5)]
    random.seed(7)
    b = [random.choice([0, 10, 20]) for _ in range(5)]
    assert a == b  # fine because the test seeds it itself; without random.seed the numbers change on every run


# --- 3. the test repeats the implementation -------------------------------------------------------------------

def total_of(prices, qtys):
    return sum(p * q for p, q in zip(prices, qtys))


def test_smell_the_expected_value_is_computed_with_the_same_code():
    prices, qtys = [10, 20], [3, 1]
    # smell: the test would still pass if total_of had the wrong formula, because both sides share it
    assert total_of(prices, qtys) == sum(p * q for p, q in zip(prices, qtys))


def test_the_expected_value_is_written_down():
    assert total_of([10, 20], [3, 1]) == 50  # 3 * 10 + 1 * 20, worked out by hand


# --- 4. an assert that cannot fail ----------------------------------------------------------------------------

def test_smell_assert_on_a_tuple_is_always_true(pytester):
    result = passes(pytester, "def test_x():\n    assert (1 == 2, 'message')\n", "-W", "default")
    result.assert_outcomes(passed=1)
    result.stdout.fnmatch_lines(["*assertion is always true, perhaps remove parentheses?*"])


def test_smell_a_test_with_no_assert_only_proves_nothing_crashed(pytester):
    passes(pytester, "def test_x():\n    1 + 1\n").assert_outcomes(passed=1)


def test_returning_a_value_instead_of_asserting_is_reported(pytester):
    result = passes(pytester, "def test_x():\n    return 1 == 2\n", "-W", "default")
    result.assert_outcomes(passed=1, warnings=1)
    result.stdout.fnmatch_lines(["*Did you mean to use `assert` instead of `return`?*"])


# --- 5. one test, many unrelated checks ------------------------------------------------------------------------

def test_smell_the_first_failing_assert_hides_the_others(pytester):
    result = passes(
        pytester,
        """
        def test_all_in_one():
            assert 1 == 2
            assert 3 == 4
        """,
    )
    result.assert_outcomes(failed=1)
    assert "3 == 4" not in result.stdout.str()


def test_split_into_tests_so_every_failure_shows(pytester):
    result = passes(
        pytester,
        """
        def test_first():
            assert 1 == 2

        def test_second():
            assert 3 == 4
        """,
    )
    result.assert_outcomes(failed=2)


# --- a test that checks a mutable default once --------------------------------------------------------------------

def append_to(item, bucket=[]):  # the classic bug: the default list is shared between calls
    bucket.append(item)
    return bucket


def test_a_shared_default_shows_up_when_the_same_function_is_called_twice():
    first = append_to("a")
    second = append_to("b")
    assert second == ["a", "b"] and first is second


def test_flaky_pattern_needs_repetition_to_show(pytester):
    """A test that fails one run in five looks green most of the time. Repeating it makes it visible."""
    pytester.makepyfile(
        """
        import pytest

        calls = {"n": 0}

        @pytest.mark.parametrize("attempt", range(10))
        def test_sometimes(attempt):
            calls["n"] += 1
            assert calls["n"] % 5 != 0
        """
    )
    pytester.runpytest().assert_outcomes(passed=8, failed=2)
