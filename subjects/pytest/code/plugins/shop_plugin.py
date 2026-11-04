"""A small pytest plugin for the shop tests. It shows the usual kinds of hook in one file:

- pytest_addoption and pytest_configure: a command line flag, an ini value and a marker
- pytest_collection_modifyitems: skip the tests marked slow unless the flag is given
- a wrapper around pytest_runtest_makereport: measure each test, add a property to the report
- pytest_terminal_summary: a section at the end of the run
- pytest_assertrepr_compare: a readable message when two carts differ
- a fixture
"""

import pytest

from shop.cart import Cart


def pytest_addoption(parser: pytest.Parser) -> None:
    group = parser.getgroup("shop")
    group.addoption("--run-slow", action="store_true", default=False, help="also run the tests marked slow")
    parser.addini("shop_slow_limit", "seconds after which a test is listed in the slow section", default="0.05")


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line("markers", "slow: takes a while, skipped unless --run-slow is given")
    config.stash[TIMINGS] = []


TIMINGS = pytest.StashKey[list]()


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if config.getoption("--run-slow"):
        return
    skip = pytest.mark.skip(reason="need --run-slow to run")
    for item in items:
        if "slow" in item.keywords:
            item.add_marker(skip)


@pytest.hookimpl(wrapper=True)
def pytest_runtest_makereport(item: pytest.Item, call: pytest.CallInfo):
    report = yield  # every other implementation has run; `report` is the TestReport they made
    if report.when == "call":
        item.config.stash[TIMINGS].append((item.nodeid, call.duration))
        report.user_properties.append(("duration_ms", round(call.duration * 1000)))
    return report


def pytest_terminal_summary(terminalreporter, config: pytest.Config) -> None:
    limit = float(config.getini("shop_slow_limit"))
    slow = sorted(((n, d) for n, d in config.stash[TIMINGS] if d > limit), key=lambda x: -x[1])
    if not slow:
        return
    terminalreporter.section("slow tests")
    for nodeid, duration in slow:
        terminalreporter.line(f"{duration * 1000:7.0f} ms  {nodeid}")


def pytest_assertrepr_compare(op: str, left: object, right: object) -> list[str] | None:
    if op == "==" and isinstance(left, Cart) and isinstance(right, Cart):
        lines = ["Cart == Cart", f"  skus : {left.skus()} != {right.skus()}", f"  total: {left.total()} != {right.total()}"]
        for sku in sorted(set(left.skus()) | set(right.skus())):
            if left.qty(sku) != right.qty(sku):
                lines.append(f"  qty of {sku}: {left.qty(sku)} != {right.qty(sku)}")
        return lines
    return None


@pytest.fixture
def cart_factory():
    def make(**items: float) -> Cart:
        cart = Cart()
        for sku, price in items.items():
            cart.add(sku, price=price)
        return cart

    return make
