"""Lesson plugins: test a plugin with pytester, which runs a throwaway pytest project and gives back its result."""

import pytest

TESTS = """
    import time
    import pytest

    def test_fast():
        pass

    @pytest.mark.slow
    def test_marked_slow():
        pass

    def test_takes_a_moment():
        time.sleep(0.08)
"""


def test_slow_tests_are_skipped_by_default(pytester):
    pytester.makepyfile(TESTS)
    result = pytester.runpytest("-p", "shop_plugin", "-rs")
    result.assert_outcomes(passed=2, skipped=1)
    result.stdout.fnmatch_lines(["*need --run-slow to run*"])


def test_run_slow_runs_them(pytester):
    pytester.makepyfile(TESTS)
    result = pytester.runpytest("-p", "shop_plugin", "--run-slow")
    result.assert_outcomes(passed=3)


def test_the_marker_is_registered_so_strict_markers_accepts_it(pytester):
    pytester.makepyfile(TESTS)
    result = pytester.runpytest("-p", "shop_plugin", "--strict-markers")
    result.assert_outcomes(passed=2, skipped=1)


def test_the_slow_section_lists_tests_over_the_limit(pytester):
    pytester.makepyfile(TESTS)
    result = pytester.runpytest("-p", "shop_plugin")
    result.stdout.fnmatch_lines(["*= slow tests =*", "*ms  test_the_slow_section_lists_tests_over_the_limit.py::test_takes_a_moment"])
    assert "test_fast" not in "\n".join(result.stdout.lines[result.stdout.lines.index(next(l for l in result.stdout.lines if "slow tests" in l)) :])


def test_the_limit_comes_from_the_ini_file(pytester):
    pytester.makepyfile(TESTS)
    pytester.makeini("[pytest]\nshop_slow_limit = 5\n")
    result = pytester.runpytest("-p", "shop_plugin")
    assert "slow tests" not in result.stdout.str()


def test_readable_cart_diff(pytester):
    pytester.makepyfile(
        """
        def test_carts(cart_factory):
            assert cart_factory(apple=10, pear=20) == cart_factory(apple=10, kiwi=5)
        """
    )
    result = pytester.runpytest("-p", "shop_plugin")
    result.assert_outcomes(failed=1)
    result.stdout.fnmatch_lines(["*Cart == Cart*", "*skus :*pear*kiwi*", "*total: 30 != 15*", "*qty of kiwi: 0 != 1*"])


def test_report_gets_a_property(pytester):
    pytester.makepyfile("def test_x(): pass")
    reports = []

    class Collect:
        def pytest_runtest_logreport(self, report):
            reports.append(report)

    pytester.inline_run("-p", "shop_plugin", plugins=[Collect()])
    call = next(r for r in reports if r.when == "call")
    assert dict(call.user_properties)["duration_ms"] >= 0


def test_the_fixture_is_available(pytester):
    pytester.makepyfile(
        """
        def test_factory(cart_factory):
            assert cart_factory(a=1, b=2).total() == 3
        """
    )
    pytester.runpytest("-p", "shop_plugin").assert_outcomes(passed=1)


def test_without_the_plugin_the_fixture_does_not_exist(pytester):
    pytester.makepyfile("def test_factory(cart_factory): pass")
    result = pytester.runpytest()
    result.assert_outcomes(errors=1)
    result.stdout.fnmatch_lines(["*fixture 'cart_factory' not found*"])
