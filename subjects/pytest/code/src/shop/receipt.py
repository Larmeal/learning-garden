"""Output side effects: printing a receipt and logging a warning."""

import logging

from shop.cart import Cart

log = logging.getLogger("shop.receipt")


def print_receipt(cart: Cart) -> None:
    for sku in cart.skus():
        print(f"{sku} x{cart.qty(sku)}")
    print(f"TOTAL {cart.total():.2f}")
    if cart.total() > 1000:
        log.warning("large order: %.2f", cart.total())
