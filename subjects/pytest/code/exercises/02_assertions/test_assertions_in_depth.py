"""Lesson assertions, deep dive: exception groups, excinfo, outcomes you raise yourself, hidden frames, approx corners."""

import decimal
import math

import pytest

from shop.cart import Cart


# --- excinfo -----------------------------------------------------------------------------------------------

def test_excinfo_has_the_type_value_and_traceback():
    with pytest.raises(ValueError) as info:
        Cart().add("apple", price=-1)
    assert info.type is ValueError
    assert str(info.value) == "price must not be negative, got -1"
    assert info.value.args == ("price must not be negative, got -1",)
    assert info.traceback[-1].name == "add"
    assert info.match("negative")


def test_check_argument_runs_a_predicate_on_the_exception():
    class CartError(Exception):
        def __init__(self, sku):
            super().__init__(f"bad sku {sku}")
            self.sku = sku

    def boom():
        raise CartError("kiwi")

    with pytest.raises(CartError, check=lambda e: e.sku == "kiwi"):
        boom()


def test_a_failing_check_is_a_failure(pytester):
    pytester.makepyfile(
        """
        import pytest

        def test_x():
            with pytest.raises(KeyError, check=lambda e: False):
                raise KeyError("a")
        """
    )
    pytester.runpytest().assert_outcomes(failed=1)


# --- exception groups --------------------------------------------------------------------------------------

def collect_errors():
    raise ExceptionGroup("several", [ValueError("a"), ValueError("b"), KeyError("k")])


def test_raises_group_matches_the_whole_group():
    with pytest.RaisesGroup(ValueError, ValueError, KeyError):
        collect_errors()


def test_raises_group_with_matchers_for_each_member():
    with pytest.RaisesGroup(
        pytest.RaisesExc(ValueError, match="a"),
        pytest.RaisesExc(ValueError, match="b"),
        pytest.RaisesExc(KeyError),
    ):
        collect_errors()


def test_a_plain_raises_does_not_look_inside_the_group():
    with pytest.raises(ExceptionGroup) as info:
        collect_errors()
    assert info.group_contains(KeyError)
    assert info.group_contains(ValueError, match="b")
    assert not info.group_contains(TypeError)


def test_raises_group_is_strict_about_extra_members(pytester):
    pytester.makepyfile(
        """
        import pytest

        def test_x():
            with pytest.RaisesGroup(ValueError):
                raise ExceptionGroup("g", [ValueError("a"), KeyError("k")])
        """
    )
    result = pytester.runpytest()
    result.assert_outcomes(failed=1)


def test_flatten_subgroups_for_nested_groups():
    def nested():
        raise ExceptionGroup("outer", [ExceptionGroup("inner", [ValueError("v")]), KeyError("k")])

    with pytest.RaisesGroup(ValueError, KeyError, flatten_subgroups=True):
        nested()


# --- warnings ----------------------------------------------------------------------------------------------

def test_recwarn_records_every_warning():
    import warnings

    with pytest.warns(UserWarning) as record:
        warnings.warn("first", UserWarning)
        warnings.warn("second", UserWarning)
    assert [str(w.message) for w in record] == ["first", "second"]
    assert record[0].category is UserWarning


def test_deprecated_call_is_warns_for_deprecation_and_pending_deprecation():
    import warnings

    with pytest.deprecated_call():
        warnings.warn("old", DeprecationWarning)
    with pytest.deprecated_call():
        warnings.warn("soon", PendingDeprecationWarning)


def test_warns_fails_if_nothing_warns(pytester):
    pytester.makepyfile(
        """
        import pytest

        def test_x():
            with pytest.warns(UserWarning):
                pass
        """
    )
    pytester.runpytest().assert_outcomes(failed=1)


# --- raising an outcome yourself ----------------------------------------------------------------------------

def test_fail_stops_the_test_with_a_message(pytester):
    pytester.makepyfile("import pytest\n\ndef test_x():\n    pytest.fail('stop here', pytrace=False)\n")
    result = pytester.runpytest()
    result.assert_outcomes(failed=1)
    result.stdout.fnmatch_lines(["*stop here*"])


def test_importorskip_returns_the_module_or_skips(pytester):
    assert pytest.importorskip("json").dumps({}) == "{}"
    pytester.makepyfile("import pytest\n\ndef test_x():\n    pytest.importorskip('no_such_module_anywhere')\n")
    pytester.runpytest().assert_outcomes(skipped=1)


def test_imperative_xfail_stops_the_test_at_that_line(pytester):
    pytester.makepyfile("import pytest\n\ndef test_x():\n    pytest.xfail('known')\n    assert False\n")
    pytester.runpytest().assert_outcomes(xfailed=1)


# --- __tracebackhide__ -------------------------------------------------------------------------------------

def test_tracebackhide_removes_a_helper_frame_from_the_report(pytester):
    pytester.makepyfile(
        """
        def assert_total(cart_total, want):
            __tracebackhide__ = True
            assert cart_total == want, "total differs"

        def test_x():
            assert_total(1, 2)
        """
    )
    result = pytester.runpytest("--tb=short")
    out = result.stdout.str()
    assert "assert_total(1, 2)" in out          # the line in the test is shown
    assert "assert cart_total == want" not in out  # the helper's own line is hidden


# --- approx corners ------------------------------------------------------------------------------------------

def test_nan_is_never_equal_unless_you_say_so():
    assert math.nan != pytest.approx(math.nan)
    assert math.nan == pytest.approx(math.nan, nan_ok=True)


def test_approx_with_decimal_and_a_tolerance():
    assert decimal.Decimal("0.30") == pytest.approx(decimal.Decimal("0.3"))
    assert decimal.Decimal("10.01") == pytest.approx(decimal.Decimal("10"), abs=decimal.Decimal("0.02"))


def test_approx_applies_to_dict_values_and_not_to_keys():
    assert {"a": 0.1 + 0.2} == pytest.approx({"a": 0.3})
    assert {"a": 1.0} != pytest.approx({"b": 1.0})


def test_approx_default_tolerance_is_relative_1e_minus_6_with_an_absolute_floor_of_1e_minus_12():
    # relative: 1e-6 of 1,000,000 is 1
    assert 1_000_000.5 == pytest.approx(1_000_000)
    assert 1_000_001.5 != pytest.approx(1_000_000)
    # next to zero the relative part is tiny, so an absolute floor of 1e-12 applies
    assert 1e-13 == pytest.approx(0)
    assert 1e-11 != pytest.approx(0)
