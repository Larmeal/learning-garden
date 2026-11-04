"""The only module that would touch the network. Tests must never call it for real."""


def fetch_json(url: str) -> dict:
    raise ConnectionError(f"no network in tests: {url}")
