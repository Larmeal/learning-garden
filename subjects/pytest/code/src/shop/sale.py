"""Code that depends on the clock. The `today` argument is what makes it testable without patching time."""

import datetime as dt


def is_sale_day(today: dt.date | None = None) -> bool:
    """The sale runs on the 11th of every month and on every Friday the 13th."""
    today = today or dt.date.today()
    return today.day == 11 or (today.day == 13 and today.weekday() == 4)


def greeting_now() -> str:
    """The same idea, but hard-wired to the clock (the hard way to test)."""
    hour = dt.datetime.now().hour
    return "good morning" if hour < 12 else "good afternoon"
