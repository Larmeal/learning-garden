"""Lesson 1: the first model. Type hints become checks, and input is coerced (lax mode)."""

from dataclasses import dataclass

from pydantic import BaseModel, ValidationError


# A plain class and a dataclass read type hints but never check them.
class Plain:
    id: int

    def __init__(self, id):
        self.id = id


@dataclass
class Row:
    id: int


assert Plain("not a number").id == "not a number"
assert Row(id="not a number").id == "not a number"


class Customer(BaseModel):
    id: int
    name: str
    email: str
    is_vip: bool = False


# Lax mode: "42" becomes 42, and the result is a real int.
c = Customer(id="42", name="Ann", email="ann@example.com")
assert c.id == 42 and type(c.id) is int
print("repr:", repr(c))
print("str :", str(c))

# What lax mode accepts for int and bool.
assert Customer(id=3.0, name="a", email="e").id == 3
assert Customer(id=True, name="a", email="e").id == 1  # bool is an int subclass, and it is accepted
for text, want in [("yes", True), ("no", False), ("1", True), ("off", False), ("T", True)]:
    assert Customer(id=1, name="a", email="e", is_vip=text).is_vip is want
assert Customer(id=1, name="a", email="e", is_vip=1).is_vip is True

# What it rejects.
bad = {"id": 3.5, "name": None, "is_vip": "maybe"}
try:
    Customer(**bad)
except ValidationError as e:
    print(e)
    print("error_count:", e.error_count())
    assert e.error_count() == 4  # id, name, email (missing), is_vip
    kinds = {tuple(x["loc"]): x["type"] for x in e.errors()}
    assert kinds == {
        ("id",): "int_from_float",
        ("name",): "string_type",
        ("email",): "missing",
        ("is_vip",): "bool_parsing",
    }, kinds
else:
    raise AssertionError("should have failed")

# A string that is not a number, and "3.0" as a string.
for value in ["abc", "3.5"]:
    try:
        Customer(id=value, name="a", email="e")
    except ValidationError as e:
        assert e.errors()[0]["type"] == "int_parsing"
assert Customer(id="3.0", name="a", email="e").id == 3

# Entry points.
assert Customer.model_validate({"id": 1, "name": "Ann", "email": "a@x"}).name == "Ann"
j = Customer.model_validate_json('{"id": 1, "name": "Ann", "email": "a@x"}')
assert j == Customer(id=1, name="Ann", email="a@x")
print("model_dump     :", j.model_dump())
print("model_dump_json:", j.model_dump_json())

# Unknown keys are ignored by default, and fields are keyword only.
assert not hasattr(Customer(id=1, name="a", email="e", nickname="x"), "nickname")
try:
    Customer(1, "a", "e")
except TypeError as e:
    print("positional:", e)

# model_fields_set remembers what the caller actually passed.
assert j.model_fields_set == {"id", "name", "email"}
assert Customer(id=1, name="a", email="e", is_vip=False).model_fields_set == {"id", "name", "email", "is_vip"}

# Validation runs on construction only. Assignment is not checked by default.
j.id = "oops"
assert j.id == "oops"
print("ok")
