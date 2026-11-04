"""Lesson 7: serialization. model_dump, JSON mode, include/exclude, custom serializers, computed fields."""

import json
import warnings
from datetime import date, datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Annotated, Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    SerializeAsAny,
    SerializationInfo,
    computed_field,
    field_serializer,
    model_serializer,
)


class Color(Enum):
    RED = "red"


class Line(BaseModel):
    sku: str
    qty: int
    price: Decimal


class Order(BaseModel):
    id: int
    placed: date
    color: Color
    lines: list[Line]
    note: str | None = None
    tags: set[str] = set()


o = Order(id=1, placed="2026-03-01", color="red", lines=[{"sku": "A", "qty": 2, "price": "9.50"}], tags={"x"})

# python mode keeps rich types, json mode produces only JSON types.
py = o.model_dump()
assert py["placed"] == date(2026, 3, 1) and py["color"] is Color.RED and py["lines"][0]["price"] == Decimal("9.50")
assert isinstance(py["lines"][0], dict)  # nested models become dicts
js = o.model_dump(mode="json")
assert js["placed"] == "2026-03-01" and js["color"] == "red" and js["lines"][0]["price"] == "9.50" and js["tags"] == ["x"]
text = o.model_dump_json()
print(text)
assert json.loads(text) == js
assert o.model_dump_json(indent=2).startswith("{\n  ")

# Round trip.
assert Order.model_validate_json(text) == o
assert Order.model_validate(js) == o

# include / exclude, including nested keys.
assert set(o.model_dump(include={"id", "note"})) == {"id", "note"}
assert "lines" not in o.model_dump(exclude={"lines"})
assert o.model_dump(include={"lines": {0: {"sku"}}})["lines"] == [{"sku": "A"}]
assert o.model_dump(exclude={"lines": {"__all__": {"price"}}})["lines"] == [{"sku": "A", "qty": 2}]

# exclude_unset / exclude_defaults / exclude_none.
assert "note" in o.model_dump() and "note" not in o.model_dump(exclude_unset=True)
assert "note" not in o.model_dump(exclude_none=True)
d = Order(id=1, placed="2026-03-01", color="red", lines=[], note=None)
assert "note" in d.model_dump(exclude_unset=True)  # passed explicitly, even as None
assert "note" not in d.model_dump(exclude_defaults=True)  # equals the default

# Aliases.
class Aliased(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    user_id: int = Field(alias="userId")


a = Aliased(userId=1)
assert a.model_dump() == {"user_id": 1} and a.model_dump(by_alias=True) == {"userId": 1}
assert a.model_dump_json(by_alias=True) == '{"userId":1}'


# field_serializer: change how one field is written.
class Event(BaseModel):
    at: datetime
    price: Decimal

    @field_serializer("at")
    def fmt(self, v: datetime) -> str:
        return v.strftime("%d/%m/%Y")

    @field_serializer("price", when_used="json")
    def money(self, v: Decimal) -> float:
        return float(v)


e = Event(at=datetime(2026, 3, 1, 12, tzinfo=timezone.utc), price="1.5")
assert e.model_dump()["at"] == "01/03/2026" and e.model_dump()["price"] == Decimal("1.5")
assert e.model_dump_json() == '{"at":"01/03/2026","price":1.5}'

# Reusable serializer on a type.
Baht = Annotated[Decimal, PlainSerializer(lambda v: f"{v:.2f} THB", return_type=str)]


class Price(BaseModel):
    amount: Baht


assert Price(amount="3").model_dump() == {"amount": "3.00 THB"}


# computed_field: a property that is part of the output.
class Rect(BaseModel):
    w: int
    h: int

    @computed_field
    @property
    def area(self) -> int:
        return self.w * self.h


r = Rect(w=2, h=3)
assert r.model_dump() == {"w": 2, "h": 3, "area": 6}
assert "area" in Rect.model_json_schema(mode="serialization")["properties"]
assert "area" not in Rect.model_json_schema(mode="validation")["properties"]
assert Rect(w=1, h=1, area=99).area == 1  # input for area is ignored


# model_serializer: take over the whole output. info tells you the mode.
class Money(BaseModel):
    amount: int
    currency: str

    @model_serializer
    def ser(self, info: SerializationInfo) -> str | dict[str, Any]:
        return f"{self.amount} {self.currency}" if info.mode == "json" else {"a": self.amount}


assert Money(amount=5, currency="THB").model_dump_json() == '"5 THB"'
assert Money(amount=5, currency="THB").model_dump() == {"a": 5}


# Subclass instances are serialized with the declared type, not their own (the default).
class Animal(BaseModel):
    name: str


class Dog(Animal):
    tricks: int = 0


class Owner(BaseModel):
    pet: Animal


class Owner2(BaseModel):
    pet: SerializeAsAny[Animal]


assert Owner(pet=Dog(name="r", tricks=3)).model_dump() == {"pet": {"name": "r"}}
assert Owner2(pet=Dog(name="r", tricks=3)).model_dump() == {"pet": {"name": "r", "tricks": 3}}
assert Owner(pet=Dog(name="r", tricks=3)).model_dump(serialize_as_any=True) == {"pet": {"name": "r", "tricks": 3}}


# A value that does not match the field type produces a warning, not an error.
class N(BaseModel):
    n: int


m = N(n=1)
m.n = "not an int"  # no validate_assignment
with warnings.catch_warnings(record=True) as caught:
    warnings.simplefilter("always")
    out = m.model_dump()
assert out == {"n": "not an int"} and len(caught) == 1
print(str(caught[0].message))

# model_copy and model_dump as a way to change a model without mutating it.
c = o.model_copy(update={"id": 2})
assert c.id == 2 and o.id == 1 and c.lines is o.lines  # shallow
assert o.model_copy(deep=True).lines is not o.lines
assert o.model_copy(update={"id": "not checked"}).id == "not checked"  # update skips validation
print("ok")
