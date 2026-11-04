"""Lesson 6: ValidationError. Anatomy, loc paths, custom errors, JSON output."""

import json

from pydantic import BaseModel, ValidationError, field_validator
from pydantic_core import PydanticCustomError, PydanticKnownError


class Item(BaseModel):
    sku: str
    qty: int


class Order(BaseModel):
    id: int
    items: list[Item]
    meta: dict[str, int] = {}


bad = {"id": "x", "items": [{"sku": "A", "qty": 1}, {"sku": 5, "qty": "y"}], "meta": {"k": "v"}}
try:
    Order.model_validate(bad)
except ValidationError as e:
    err = e
else:
    raise AssertionError

# One exception, every problem found (not just the first).
assert err.error_count() == 4 and err.title == "Order"
assert isinstance(err, ValueError)
assert [x["loc"] for x in err.errors()] == [("id",), ("items", 1, "sku"), ("items", 1, "qty"), ("meta", "k")]
first = err.errors()[0]
print(first)
assert set(first) == {"type", "loc", "msg", "input", "url"}
assert first["input"] == "x" and first["type"] == "int_parsing"
print(err.errors(include_url=False, include_input=False)[1])

# json() / errors() are for programs, str() is for people.
assert json.loads(err.json())[0]["type"] == "int_parsing"
assert str(err).splitlines()[0] == "4 validation errors for Order"
assert str(err).splitlines()[1] == "id"
assert "items.1.sku" in str(err)

# model_validate_json reports the same locations, with a JSON position of the input.
try:
    Order.model_validate_json('{"id": 1, "items": [{"sku": "A"}]}')
except ValidationError as e:
    assert e.errors()[0]["loc"] == ("items", 0, "qty") and e.errors()[0]["type"] == "missing"
try:
    Order.model_validate_json('{"id": 1, "items": [')
except ValidationError as e:
    print(e.errors(include_url=False)[0])
    assert e.errors()[0]["type"] == "json_invalid"

# The error type tells you what kind of problem it is. Messages can be replaced, the type is the stable part.
assert Order.model_validate({"id": 1, "items": []}).items == []

# Custom errors: PydanticCustomError has your own type and message template.
class Coupon(BaseModel):
    code: str

    @field_validator("code")
    @classmethod
    def known(cls, v):
        if v not in {"SAVE10"}:
            raise PydanticCustomError("unknown_coupon", "coupon {code} does not exist", {"code": v})
        return v

    @field_validator("code")
    @classmethod
    def not_expired(cls, v):
        raise PydanticKnownError("greater_than", {"gt": 0})  # reuse a built-in type with its own context


try:
    Coupon(code="NOPE")
except ValidationError as e:
    x = e.errors()[0]
    print(x["type"], "|", x["msg"], "|", x["ctx"])
    assert x["type"] == "unknown_coupon" and x["msg"] == "coupon NOPE does not exist" and x["ctx"] == {"code": "NOPE"}

# Only ValueError, AssertionError and the two classes above become validation errors. A bug stays a bug.
class Buggy(BaseModel):
    a: int

    @field_validator("a")
    @classmethod
    def boom(cls, v):
        return 1 / 0


try:
    Buggy(a=1)
except ZeroDivisionError:
    print("ZeroDivisionError escapes")

# A ValueError carries its original exception in ctx["error"].
class V(BaseModel):
    a: int

    @field_validator("a")
    @classmethod
    def small(cls, v):
        raise ValueError("too big")


try:
    V(a=1)
except ValidationError as e:
    ctx = e.errors()[0]["ctx"]
    assert isinstance(ctx["error"], ValueError) and str(ctx["error"]) == "too big"
    assert e.errors(include_context=False)[0].get("ctx") is None
    try:
        json.dumps(e.errors())
    except TypeError:
        print("errors() with a ctx exception is not JSON serialisable, use e.json()")
    assert json.loads(e.json())[0]["ctx"] == {"error": "too big"}

# Hiding the input value (useful for passwords).
class Secretish(BaseModel):
    pw: int


try:
    Secretish(pw="hunter2")
except ValidationError as e:
    assert "hunter2" in str(e)
    assert "hunter2" not in str(e.errors(include_input=False)[0])

# hide_input_in_errors in config removes it from the text too.
class Hidden(BaseModel):
    model_config = {"hide_input_in_errors": True}
    pw: int


try:
    Hidden(pw="hunter2")
except ValidationError as e:
    assert "hunter2" not in str(e)
    print(str(e).splitlines()[2])
print("ok")
