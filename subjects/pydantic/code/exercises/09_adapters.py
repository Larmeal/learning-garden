"""Lesson 9: TypeAdapter, validate_call, pydantic dataclasses, TypedDict, JSON Schema."""

import dataclasses
from typing import Annotated, NamedTuple, TypedDict

from pydantic import (
    BaseModel,
    Field,
    PositiveInt,
    TypeAdapter,
    ValidationError,
    validate_call,
)
from pydantic.dataclasses import dataclass as pdataclass

# TypeAdapter: validation and serialization for any type, no model class needed.
ta = TypeAdapter(list[int])
assert ta.validate_python(["1", 2]) == [1, 2]
assert ta.validate_json("[1, 2, 3]") == [1, 2, 3]
assert ta.dump_python([1, 2]) == [1, 2] and ta.dump_json([1, 2]) == b"[1,2]"  # dump_json returns bytes
assert ta.json_schema() == {"type": "array", "items": {"type": "integer"}}

Users = TypeAdapter(dict[str, Annotated[int, Field(ge=0)]])
assert Users.validate_python({"a": "1"}) == {"a": 1}
try:
    Users.validate_python({"a": -1})
except ValidationError as e:
    assert e.errors()[0]["loc"] == ("a",) and e.errors()[0]["type"] == "greater_than_equal"


# TypedDict and NamedTuple are validated into plain dicts and tuples (not classes of ours).
class Movie(TypedDict):
    title: str
    year: int


m = TypeAdapter(Movie).validate_python({"title": "x", "year": "1999"})
assert m == {"title": "x", "year": 1999} and type(m) is dict


class Pt(NamedTuple):
    x: int
    y: int


assert TypeAdapter(Pt).validate_python(("1", "2")) == Pt(1, 2)

# Pydantic dataclasses: the standard dataclass syntax with validation.
@pdataclass
class Item:
    sku: str
    qty: PositiveInt = 1


assert Item("A", "3").qty == 3 and dataclasses.is_dataclass(Item)
try:
    Item("A", 0)
except ValidationError as e:
    assert e.errors()[0]["type"] == "greater_than"
assert dataclasses.asdict(Item("A", 2)) == {"sku": "A", "qty": 2}
assert TypeAdapter(Item).validate_python({"sku": "A", "qty": "2"}) == Item("A", 2)  # a dict is accepted too


# validate_call: validate the arguments (and optionally the return value) of a function.
@validate_call
def add(a: int, b: int = 1) -> int:
    return a + b


assert add("2", b="3") == 5
try:
    add("x")
except ValidationError as e:
    print(e.errors(include_url=False)[0])
    assert e.errors()[0]["loc"] == (0,) and e.errors()[0]["type"] == "int_parsing"
try:
    add(1, 2, 3)
except ValidationError as e:
    assert e.errors()[0]["type"] == "unexpected_positional_argument"
try:
    add(1, c=3)
except ValidationError as e:
    assert e.errors()[0]["type"] == "unexpected_keyword_argument"


@validate_call(validate_return=True)
def bad_return(a: int) -> int:
    return "not an int"  # type: ignore[return-value]


try:
    bad_return(1)
except ValidationError as e:
    assert e.errors()[0]["type"] == "int_parsing"
assert add.__name__ == "add"
assert add.raw_function(1, 2) == 3  # the original, with no validation


# Defaults are not validated in validate_call either, and models as arguments are built from dicts.
class Cfg(BaseModel):
    n: int


@validate_call
def use(cfg: Cfg) -> int:
    return cfg.n


assert use({"n": "4"}) == 4

# JSON Schema: from a model, in validation mode and in serialization mode.
class Product(BaseModel):
    """A product in the catalogue."""

    sku: str = Field(min_length=3, description="stock keeping unit", examples=["AB-1"])
    price: float = Field(gt=0)
    tags: list[str] = []
    note: str | None = None


schema = Product.model_json_schema()
assert schema["required"] == ["sku", "price"]
assert schema["properties"]["sku"]["minLength"] == 3
assert schema["properties"]["price"]["exclusiveMinimum"] == 0
assert schema["properties"]["note"]["anyOf"] == [{"type": "string"}, {"type": "null"}]
assert schema["title"] == "Product" and schema["description"] == "A product in the catalogue."
assert Product.model_json_schema(mode="serialization")["required"] == ["sku", "price"]  # defaults stay optional


class Product2(Product):
    model_config = {"json_schema_serialization_defaults_required": True}


assert Product2.model_json_schema(mode="serialization")["required"] == ["sku", "price", "tags", "note"]


# Nested models go to $defs and are referenced.
class Basket(BaseModel):
    items: list[Product]


bs = Basket.model_json_schema()
assert bs["properties"]["items"]["items"] == {"$ref": "#/$defs/Product"} and "Product" in bs["$defs"]

# Anything a validator does in Python is invisible to JSON Schema.
class Odd(BaseModel):
    n: int

    from pydantic import field_validator

    @field_validator("n")
    @classmethod
    def even(cls, v):
        if v % 2:
            raise ValueError("odd")
        return v


assert Odd.model_json_schema()["properties"]["n"] == {"title": "N", "type": "integer"}

# Reusing the adapter is the point: building it is the expensive step.
import timeit

build_each_time = timeit.timeit(lambda: TypeAdapter(list[int]).validate_python([1, 2, 3]), number=200)
reuse = timeit.timeit(lambda: ta.validate_python([1, 2, 3]), number=200)
print(f"build each call {build_each_time * 1000:.1f} ms, reuse {reuse * 1000:.2f} ms for 200 calls, ratio {build_each_time / reuse:.0f}x")
assert build_each_time > 20 * reuse
print("ok")
