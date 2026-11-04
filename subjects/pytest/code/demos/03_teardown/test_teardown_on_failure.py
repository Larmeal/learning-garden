"""Teardown after yield runs even when the test fails."""

import pytest

EVENTS: list[str] = []


@pytest.fixture
def resource():
    EVENTS.append("setup")
    yield
    EVENTS.append("teardown")


def test_that_fails(resource):
    assert False


def test_events_after_the_failure():
    assert EVENTS == ["setup", "teardown"]
