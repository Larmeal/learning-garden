"""Lesson isolation, deep dive: spec and autospec, side_effect, patch.dict, a guard against real network calls,
and the rest of monkeypatch."""

import os
import sys
from unittest import mock

import pytest

from shop import net, rates
from shop.cart import Cart
from shop.checkout import checkout


# --- a Mock accepts anything, a spec does not ----------------------------------------------------------------

def test_a_plain_mock_accepts_a_misspelled_method():
    gateway = mock.Mock()
    gateway.chargee(100, "A-1")  # typo, and nothing complains
    gateway.chargee.assert_called_once()


def test_spec_rejects_attributes_the_real_class_does_not_have():
    gateway = mock.Mock(spec=["charge"])
    with pytest.raises(AttributeError):
        gateway.chargee(100, "A-1")


class RealGateway:
    def charge(self, amount, order_id):
        raise NotImplementedError


def test_autospec_also_checks_the_signature():
    gateway = mock.create_autospec(RealGateway, instance=True)
    gateway.charge.return_value = True
    cart = Cart()
    cart.add("apple", price=100)
    assert checkout(cart, gateway, "A-1") == 100
    with pytest.raises(TypeError):
        gateway.charge(1)  # missing order_id: the real signature is enforced


# --- side_effect: a sequence, an exception, a function -------------------------------------------------------

def test_side_effect_with_a_list_returns_one_value_per_call():
    fake = mock.Mock(side_effect=[0.03, 0.04])
    assert (fake(), fake()) == (0.03, 0.04)
    with pytest.raises(StopIteration):
        fake()


def test_side_effect_with_an_exception_raises_it():
    fake = mock.Mock(side_effect=ConnectionError("down"))
    with pytest.raises(ConnectionError, match="down"):
        fake()


def test_side_effect_with_a_function_computes_the_answer():
    fake = mock.Mock(side_effect=lambda currency: {"USD": 0.03, "EUR": 0.025}[currency])
    assert fake("EUR") == 0.025


def test_the_first_call_fails_then_it_recovers():
    fake = mock.Mock(side_effect=[ConnectionError("blip"), {"rate": 0.03}])
    with pytest.raises(ConnectionError):
        fake()
    assert fake() == {"rate": 0.03}
    assert fake.call_count == 2


# --- inspecting calls ---------------------------------------------------------------------------------------

def test_call_args_and_call_args_list():
    fake = mock.Mock(return_value=True)
    fake(1, "a", flag=True)
    fake(2, "b")
    assert fake.call_args == mock.call(2, "b")
    assert fake.call_args_list == [mock.call(1, "a", flag=True), mock.call(2, "b")]
    fake.assert_any_call(1, "a", flag=True)
    fake.assert_called_with(2, "b")


# --- patch.dict and patch as a decorator ----------------------------------------------------------------------

def test_patch_dict_restores_the_dictionary():
    with mock.patch.dict(os.environ, {"SHOP_MODE": "test"}):
        assert os.environ["SHOP_MODE"] == "test"
    assert "SHOP_MODE" not in os.environ


@mock.patch.object(rates, "fetch_rate", return_value=0.5)
def test_patch_as_a_decorator_passes_the_mock_as_an_argument(fake):
    assert rates.convert(10, "USD") == 5.0
    fake.assert_called_once_with("USD")


# --- the rest of monkeypatch ------------------------------------------------------------------------------------

def test_delenv_and_delattr(monkeypatch):
    monkeypatch.setenv("SHOP_X", "1")
    monkeypatch.delenv("SHOP_X")
    assert "SHOP_X" not in os.environ
    monkeypatch.delenv("SHOP_NEVER_SET", raising=False)  # raising=False: no error when it is absent
    with pytest.raises(KeyError):
        monkeypatch.delenv("SHOP_NEVER_SET")


def test_setitem_and_chdir(monkeypatch, tmp_path):
    table = {"a": 1}
    monkeypatch.setitem(table, "a", 2)
    assert table == {"a": 2}
    monkeypatch.chdir(tmp_path)
    assert os.getcwd() == str(tmp_path.resolve()) or os.path.samefile(os.getcwd(), tmp_path)


def test_syspath_prepend_makes_a_module_importable(monkeypatch, tmp_path):
    (tmp_path / "shop_temp_module.py").write_text("VALUE = 42\n", encoding="utf-8")
    monkeypatch.syspath_prepend(tmp_path)
    import shop_temp_module

    assert shop_temp_module.VALUE == 42
    sys.modules.pop("shop_temp_module", None)


def test_setattr_with_a_string_target_and_raising(monkeypatch):
    monkeypatch.setattr("shop.rates.fetch_rate", lambda c: 1.0)
    assert rates.convert(7, "USD") == 7.0
    with pytest.raises(AttributeError):
        monkeypatch.setattr(rates, "no_such_attribute", 1)  # raising=True is the default: a typo is an error


def test_monkeypatch_context_undoes_before_the_test_ends():
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(rates, "fetch_rate", lambda c: 1.0)
        assert rates.convert(1, "USD") == 1.0
    with pytest.raises(ConnectionError):
        rates.convert(1, "USD")


# --- a guard: make the real network impossible in every test of this folder ---------------------------------

@pytest.fixture(autouse=True)
def no_real_network(monkeypatch):
    def refuse(url):
        raise AssertionError(f"a test tried to reach the network: {url}")

    monkeypatch.setattr(net, "fetch_json", refuse)


def test_the_guard_turns_a_forgotten_replacement_into_a_clear_failure(monkeypatch):
    # rates.py imported the name itself, so the guard has to patch where it is used as well
    with pytest.raises(ConnectionError):
        rates.convert(1, "USD")  # rates.fetch_json is still the original, which raises ConnectionError
    monkeypatch.setattr(rates, "fetch_json", net.fetch_json)  # net.fetch_json is the guard now
    with pytest.raises(AssertionError, match="tried to reach the network"):
        rates.convert(1, "USD")
