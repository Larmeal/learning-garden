"""Lesson isolation: replace the slow, random or global parts, and check the output you cannot return."""

import datetime as dt
import logging
from unittest import mock

import pytest

from shop import net, rates
from shop.cart import Cart
from shop.checkout import PaymentDeclined, checkout
from shop.receipt import print_receipt
from shop.sale import greeting_now, is_sale_day


# --- monkeypatch --------------------------------------------------------------------------------------------

def test_without_a_replacement_the_network_call_fails():
    with pytest.raises(ConnectionError, match="no network"):
        rates.convert(100, "USD")


def test_monkeypatch_replaces_the_function_used_by_convert(monkeypatch):
    monkeypatch.setattr(rates, "fetch_rate", lambda currency: 0.03)
    assert rates.convert(100, "USD") == 3.0


def test_monkeypatch_setenv_sets_the_default_currency(monkeypatch):
    monkeypatch.setenv("SHOP_CURRENCY", "USD")
    monkeypatch.setattr(rates, "fetch_rate", lambda currency: 0.5)
    assert rates.convert(100) == 50.0


def test_the_environment_is_restored_after_the_test(monkeypatch):
    import os

    assert "SHOP_CURRENCY" not in os.environ
    assert rates.convert(100) == 100  # THB needs no rate


# --- unittest.mock: patch where the name is looked up -----------------------------------------------------

def test_patching_the_wrong_place_does_nothing():
    # rates did `from shop.net import fetch_json`, so rates has its own name fetch_json. Patching net.fetch_json
    # changes a different name, and rates still calls the original.
    with mock.patch.object(net, "fetch_json", return_value={"rate": 0.03}):
        with pytest.raises(ConnectionError):
            rates.convert(100, "USD")


def test_patching_where_the_name_is_used_works():
    with mock.patch.object(rates, "fetch_json", return_value={"rate": 0.03}) as fake:
        assert rates.convert(100, "USD") == 3.0
    fake.assert_called_once()
    (url,), _ = fake.call_args
    assert url.endswith("to=USD")


# --- a fake you hand in is simpler than a patch ------------------------------------------------------------

class FakeGateway:
    def __init__(self, accept: bool):
        self.accept = accept
        self.charges: list[tuple[float, str]] = []

    def charge(self, amount, order_id):
        self.charges.append((amount, order_id))
        return self.accept


def test_checkout_charges_and_clears_the_cart():
    cart = Cart()
    cart.add("apple", price=100)
    gateway = FakeGateway(accept=True)
    assert checkout(cart, gateway, "A-1", coupon="SAVE10") == pytest.approx(90)
    assert gateway.charges == [(pytest.approx(90), "A-1")]
    assert cart.is_empty()


def test_a_declined_payment_keeps_the_cart():
    cart = Cart()
    cart.add("apple", price=100)
    with pytest.raises(PaymentDeclined):
        checkout(cart, FakeGateway(accept=False), "A-2")
    assert cart.qty("apple") == 1


def test_mock_as_a_gateway_records_the_call():
    gateway = mock.Mock()
    gateway.charge.return_value = True
    cart = Cart()
    cart.add("apple", price=100)
    checkout(cart, gateway, "A-3")
    gateway.charge.assert_called_once_with(100, "A-3")


# --- time ---------------------------------------------------------------------------------------------------

def test_an_argument_beats_patching_the_clock():
    assert is_sale_day(dt.date(2026, 11, 11))
    assert is_sale_day(dt.date(2026, 11, 13))  # a Friday the 13th
    assert not is_sale_day(dt.date(2026, 11, 12))


def test_when_the_clock_is_hard_wired_you_have_to_patch_it(monkeypatch):
    class FakeNow(dt.datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 11, 11, 8, 0)

    monkeypatch.setattr("shop.sale.dt.datetime", FakeNow)
    assert greeting_now() == "good morning"


# --- output: capsys and caplog --------------------------------------------------------------------------------

def test_capsys_reads_what_was_printed(capsys):
    cart = Cart()
    cart.add("apple", price=10, qty=2)
    print_receipt(cart)
    out = capsys.readouterr().out
    assert out.splitlines() == ["apple x2", "TOTAL 20.00"]


def test_caplog_reads_what_was_logged(caplog):
    cart = Cart()
    cart.add("tv", price=2000)
    with caplog.at_level(logging.WARNING, logger="shop.receipt"):
        print_receipt(cart)
    assert [r.levelname for r in caplog.records] == ["WARNING"]
    assert "large order" in caplog.text
