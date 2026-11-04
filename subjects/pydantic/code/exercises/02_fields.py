"""Lesson 2: Field, defaults, constraints, aliases, Annotated."""

from datetime import datetime
from typing import Annotated, Optional

from pydantic import BaseModel, ConfigDict, Field, ValidationError, AliasChoices, AliasPath


def errors_of(model, **data):
    try:
        model(**data)
    except ValidationError as e:
        return [(".".join(map(str, x["loc"])), x["type"]) for x in e.errors()]
    return []


# Required, optional with default, and "nullable".
class A(BaseModel):
    required: int
    with_default: int = 5
    nullable_required: Optional[int]  # may be None, but must be passed
    nullable_default: Optional[int] = None
    ellipsis: int = Field(...)  # same as required


assert errors_of(A) == [("required", "missing"), ("nullable_required", "missing"), ("ellipsis", "missing")]
assert A(required=1, nullable_required=None, ellipsis=1).nullable_default is None

# Defaults are not validated, mutable defaults are copied.
class B(BaseModel):
    tags: list[str] = []
    n: int = "not checked"


b1, b2 = B(), B()
b1.tags.append("x")
assert b2.tags == [] and B().n == "not checked"


class B2(BaseModel):
    n: int = Field("5", validate_default=True)


assert B2().n == 5


# default_factory runs once per instance, and can use already validated fields from v2.10.
class Stamp(BaseModel):
    created: datetime = Field(default_factory=datetime.now)


assert Stamp().created <= Stamp().created


class WithData(BaseModel):
    first: str
    slug: str = Field(default_factory=lambda data: data["first"].lower())


assert WithData(first="Ann").slug == "ann"

# Constraints.
class Line(BaseModel):
    sku: str = Field(min_length=3, max_length=8, pattern=r"^[A-Z]+-\d+$")
    qty: int = Field(gt=0, le=100)
    price: float = Field(ge=0)
    note: str = Field("", max_length=10)


assert errors_of(Line, sku="ab", qty=0, price=-1) == [
    ("sku", "string_too_short"),
    ("qty", "greater_than"),
    ("price", "greater_than_equal"),
]
assert errors_of(Line, sku="abc-1", qty=1, price=0) == [("sku", "string_pattern_mismatch")]
assert errors_of(Line, sku="ABC-1", qty=1, price=0) == []
try:
    Line(sku="ABC-1", qty=0, price=0)
except ValidationError as e:
    print(e.errors()[0]["ctx"], "|", e.errors()[0]["msg"])
    assert e.errors()[0]["ctx"] == {"gt": 0}

# Annotated: put the constraint on the type and reuse it.
Qty = Annotated[int, Field(gt=0, le=100)]
Sku = Annotated[str, Field(pattern=r"^[A-Z]+-\d+$")]


class Line2(BaseModel):
    sku: Sku
    qty: Qty
    backorder: Qty = 1
    parts: list[Qty] = []


assert errors_of(Line2, sku="X-1", qty=5, parts=[1, 0, 101]) == [("parts.1", "greater_than"), ("parts.2", "less_than_equal")]

# Aliases: three kinds.
class Alias(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    user_id: int = Field(alias="userId")


assert Alias(userId=1).user_id == 1
assert Alias(user_id=1).user_id == 1  # populate_by_name
assert Alias(userId=1).model_dump() == {"user_id": 1}
assert Alias(userId=1).model_dump(by_alias=True) == {"userId": 1}


class Strict(BaseModel):
    user_id: int = Field(alias="userId")


assert errors_of(Strict, user_id=1) == [("userId", "missing")]


class Kinds(BaseModel):
    a: int = Field(validation_alias="in_a", serialization_alias="out_a")
    b: int = Field(validation_alias=AliasChoices("b", "bee", "B"), default=0)
    city: str = Field(validation_alias=AliasPath("address", "city"))


k = Kinds(in_a=1, bee=2, address={"city": "Chiang Mai"})
assert (k.a, k.b, k.city) == (1, 2, "Chiang Mai")
assert k.model_dump(by_alias=True) == {"out_a": 1, "b": 2, "city": "Chiang Mai"}

# exclude, repr, frozen on a field, description in JSON Schema.
class Account(BaseModel):
    user: str
    password: str = Field(exclude=True, repr=False, description="never leaves the process")
    token: str = Field(frozen=True, default="t")


acc = Account(user="u", password="p")
assert acc.model_dump() == {"user": "u", "token": "t"}
assert "password" not in repr(acc)
try:
    acc.token = "new"
except ValidationError as e:
    print(e.errors()[0]["type"])
    assert e.errors()[0]["type"] == "frozen_field"
assert Account.model_json_schema()["properties"]["password"]["description"] == "never leaves the process"
assert Account.model_fields["password"].is_required()
print(Account.model_fields["user"])

# pattern uses the Rust regex engine: lookahead is rejected when the class is created, python-re allows it.
from pydantic_core import SchemaError

try:
    class Look(BaseModel):
        s: str = Field(pattern=r"^(?=a)a$")
except SchemaError:
    pass
else:
    raise AssertionError("lookahead should not compile in the default engine")


class Look2(BaseModel):
    model_config = ConfigDict(regex_engine="python-re")
    s: str = Field(pattern=r"^(?=a)a$")


assert Look2(s="a").s == "a"
print("ok")
