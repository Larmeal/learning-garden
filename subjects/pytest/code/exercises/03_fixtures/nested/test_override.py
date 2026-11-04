def test_the_nearest_conftest_wins(cart):
    assert cart.skus() == ["override"]
