# Pydantic subject

Twelve lessons in Thai and English (`lessons/pydantic/`, `lessons-en/pydantic/`), each with a quiz, built around runnable exercises. Every message, error type and number
that a lesson prints comes from a real run with **Pydantic 2.13.0** and **pydantic-core 2.46.0** on Python 3.14 (the
environment `uv sync` creates; `requires-python` is 3.12 or newer). The version is pinned to match the source in the
knowledge graph (`graphs/pydantic-current/`, v2.13.0). `code/verify.py` runs every exercise and fails if a version differs
or an assertion breaks.

| # | Lesson (slug) | Phase | Exercise | Shows |
|---|---|---|---|---|
| 1 | `first-model` | A | `01_first_model.py` | type hints do not check, lax coercion table, `ValidationError`, three entry points, defaults of a model |
| 2 | `fields` | A | `02_fields.py` | required vs nullable, defaults, constraints, `Annotated`, three kinds of alias, Rust regex limits |
| 3 | `types` | B | `03_types.py` | lax table, strict (three ways, Python vs JSON), dates, `Decimal`, URL, email, `SecretStr` |
| 4 | `unions` | B | `04_unions.py` | smart mode, `left_to_right`, model unions, discriminated union, callable discriminator |
| 5 | `validators` | B | `05_validators.py` | before/after/wrap/plain, `ValidationInfo`, stacking order, `model_validator`, which exceptions are wrapped |
| 6 | `errors` | B | `06_errors.py` | anatomy, `loc`, `errors()`/`json()`/`str()`, `PydanticCustomError`, hiding input |
| 7 | `serialization` | C | `07_serialization.py` | python vs json mode, include/exclude, serializers, `computed_field`, subclass trap, `model_copy` |
| 8 | `models-config` | C | `08_models_config.py` | `ConfigDict`, nesting and `revalidate_instances`, `RootModel`, generics, private attrs, `model_construct` |
| 9 | `adapters` | C | `09_adapters.py` | `TypeAdapter`, `TypedDict`, pydantic dataclass, `validate_call`, JSON Schema |
| 10 | `under-the-hood` | D | `10_under_the_hood.py` | metaclass, core schema dict, `SchemaValidator`, forward refs, `defer_build`, cost of building |
| 11 | `migration` | D | `11_migration.py` | V1 shims and warnings, removed names, silent changes, `pydantic.v1` |
| 12 | `capstone` | D | `12_capstone.py` | order intake boundary that uses lessons 1 to 11 |

## Run

```
cd subjects/pydantic/code
uv sync
uv run python exercises/01_first_model.py    # each exercise prints "ok" on its last line
uv run python verify.py                      # all of them, plus the version check (add --show for the output)
```

## Sources

No book was used. Claims are tagged **ran** (an exercise asserts it), **source** (read from the summaries in the knowledge
graph of the v2.13.0 source, not from the code line by line) or **author** (advice or framing). Each lesson ends with a
table that gives the tag per claim.

## Not covered (possible next work)

`pydantic-settings`, `pydantic-extra-types`, the plugin system, the mypy plugin, `create_model`, the experimental
pipeline API, performance measurements against other libraries, labs, and a look at the pages in a browser (they were built but never
opened).
