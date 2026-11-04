"""Lesson fixture-engine: failures are cached, scopes cannot be inverted, a fixture can extend the one it overrides,
and a failing teardown does not stop the others."""

from _lab import project, run_sub

CACHED_FAILURE = {
    "test_a.py": """
        import pytest

        CALLS = []

        @pytest.fixture(scope="module")
        def shared():
            CALLS.append("setup")
            raise RuntimeError("cannot connect")

        def test_one(shared): ...
        def test_two(shared): ...

        def test_calls():
            assert CALLS == ["setup"]
    """,
}

SCOPE_MISMATCH = {
    "test_a.py": """
        import pytest

        @pytest.fixture
        def per_test():
            return 1

        @pytest.fixture(scope="session")
        def wide(per_test):
            return per_test

        def test_x(wide): ...
    """,
}

OVERRIDE = {
    "conftest.py": """
        import pytest

        @pytest.fixture
        def price():
            return 10
    """,
    "sub/conftest.py": """
        import pytest

        @pytest.fixture
        def price(price):  # asks for itself: gets the value of the fixture it overrides, one level up
            return price * 2
    """,
    "sub/test_a.py": """
        def test_x(price):
            assert price == 20
    """,
    "test_top.py": """
        def test_y(price):
            assert price == 10
    """,
}

TEARDOWN_ERRORS = {
    "test_a.py": """
        import pytest

        LOG = []

        @pytest.fixture
        def first():
            yield
            LOG.append("first closed")

        @pytest.fixture
        def second():
            yield
            LOG.append("second closed")
            raise RuntimeError("second failed to close")

        @pytest.fixture
        def third(first, second):
            yield
            LOG.append("third closed")

        def test_x(third):
            pass

        def test_log():
            assert LOG == ["third closed", "second closed", "first closed"]
    """,
}

DYNAMIC = {
    "test_a.py": """
        import pytest

        @pytest.fixture
        def a():
            return "a"

        def test_dynamic(request):
            assert request.fixturenames == ["request"]
            request.getfixturevalue("a")
            assert request.fixturenames == ["request", "a"]
    """,
}

if __name__ == "__main__":
    with project(CACHED_FAILURE) as root:
        code, out = run_sub(root, "-q")
    print(out.strip().splitlines()[-1])
    assert "2 errors" in out and "1 passed" in out  # both tests error, and the setup ran once (test_calls passed)

    with project(SCOPE_MISMATCH) as root:
        code, out = run_sub(root, "-q")
    msg = [l for l in out.splitlines() if "ScopeMismatch" in l]
    print(msg)
    assert code == 1 and any("You tried to access the function scoped fixture per_test with a session scoped request object" in l for l in out.splitlines())

    with project(OVERRIDE) as root:
        code, out = run_sub(root, "-q")
    assert code == 0 and "2 passed" in out

    with project(TEARDOWN_ERRORS) as root:
        code, out = run_sub(root, "-q")
    print(out.strip().splitlines()[-1])
    assert out.strip().splitlines()[-1].startswith("2 passed, 1 error")  # test_x passed, its teardown errored, test_log passed
    assert "second failed to close" in out and "ERROR at teardown of test_x" in out

    with project(DYNAMIC) as root:
        code, out = run_sub(root, "-q")
    assert code == 0
    print("ok")
