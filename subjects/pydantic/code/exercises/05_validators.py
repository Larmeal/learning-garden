"""Lesson 5: custom validation. field_validator, model_validator, Annotated validators, order of execution."""

from typing import Annotated, Any

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    PlainValidator,
    ValidationError,
    ValidationInfo,
    WrapValidator,
    field_validator,
    model_validator,
    ValidatorFunctionWrapHandler,
)


def errs(model, data=None, **kw):
    try:
        model.model_validate(data if data is not None else kw)
    except ValidationError as e:
        return [(".".join(map(str, x["loc"])), x["type"], x["msg"]) for x in e.errors()]
    return []


# field_validator in the default (after) mode: gets the value after Pydantic's own checks.
class Signup(BaseModel):
    username: str
    password: str
    password2: str

    @field_validator("username")
    @classmethod
    def clean_username(cls, v: str) -> str:
        if not v.isalnum():
            raise ValueError("must be letters and digits only")
        return v.lower()  # the returned value replaces the input

    @field_validator("password2")
    @classmethod
    def same_password(cls, v: str, info: ValidationInfo) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("passwords do not match")
        return v


assert Signup(username="Ann99", password="x", password2="x").username == "ann99"
assert errs(Signup, username="a b", password="x", password2="y") == [
    ("username", "value_error", "Value error, must be letters and digits only"),
    ("password2", "value_error", "Value error, passwords do not match"),
]
# An after validator never sees a value that failed the type check, so it can trust the type.
assert errs(Signup, username=123, password="x", password2="x") == [
    ("username", "string_type", "Input should be a valid string"),
]


# If the field it reads failed, info.data does not hold it (this is why the guard above matters).
seen = {}


class Order(BaseModel):
    qty: int
    note: str

    @field_validator("note")
    @classmethod
    def look(cls, v, info: ValidationInfo):
        seen["keys"] = sorted(info.data)
        return v


errs(Order, qty="x", note="n")
assert seen["keys"] == []  # qty failed, so it is not in info.data
Order(qty=1, note="n")
assert seen["keys"] == ["qty"]


# before mode sees the raw input, so it can reshape it first.
class Tags(BaseModel):
    tags: list[str]

    @field_validator("tags", mode="before")
    @classmethod
    def split(cls, v: Any):
        return v.split(",") if isinstance(v, str) else v


assert Tags(tags="a,b").tags == ["a", "b"] and Tags(tags=["c"]).tags == ["c"]

# Annotated validators can be reused and they stack: the order is bottom to top for before, top to bottom for after.
log: list[str] = []


def mark(name):
    def f(v):
        log.append(name)
        return v

    return f


Stacked = Annotated[
    int,
    BeforeValidator(mark("before1")),
    BeforeValidator(mark("before2")),
    AfterValidator(mark("after1")),
    AfterValidator(mark("after2")),
]


class S(BaseModel):
    n: Stacked


S(n="1")
print(log)
assert log == ["before2", "before1", "after1", "after2"]

# WrapValidator: run code around the inner validation, and recover from its error.
def default_on_error(v: Any, handler: ValidatorFunctionWrapHandler):
    try:
        return handler(v)
    except ValidationError:
        return 0


class Lenient(BaseModel):
    n: Annotated[int, WrapValidator(default_on_error)]


assert Lenient(n="x").n == 0 and Lenient(n="7").n == 7

# PlainValidator replaces the built-in validation for the type entirely.
class Plain(BaseModel):
    n: Annotated[int, PlainValidator(lambda v: int(v) * 2)]


assert Plain(n="4").n == 8


# model_validator: after sees the built instance (check rules that span fields).
class Range(BaseModel):
    low: int
    high: int

    @model_validator(mode="after")
    def ordered(self):
        if self.low > self.high:
            raise ValueError("low must not be above high")
        return self


assert errs(Range, low=5, high=1) == [("", "value_error", "Value error, low must not be above high")]
# If a field failed, the after validator does not run at all.
assert [e[1] for e in errs(Range, low="x", high=1)] == ["int_parsing"]


# model_validator before: raw input, can be anything.
class Point(BaseModel):
    x: int
    y: int

    @model_validator(mode="before")
    @classmethod
    def from_tuple(cls, data: Any):
        if isinstance(data, (list, tuple)):
            return {"x": data[0], "y": data[1]}
        return data


assert Point.model_validate((1, 2)) == Point(x=1, y=2)

# Exceptions: ValueError and AssertionError become a ValidationError, TypeError does not.
class Raises(BaseModel):
    a: int

    @field_validator("a")
    @classmethod
    def check(cls, v):
        if v == 1:
            raise ValueError("one")
        if v == 2:
            assert v != 2, "two"
        if v == 3:
            raise TypeError("three")
        return v


assert errs(Raises, a=1)[0][1] == "value_error"
assert errs(Raises, a=2)[0][1] == "assertion_error"
try:
    Raises(a=3)
except TypeError as e:
    print("TypeError escapes:", e)
else:
    raise AssertionError

# Validators on each item of a list, and validators on several fields at once.
class Cart(BaseModel):
    skus: list[str]
    first: str = ""
    second: str = ""

    @field_validator("skus")
    @classmethod
    def unique(cls, v):
        if len(set(v)) != len(v):
            raise ValueError("duplicate sku")
        return v

    @field_validator("first", "second")
    @classmethod
    def upper(cls, v):
        return v.upper()


assert Cart(skus=["a"], first="x", second="y").second == "Y"
assert errs(Cart, skus=["a", "a"])[0][2] == "Value error, duplicate sku"

# Validators do not run on defaults unless asked, and not on assignment unless validate_assignment is on.
class D(BaseModel):
    code: str = "abc"

    @field_validator("code")
    @classmethod
    def up(cls, v):
        return v.upper()


assert D().code == "abc" and D(code="abc").code == "ABC"

# Validation context: pass data into validators from the call site.
class Ctx(BaseModel):
    price: float

    @field_validator("price")
    @classmethod
    def vat(cls, v, info: ValidationInfo):
        rate = (info.context or {}).get("vat", 0)
        return round(v * (1 + rate), 2)


assert Ctx.model_validate({"price": 100}).price == 100
assert Ctx.model_validate({"price": 100}, context={"vat": 0.07}).price == 107.0
print("ok")
