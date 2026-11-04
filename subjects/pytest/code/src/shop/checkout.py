"""Checkout talks to a payment gateway. The gateway is passed in, so a test can hand over a fake."""

from typing import Protocol

from shop.cart import Cart, EmptyCartError


class PaymentDeclined(Exception):
    pass


class Gateway(Protocol):
    def charge(self, amount: float, order_id: str) -> bool: ...


def checkout(cart: Cart, gateway: Gateway, order_id: str, coupon: str | None = None) -> float:
    """Charge the customer and return the amount charged. The cart is cleared only when the charge succeeds."""
    if cart.is_empty():
        raise EmptyCartError("nothing to check out")
    amount = cart.apply_coupon(coupon) if coupon else cart.total()
    if not gateway.charge(amount, order_id):
        raise PaymentDeclined(order_id)
    for sku in cart.skus():
        cart.remove(sku)
    return amount
