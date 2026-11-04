"""Lesson 4: unions. Smart mode, left to right, discriminated unions."""

from typing import Annotated, Literal, Union

from pydantic import BaseModel, Discriminator, Field, Tag, TypeAdapter, ValidationError


def ok(tp, value, **kw):
    return TypeAdapter(tp).validate_python(value, **kw)


def errs(tp, value):
    try:
        TypeAdapter(tp).validate_python(value)
    except ValidationError as e:
        return [(".".join(map(str, x["loc"])), x["type"]) for x in e.errors()]


# Smart mode (the default) prefers an exact type match over a conversion.
v = ok(Union[int, str], "5")
assert v == "5" and type(v) is str  # "5" is already a str, so no coercion to int
v = ok(Union[int, str], 5)
assert v == 5 and type(v) is int
v = ok(Union[int, float], "5")  # no exact match: lax conversion decides
print("Union[int, float] <- '5':", repr(v))
v = ok(Union[float, int], 5)
assert type(v) is int  # exact match wins whatever the order
v = ok(Union[str, int], 5.0)
print("Union[str, int] <- 5.0:", repr(v))


# left_to_right takes the first member that succeeds, in lax mode.
class LeftToRight(BaseModel):
    x: Union[int, str] = Field(union_mode="left_to_right")


assert LeftToRight(x="5").x == 5 and type(LeftToRight(x="5").x) is int

# Optional is just Union[X, None].
assert ok(int | None, None) is None and ok(int | None, "3") == 3

# Errors of a plain union: one entry per member.
e = errs(Union[int, list[int]], "x")
print(e)
assert e == [("int", "int_parsing"), ("list[int]", "list_type")]


# Models in a union: smart mode picks the member that fits best.
class Cat(BaseModel):
    name: str
    lives: int = 9


class Dog(BaseModel):
    name: str
    good_boy: bool = True


assert type(ok(Union[Cat, Dog], {"name": "x", "good_boy": False})) is Dog
assert type(ok(Union[Cat, Dog], {"name": "x", "lives": 3})) is Cat
print("tie goes to:", type(ok(Union[Cat, Dog], {"name": "x"})).__name__)
print("tie, swapped:", type(ok(Union[Dog, Cat], {"name": "x"})).__name__)


# Discriminated union: look at one field, validate only that member.
class CardPay(BaseModel):
    kind: Literal["card"]
    number: str


class QrPay(BaseModel):
    kind: Literal["qr"]
    ref: str


Pay = Annotated[Union[CardPay, QrPay], Field(discriminator="kind")]
assert type(ok(Pay, {"kind": "qr", "ref": "r1"})) is QrPay
assert errs(Pay, {"kind": "cash"}) == [("", "union_tag_invalid")], errs(Pay, {"kind": "cash"})
assert errs(Pay, {"ref": "r1"}) == [("", "union_tag_not_found")]
assert errs(Pay, {"kind": "card"}) == [("card.number", "missing")]  # only CardPay is tried
plain = errs(Union[CardPay, QrPay], {"kind": "card"})  # the same input in a plain union reports every member
print(plain)
assert plain == [("CardPay.number", "missing"), ("QrPay.kind", "literal_error"), ("QrPay.ref", "missing")]

# JSON text works the same way.
assert type(TypeAdapter(Pay).validate_json('{"kind":"card","number":"4111"}')) is CardPay


# Callable discriminator with Tag, for input that has no tag field.
def which(v):
    if isinstance(v, int):
        return "int"
    if isinstance(v, str):
        return "str"
    return None


Either = Annotated[Union[Annotated[int, Tag("int")], Annotated[str, Tag("str")]], Discriminator(which)]
assert ok(Either, "5") == "5" and ok(Either, 5) == 5
assert errs(Either, 5.5) == [("", "union_tag_not_found")]
print("ok")
