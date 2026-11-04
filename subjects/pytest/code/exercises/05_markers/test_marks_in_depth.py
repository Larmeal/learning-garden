"""Lesson markers, deep dive: marks on classes and modules, reading marks, the -m expression, and skipif conditions."""

import sys

import pytest

pytestmark = pytest.mark.integration  # every test in this module carries the mark


@pytest.mark.slow
class TestMarksOnAClass:
    def test_inherits_the_class_mark(self, request):
        names = {m.name for m in request.node.iter_markers()}
        assert {"slow", "integration"} <= names

    @pytest.mark.skipif(True, reason="a mark on the method")
    def test_the_method_adds_its_own(self, request):
        raise AssertionError("skipped, never runs")


# --- reading marks: iter_markers walks from the item up to the module ---------------------------------

@pytest.fixture
def declared_timeout(request):
    marker = request.node.get_closest_marker("timeout")
    return marker.args[0] if marker else None


@pytest.mark.timeout(30)
def test_a_fixture_reads_the_mark_of_its_test(declared_timeout):
    assert declared_timeout == 30


def test_without_the_mark_there_is_nothing(declared_timeout):
    assert declared_timeout is None


def test_the_closest_mark_wins(pytester):
    pytester.makepyfile(
        """
        import pytest

        pytestmark = pytest.mark.level(1)

        @pytest.mark.level(2)
        class TestC:
            @pytest.mark.level(3)
            def test_m(self, request):
                levels = [m.args[0] for m in request.node.iter_markers("level")]
                closest = request.node.get_closest_marker("level").args[0]
                print("LEVELS", levels, "CLOSEST", closest)
        """
    )
    result = pytester.runpytest("-s", "-p", "no:cacheprovider")
    result.stdout.fnmatch_lines(["*LEVELS [[]3, 2, 1[]] CLOSEST 3*"])


# --- the -m expression ------------------------------------------------------------------------------------

def test_the_m_expression_grammar(pytester):
    pytester.makeini("[pytest]\nmarkers =\n    a\n    b\n    c\n")
    pytester.makepyfile(
        """
        import pytest

        @pytest.mark.a
        def test_a(): ...

        @pytest.mark.b
        def test_b(): ...

        @pytest.mark.a
        @pytest.mark.b
        def test_ab(): ...

        def test_none(): ...
        """
    )

    def selected(expr):
        result = pytester.runpytest("--collect-only", "-q", "-m", expr)
        return sorted(l.split("::")[-1] for l in result.stdout.lines if "::" in l)

    assert selected("a") == ["test_a", "test_ab"]
    assert selected("a and b") == ["test_ab"]
    assert selected("a or b") == ["test_a", "test_ab", "test_b"]
    assert selected("not a") == ["test_b", "test_none"]
    assert selected("(a or b) and not (a and b)") == ["test_a", "test_b"]


def test_k_matches_names_not_marks(pytester):
    pytester.makepyfile(
        """
        def test_apple_pie(): ...
        def test_apple_tart(): ...
        def test_pear(): ...
        """
    )
    names = lambda expr: sorted(  # noqa: E731
        l.split("::")[-1] for l in pytester.runpytest("--collect-only", "-q", "-k", expr).stdout.lines if "::" in l
    )
    assert names("apple") == ["test_apple_pie", "test_apple_tart"]
    assert names("apple and not tart") == ["test_apple_pie"]
    assert names("APPLE") == ["test_apple_pie", "test_apple_tart"]  # -k is case insensitive


# --- skipif and xfail conditions --------------------------------------------------------------------------

@pytest.mark.skipif(sys.implementation.name != "cpython", reason="a boolean condition: only CPython runs this")
def test_skipif_with_a_boolean_condition():
    assert sys.implementation.name == "cpython"


@pytest.mark.skipif("sys.version_info < (3, 0)", reason="a string condition is evaluated in the module namespace")
def test_skipif_with_a_string_condition():
    pass


@pytest.mark.xfail(True, reason="the first argument is a condition: true means the test is expected to fail")
def test_xfail_with_a_true_condition():
    assert False


@pytest.mark.xfail(False, reason="a false condition means the mark does nothing")
def test_xfail_with_a_false_condition():
    pass


@pytest.mark.xfail(raises=ZeroDivisionError, reason="only this exception counts as the expected failure")
def test_xfail_raises_narrows_the_expected_failure():
    1 / 0


def test_xfail_raises_with_another_exception_is_a_real_failure(pytester):
    pytester.makepyfile(
        """
        import pytest

        @pytest.mark.xfail(raises=ZeroDivisionError)
        def test_x():
            raise KeyError("other")
        """
    )
    pytester.runpytest().assert_outcomes(failed=1)


def test_xfail_strict_from_the_ini_file(pytester):
    pytester.makeini("[pytest]\nxfail_strict = true\n")
    pytester.makepyfile(
        """
        import pytest

        @pytest.mark.xfail
        def test_passes_unexpectedly(): ...
        """
    )
    pytester.runpytest().assert_outcomes(failed=1)


# --- adding a mark from code ------------------------------------------------------------------------------

def test_add_marker_at_run_time(request):
    request.node.add_marker(pytest.mark.xfail(reason="added while running"))
    assert False
