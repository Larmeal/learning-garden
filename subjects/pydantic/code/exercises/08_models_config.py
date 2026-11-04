"""Lesson 8: ConfigDict, nesting, inheritance, RootModel, generics, from_attributes, construct."""

from dataclasses import dataclass
from typing import Generic, TypeVar

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PrivateAttr,
    RootModel,
    ValidationError,
)


def err_types(model, **data):
    try:
        model(**data)
    except ValidationError as e:
        return [x["type"] for x in e.errors()]
    return []


# extra: ignore (default), forbid, allow.
class Ignore(BaseModel):
    a: int


class Forbid(BaseModel):
    model_config = ConfigDict(extra="forbid")
    a: int


class Allow(BaseModel):
    model_config = ConfigDict(extra="allow")
    a: int


assert Ignore(a=1, b=2).model_dump() == {"a": 1}
assert err_types(Forbid, a=1, b=2) == ["extra_forbidden"]
x = Allow(a=1, b=2)
assert x.model_dump() == {"a": 1, "b": 2} and x.b == 2 and x.model_extra == {"b": 2}

# frozen: immutable and hashable.
class Point(BaseModel):
    model_config = ConfigDict(frozen=True)
    x: int


p = Point(x=1)
try:
    p.x = 2
except ValidationError as e:
    assert e.errors()[0]["type"] == "frozen_instance"
assert hash(p) == hash(Point(x=1)) and {p: 1}[Point(x=1)] == 1


# validate_assignment: check on every assignment.
class Checked(BaseModel):
    model_config = ConfigDict(validate_assignment=True)
    n: int


c = Checked(n=1)
c.n = "5"
assert c.n == 5
try:
    c.n = "x"
except ValidationError as e:
    assert e.errors()[0]["type"] == "int_parsing"
assert c.n == 5  # a failed assignment leaves the old value


# String clean-up and other global switches.
class Clean(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, str_to_lower=True, str_min_length=1)
    name: str


assert Clean(name="  ANN ").name == "ann" and err_types(Clean, name="   ") == ["string_too_short"]

# from_attributes: read an object, not a dict.
@dataclass
class Row:
    id: int
    name: str


class Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


assert Out.model_validate(Row(1, "a")).name == "a"
try:
    class NoAttrs(BaseModel):
        id: int
        name: str

    NoAttrs.model_validate(Row(1, "a"))
except ValidationError as e:
    assert e.errors()[0]["type"] == "model_type"
assert Out.model_validate(Row(1, "a"), from_attributes=True).id == 1  # also a per-call switch


# Nested models: a dict is validated into the inner model, an instance is kept as it is.
class Address(BaseModel):
    city: str


class Person(BaseModel):
    name: str
    address: Address


home = Address(city="BKK")
person = Person(name="a", address=home)
assert person.address is home  # instance reused, not copied (revalidate_instances is "never")
assert Person(name="a", address={"city": "CNX"}).address.city == "CNX"


# revalidate_instances is read from the config of the class being validated (the inner one), not the outer one.
class Revalidating(BaseModel):
    model_config = ConfigDict(revalidate_instances="always")
    city: str


class Holder(BaseModel):
    inner: Revalidating


r = Revalidating(city="BKK")
assert Holder(inner=r).inner is not r and Holder(inner=r).inner == r


class Outer(BaseModel):
    model_config = ConfigDict(revalidate_instances="always")
    address: Address


assert Outer(address=home).address is home  # the setting on the outer class does nothing to the inner one


class SubAddress(Address):
    pass


class Loose(BaseModel):
    model_config = ConfigDict(revalidate_instances="subclass-instances")
    city: str


class LooseChild(Loose):
    pass


class HolderLoose(BaseModel):
    inner: Loose


lc = LooseChild(city="x")
assert type(HolderLoose(inner=lc).inner) is Loose  # the subclass instance is rebuilt as the declared class

# Inheritance: fields are collected from bases, and a subclass can add or override.
class Base(BaseModel):
    id: int


class Child(Base):
    name: str = "x"


assert list(Child.model_fields) == ["id", "name"]
assert err_types(Child) == ["missing"]


# RootModel: a model whose value is not a dict.
class Tags(RootModel[list[str]]):
    def first(self):
        return self.root[0]


t = Tags(["a", "b"])
assert t.first() == "a" and t.model_dump() == ["a", "b"] and t.model_dump_json() == '["a","b"]'
assert Tags.model_validate_json('["z"]').root == ["z"]

# Generics.
T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int


assert Page[int](items=["1", 2], total=2).items == [1, 2]
assert err_types(Page[int], items=["x"], total=1) == ["int_parsing"]
assert Page(items=["1"], total=1).items == ["1"]  # unparametrized: T is Any
assert Page[int].__name__ == "Page[int]"

# Private attributes: never validated, never dumped.
class WithPrivate(BaseModel):
    a: int
    _cache: dict = PrivateAttr(default_factory=dict)


w = WithPrivate(a=1)
w._cache["k"] = 1
assert w.model_dump() == {"a": 1} and w._cache == {"k": 1}

# model_construct: skip validation entirely (you are on your own).
m = Out.model_construct(id="not an int", name=5)
assert m.id == "not an int"
assert m.model_fields_set == {"id", "name"}

# Equality compares type and field values.
assert Address(city="a") == Address(city="a") and Address(city="a") != {"city": "a"}


# Fields with mutable defaults, and field ordering in the dump follow the class body.
class Order(BaseModel):
    b: int = 0
    a: int = 0


assert list(Order(a=1).model_dump()) == ["b", "a"]

# model_fields on the class, and model_config is inherited and merged.
class Strictish(Base):
    model_config = ConfigDict(extra="forbid")


assert Strictish.model_config["extra"] == "forbid"
assert err_types(Strictish, id=1, z=1) == ["extra_forbidden"]
print("ok")
