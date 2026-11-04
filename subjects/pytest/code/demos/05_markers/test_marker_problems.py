"""Two marker mistakes, to read what Pytest says about them."""

import pytest

from shop.cart import Cart


@pytest.mark.xfail(strict=True, reason="was a known bug")
def test_strict_xfail_that_now_passes():
    assert Cart().is_empty()


@pytest.mark.slwo  # typo of "slow": an unregistered mark is only a warning unless --strict-markers is on
def test_with_a_misspelled_mark():
    assert True
