"""Lesson 12: capstone. An order intake boundary built from the pieces of lessons 1 to 11.

Raw JSON comes in. The boundary either returns a clean Order or a list of problems a caller can show,
and the shape of the data is exported as JSON Schema for whoever sends it.
"""

import json
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Annotated, Literal, Union

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    HttpUrl,
    SecretStr,
    TypeAdapter,
    ValidationError,
    computed_field,
    field_serializer,
    field_validator,
    model_validator,
)
from pydantic_core import PydanticCustomError

Sku = Annotated[str, Field(pattern=r"^[A-Z]{2,4}-\d{1,5}$")]
Money = Annotated[Decimal, Field(ge=0, max_digits=10, decimal_places=2)]


def not_in_past(v: datetime) -> datetime:
    if v < datetime(2020, 1, 1, tzinfo=timezone.utc):
        raise PydanticCustomError("date_too_old", "date {value} is before 2020", {"value": v.date().isoformat()})
    return v


class Channel(str, Enum):
    WEB = "web"
    STORE = "store"


class Line(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    sku: Sku
    qty: int = Field(gt=0, le=1000)
    unit_price: Money

    @computed_field
    @property
    def subtotal(self) -> Decimal:
        return self.unit_price * self.qty


class Card(BaseModel):
    method: Literal["card"]
    number: SecretStr

    @field_validator("number")
    @classmethod
    def sixteen_digits(cls, v: SecretStr) -> SecretStr:
        digits = v.get_secret_value()
        if not (digits.isdigit() and len(digits) == 16):
            raise PydanticCustomError("card_number", "card number must be 16 digits")  # never echo the number
        return v


class Transfer(BaseModel):
    method: Literal["transfer"]
    reference: str = Field(min_length=6)


Payment = Annotated[Union[Card, Transfer], Field(discriminator="method")]


class Order(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    id: int = Field(gt=0)
    email: EmailStr
    placed_at: Annotated[datetime, AfterValidator(not_in_past)]
    channel: Channel = Channel.WEB
    lines: list[Line] = Field(min_length=1)
    payment: Payment
    callback: HttpUrl | None = None

    @field_validator("lines")
    @classmethod
    def unique_skus(cls, v: list[Line]) -> list[Line]:
        skus = [x.sku for x in v]
        if len(skus) != len(set(skus)):
            raise ValueError("a sku appears on more than one line")
        return v

    @model_validator(mode="after")
    def store_needs_transfer_or_card(self):
        if self.channel is Channel.STORE and self.callback is not None:
            raise ValueError("store orders cannot have a callback")
        return self

    @computed_field
    @property
    def total(self) -> Decimal:
        return sum((x.subtotal for x in self.lines), Decimal(0))

    @field_serializer("placed_at")
    def day(self, v: datetime) -> str:
        return v.isoformat()


GOOD = {
    "id": "1001",
    "email": " Ann@Example.com ",
    "placed_at": "2026-03-01T09:30:00+07:00",
    "lines": [
        {"sku": "AB-12", "qty": 2, "unit_price": "19.90"},
        {"sku": "CD-7", "qty": "1", "unit_price": 5},
    ],
    "payment": {"method": "card", "number": "4111111111111111"},
}

order = Order.model_validate(GOOD)
assert order.id == 1001 and order.email == "Ann@example.com"
assert order.channel is Channel.WEB and order.callback is None
assert order.total == Decimal("44.80")
assert type(order.payment) is Card
assert "4111" not in repr(order) and "4111" not in order.model_dump_json()
out = json.loads(order.model_dump_json())
assert out["total"] == "44.80" and out["lines"][0]["subtotal"] == "39.80"


# A problem list a caller can show: field path, stable code, human message. Nothing from the input is echoed.
def problems(raw: str) -> list[dict]:
    try:
        Order.model_validate_json(raw)
    except ValidationError as e:
        return [
            {"field": ".".join(str(p) for p in x["loc"]), "code": x["type"], "message": x["msg"]}
            for x in e.errors(include_url=False, include_context=False, include_input=False)
        ]
    return []


bad = dict(GOOD)
bad.update(
    id=0,
    email="nope",
    placed_at="2019-05-01T00:00:00Z",
    lines=[
        {"sku": "ab-12", "qty": 0, "unit_price": "1.999", "color": "red"},
        {"sku": "CD-7", "qty": 1, "unit_price": 5},
    ],
    payment={"method": "cash"},
    surprise=1,
)
found = problems(json.dumps(bad))
for p in found:
    print(p)
# Unknown keys are reported first, then the declared fields in the order of the class body.
assert [(p["field"], p["code"]) for p in found] == [
    ("surprise", "extra_forbidden"),
    ("id", "greater_than"),
    ("email", "value_error"),
    ("placed_at", "date_too_old"),
    ("lines.0.color", "extra_forbidden"),
    ("lines.0.sku", "string_pattern_mismatch"),
    ("lines.0.qty", "greater_than"),
    ("lines.0.unit_price", "decimal_max_places"),
    ("payment", "union_tag_invalid"),
]

# Rules that span fields only run once every field is valid.
dup = dict(GOOD, lines=[GOOD["lines"][0], GOOD["lines"][0]])
assert [p["code"] for p in problems(json.dumps(dup))] == ["value_error"]
store = dict(GOOD, channel="store", callback="https://example.com/hook")
assert problems(json.dumps(store))[0]["message"] == "Value error, store orders cannot have a callback"
assert problems(json.dumps(dict(GOOD, lines=[])))[0]["code"] == "too_short"
assert problems("{not json")[0]["code"] == "json_invalid"

# The contract for the sender: JSON Schema, with the discriminator spelled out.
schema = Order.model_json_schema()
assert schema["required"] == ["id", "email", "placed_at", "lines", "payment"]
assert schema["properties"]["payment"]["discriminator"]["propertyName"] == "method"
assert schema["additionalProperties"] is False
assert set(schema["$defs"]) == {"Card", "Channel", "Line", "Transfer"}

# One adapter for a batch, built once.
Batch = TypeAdapter(list[Order])
two = Batch.validate_json(json.dumps([GOOD, dict(GOOD, id=1002)]))
assert [o.id for o in two] == [1001, 1002]
try:
    Batch.validate_json(json.dumps([GOOD, dict(GOOD, id=-1)]))
except ValidationError as e:
    assert e.errors()[0]["loc"] == (1, "id")
print("ok")
