"""Lesson 11 (part 1): what changed from Pydantic V1, and what still works through the shims."""

import warnings
from typing import Optional

from pydantic import BaseModel, ValidationError, root_validator, validator
from pydantic.errors import PydanticUserError


def caught(fn):
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        result = fn()
    return result, [(type(x.message).__name__, str(x.message)) for x in w]


class User(BaseModel):
    name: str
    age: int | None = None


u = User(name="a")

# V1 method names still work, with a deprecation warning that names the replacement.
for call, replacement in [
    (lambda: u.dict(), "model_dump"),
    (lambda: u.json(), "model_dump_json"),
    (lambda: u.copy(), "model_copy"),
    (lambda: User.parse_obj({"name": "a"}), "model_validate"),
    (lambda: User.parse_raw('{"name": "a"}'), "model_validate_json"),
    (lambda: User.schema(), "model_json_schema"),
    (lambda: User.construct(name="a"), "model_construct"),
]:
    _, warns = caught(call)
    assert warns and warns[0][0] == "PydanticDeprecatedSince20" and replacement in warns[0][1], warns
print(warns[0][1].split(". Deprecated")[0])

# The V1 @validator still works (deprecated), @root_validator needs skip_on_failure or pre.
def make_v1():
    class Legacy(BaseModel):
        n: int

        @validator("n")
        def pos(cls, v):
            if v < 0:
                raise ValueError("negative")
            return v

    return Legacy


Legacy, warns = caught(make_v1)
assert warns and warns[0][0] == "PydanticDeprecatedSince20"
assert Legacy(n=1).n == 1
try:
    Legacy(n=-1)
except ValidationError as e:
    assert e.errors()[0]["type"] == "value_error"
try:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")

        class NoSkip(BaseModel):
            a: int

            @root_validator
            def r(cls, values):
                return values
except PydanticUserError as e:
    print("root_validator:", e.code)
    assert e.code == "root-validator-pre-skip"

# Optional[int] used to mean "optional with default None". Now it only means "may be None" and is required.
class V2Style(BaseModel):
    a: Optional[int]


try:
    V2Style()
except ValidationError as e:
    assert e.errors()[0]["type"] == "missing"

# A V1 Config class still works for keys that kept their name, and only warns about renamed keys, which do nothing.
def make_config():
    class Old(BaseModel):
        class Config:
            orm_mode = True
            allow_population_by_field_name = True
            extra = "forbid"

        a: int

    return Old


Old, warns = caught(make_config)
text = " ".join(w[1] for w in warns)
assert "orm_mode' has been renamed to 'from_attributes'" in text
assert Old.model_config["extra"] == "forbid"  # same name in V2: honoured
try:
    Old(a=1, z=2)
except ValidationError as e:
    assert e.errors()[0]["type"] == "extra_forbidden"


class Row:
    a = 1


try:
    Old.model_validate(Row())  # orm_mode was not translated, so from_attributes is off
except ValidationError as e:
    assert e.errors()[0]["type"] == "model_type"
    print("orm_mode ignored:", e.errors()[0]["type"])

# regex became pattern, __root__ became RootModel, and some names were removed outright.
def make_regex():
    from pydantic import Field

    class R(BaseModel):
        s: str = Field("a", regex="^a$")

    return R


try:
    caught(make_regex)
except PydanticUserError as e:
    assert e.code == "removed-kwargs"
    print("regex:", e.code)

try:
    from pydantic import BaseSettings  # noqa: F401
except Exception as e:
    assert type(e).__name__ == "PydanticImportError" and "pydantic-settings" in str(e)
    print("BaseSettings:", str(e).splitlines()[0])

# The whole V1 package still ships inside V2, importable for gradual migration.
from pydantic.v1 import BaseModel as V1Model  # noqa: E402


class Old1(V1Model):
    n: int


assert Old1(n="3").n == 3 and Old1(n=1).dict() == {"n": 1}  # no warnings, it is real V1 code
class V1Str(V1Model):
    s: str


class V1Opt(V1Model):
    a: Optional[int]


assert V1Opt().a is None  # V1: Optional[int] means "not required, default None"
assert V1Str(s=123).s == "123"  # V1 turned a number into a string, V2 does not
assert not issubclass(Old1, BaseModel) and Old1.__module__ == __name__

# Behaviours that changed silently (these have no warning, so test for them).
class Num(BaseModel):
    f: float
    s: str


assert Num(f=1, s="x").f == 1.0 and type(Num(f=1, s="x").f) is float
try:
    Num(f=1, s=123)  # V1 turned 123 into "123". V2 refuses.
except ValidationError as e:
    assert e.errors()[0]["type"] == "string_type"

# Validation of a model instance: an instance of the declared class is kept as is.
class Inner(BaseModel):
    x: int


class Outer(BaseModel):
    inner: Inner


i = Inner(x=1)
assert Outer(inner=i).inner is i
print("ok")
