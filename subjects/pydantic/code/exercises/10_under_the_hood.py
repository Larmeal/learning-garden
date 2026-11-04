"""Lesson 10: what happens when a model class is created, and what runs when you validate."""

import subprocess
import sys

from pydantic import BaseModel, ConfigDict, Field
from pydantic_core import SchemaValidator, ValidationError
from pydantic_core import core_schema as cs


class Item(BaseModel):
    sku: str
    qty: int = Field(gt=0, default=1)


class Order(BaseModel):
    id: int
    items: list[Item]


# 1. A BaseModel subclass is created by a metaclass, and building the class builds the validator.
assert type(Order).__name__ == "ModelMetaclass"
assert Order.__pydantic_complete__ is True
assert type(Order.__pydantic_validator__).__name__ == "SchemaValidator"
assert type(Order.__pydantic_serializer__).__name__ == "SchemaSerializer"
assert type(Order.__pydantic_validator__).__module__ == "pydantic_core._pydantic_core"  # compiled Rust

# 2. The bridge between the two halves is a plain dict, the core schema.
schema = Order.__pydantic_core_schema__
assert schema["type"] == "model" and schema["cls"] is Order
assert schema["schema"]["type"] == "model-fields"
assert {k: v["schema"]["type"] for k, v in schema["schema"]["fields"].items()} == {"id": "int", "items": "list"}
inner = schema["schema"]["fields"]["items"]["schema"]["items_schema"]
assert inner["type"] == "model" and inner["cls"] is Item  # the nested model sits inside the outer schema
qty = Item.__pydantic_core_schema__["schema"]["fields"]["qty"]["schema"]
assert qty == {"type": "default", "schema": {"type": "int", "gt": 0}, "default": 1}
print("qty schema:", qty)

# 3. You can skip the Python half and hand a schema straight to the Rust half.
v = SchemaValidator(cs.list_schema(cs.int_schema(gt=0)))
assert v.validate_python(["1", 2]) == [1, 2]
try:
    v.validate_python([0])
except ValidationError as e:
    assert e.errors(include_url=False)[0]["type"] == "greater_than"
assert v.validate_json("[1, 2]") == [1, 2]
assert Order.__pydantic_validator__.validate_python({"id": "1", "items": []}).id == 1  # what Order(...) calls

# 4. The same schema serves validate_python and validate_json, but the input is read differently.
class Strict(BaseModel):
    model_config = ConfigDict(strict=True)
    pair: tuple[int, int]


assert Strict.model_validate_json('{"pair": [1, 2]}').pair == (1, 2)  # JSON has only arrays, so an array is a tuple
try:
    Strict.model_validate({"pair": [1, 2]})  # in Python a list is not a tuple, and strict says so
except ValidationError as e:
    assert e.errors()[0]["type"] == "tuple_type"
assert Strict.model_validate({"pair": (1, 2)}).pair == (1, 2)


# 5. Not every class can finish building at once: a forward reference leaves a placeholder.
class A(BaseModel):
    b: "B"


assert A.__pydantic_complete__ is False and type(A.__pydantic_validator__).__name__ == "MockValSer"
try:
    A(b=1)
except Exception as e:
    assert type(e).__name__ == "PydanticUserError" and "model_rebuild" in str(e)


class B(BaseModel):
    x: int


A.model_rebuild()
assert A.__pydantic_complete__ is True and A(b={"x": "1"}).b.x == 1


class C(BaseModel):
    d: "D"


class D(BaseModel):
    x: int


assert C.__pydantic_complete__ is False
C(d={"x": 1})  # the first use tries to rebuild by itself, and D exists now
assert C.__pydantic_complete__ is True


# 6. defer_build postpones the cost until the first use.
class Lazy(BaseModel):
    model_config = ConfigDict(defer_build=True)
    x: int


assert Lazy.__pydantic_complete__ is False
Lazy(x=1)
assert Lazy.__pydantic_complete__ is True

# 7. Model creation is where the schema work happens, validation is not.
import timeit

create = timeit.timeit(
    lambda: type("M", (BaseModel,), {"__annotations__": {"a": int, "b": str, "c": list[int]}}), number=200
)
ok = Order.__pydantic_validator__
validate = timeit.timeit(lambda: ok.validate_python({"id": 1, "items": [{"sku": "a"}]}), number=200)
print(f"create 200 classes {create * 1000:.0f} ms, validate 200 times {validate * 1000:.2f} ms")
assert create > 20 * validate

# 8. `import pydantic` is cheap because names load on first access.
code = (
    "import sys, pydantic\n"
    "before = 'pydantic.main' in sys.modules\n"
    "pydantic.BaseModel\n"
    "print(before, 'pydantic.main' in sys.modules)"
)
out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True).stdout.strip()
assert out == "False True", out

# 9. The Rust validator describes itself.
text = repr(Order.__pydantic_validator__)
assert text.startswith('SchemaValidator(title="Order"') and "ModelFieldsValidator" in text
print(text.splitlines()[0], "...", len(text.splitlines()), "lines")
print("ok")
