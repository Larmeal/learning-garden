"""Lesson 3: lax and strict mode, and the types that come with Pydantic."""

import enum
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Annotated, Literal

from pydantic import (
    AnyUrl,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    HttpUrl,
    NonNegativeFloat,
    PositiveInt,
    SecretStr,
    Strict,
    StrictInt,
    TypeAdapter,
    ValidationError,
    conint,
)


def ok(tp, value, **kw):
    return TypeAdapter(tp).validate_python(value, **kw)


def err(tp, value, **kw):
    try:
        TypeAdapter(tp).validate_python(value, **kw)
    except ValidationError as e:
        return e.errors()[0]["type"]
    return None


# The lax table (what Python input is converted to) for a few types.
assert ok(int, "42") == 42 and ok(int, 7.0) == 7 and ok(int, b"5") == 5
assert err(int, 7.5) == "int_from_float" and err(int, None) == "int_type" and err(int, "7x") == "int_parsing"
assert ok(float, "1e3") == 1000.0 and ok(float, 3) == 3.0 and type(ok(float, 3)) is float
assert ok(str, b"bytes") == "bytes"
assert err(str, 123) == "string_type"  # a number is NOT turned into a string
assert ok(bool, "true") is True and ok(bool, 0) is False and err(bool, 2) == "bool_parsing"
assert ok(list[int], ("1", 2)) == [1, 2] and ok(set[int], [1, 1, 2]) == {1, 2}
assert ok(tuple[int, str], ["1", "a"]) == (1, "a")
assert ok(dict[str, int], {"a": "1"}) == {"a": 1}

# Strict mode refuses the conversions. Three ways to ask for it.
assert err(int, "42", strict=True) == "int_type"
assert err(StrictInt, "42") == "int_type"
assert err(Annotated[int, Strict()], "42") == "int_type"
assert ok(int, 5, strict=True) == 5
assert err(int, True, strict=True) == "int_type"  # even a bool is refused
assert err(float, 3, strict=True) is None  # int is still accepted for float in strict mode


class StrictModel(BaseModel):
    model_config = ConfigDict(strict=True)
    n: int
    when: datetime


assert StrictModel(n=1, when=datetime(2026, 1, 1)).n == 1
try:
    StrictModel(n="1", when="2026-01-01T00:00:00")
except ValidationError as e:
    assert [x["type"] for x in e.errors()] == ["int_type", "datetime_type"]


# Strict is per field too, and strict treats Python input differently from JSON input.
class Mixed(BaseModel):
    a: int = Field(strict=True)
    b: int


assert Mixed(a=1, b="2").b == 2
try:
    Mixed(a="1", b=2)
except ValidationError as e:
    assert e.errors()[0]["type"] == "int_type"


class StrictDate(BaseModel):
    model_config = ConfigDict(strict=True)
    d: date


assert StrictDate.model_validate_json('{"d": "2026-01-31"}').d == date(2026, 1, 31)  # JSON has no date type
try:
    StrictDate.model_validate({"d": "2026-01-31"})  # Python input must be a real date
except ValidationError as e:
    assert e.errors()[0]["type"] == "date_type"

# Dates and times.
assert ok(datetime, "2026-03-01T10:00:00Z") == datetime(2026, 3, 1, 10, tzinfo=timezone.utc)
assert ok(datetime, 0) == datetime(1970, 1, 1, tzinfo=timezone.utc)  # a number is unix seconds
assert ok(datetime, 2026) == datetime(1970, 1, 1, 0, 33, 46, tzinfo=timezone.utc)  # the trap: a year read as seconds
assert err(datetime, 2026, strict=True) == "datetime_type"
assert ok(date, "2026-03-01") == date(2026, 3, 1)
assert ok(timedelta, "PT1H30M") == timedelta(hours=1, minutes=30)
assert ok(timedelta, 90) == timedelta(seconds=90)
print("2026-02-30 ->", err(date, "2026-02-30"))

# Decimal, UUID, Path, enum, Literal.
assert ok(Decimal, "19.90") == Decimal("19.90") and ok(Decimal, 0.1) == Decimal("0.1")
u = uuid.uuid4()
assert ok(uuid.UUID, str(u)) == u and ok(uuid.UUID, str(u)).version == 4
assert ok(Path, "/tmp/x") == Path("/tmp/x")


class Status(enum.Enum):
    NEW = "new"
    PAID = "paid"


assert ok(Status, "paid") is Status.PAID and err(Status, "late") == "enum"
assert ok(Literal["a", "b"], "a") == "a" and err(Literal["a", "b"], "c") == "literal_error"

# Constrained and ready-made types.
assert err(PositiveInt, 0) == "greater_than" and err(conint(ge=1, le=5), 9) == "less_than_equal"
assert err(NonNegativeFloat, -0.1) == "greater_than_equal"
url = ok(HttpUrl, "https://example.com/a?x=1#top")
assert (url.scheme, url.host, url.path, url.query, url.fragment) == ("https", "example.com", "/a", "x=1", "top")
assert str(ok(HttpUrl, "https://example.com")) == "https://example.com/"  # the path is added
assert err(HttpUrl, "ftp://example.com") == "url_scheme" and err(AnyUrl, "not a url") == "url_parsing"
assert ok(EmailStr, "Ann@Example.COM") == "Ann@example.com"
assert err(EmailStr, "ann@") is not None


class Login(BaseModel):
    user: str
    password: SecretStr


login = Login(user="u", password="hunter2")
assert repr(login) == "Login(user='u', password=SecretStr('**********'))"
assert login.password.get_secret_value() == "hunter2"
assert login.model_dump()["password"] != "hunter2"  # still masked in python mode
assert login.model_dump_json() == '{"user":"u","password":"**********"}'

# Containers are copied, not shared with the caller.
src = [1, 2]


class Box(BaseModel):
    items: list[int]


box = Box(items=src)
src.append(3)
assert box.items == [1, 2]
assert box.items is not src
print("ok")
