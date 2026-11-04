# Verified findings (Pydantic)

Tags: **ran** (asserted by an exercise in `code/exercises/` on Pydantic 2.13.0), **source** (taken from the summaries
in the knowledge graph `graphs/pydantic-current/`, v2.13.0; the code itself was not read line by line), **author**
(advice or framing, not checked). `code/verify.py` re-runs every exercise.

| Lesson | Claim | Tag |
|---|---|---|
| first-model | class and dataclass keep `'not a number'` in an `int` field | ran (01) |
| first-model | `"42"` becomes `42`; `3.5` gives `int_from_float`; `"abc"` gives `int_parsing`; `None` gives `int_type`; bool words | ran (01) |
| first-model | four errors reported at once; extra keys dropped; keyword only; no check on assignment; `model_fields_set` | ran (01) |
| first-model | V1 turned `123` into `"123"`, V2 gives `string_type` | ran (01, 11) |
| fields | required, nullable, defaults not validated, mutable defaults copied, `default_factory` (with `data`) | ran (02) |
| fields | constraint error types and `ctx`; `Annotated` reuse with `parts.1`; aliases; `exclude`, `repr`, `frozen_field` | ran (02) |
| fields | Rust regex rejects lookahead at class creation, `regex_engine="python-re"` accepts it | ran (02) |
| fields | `default_factory` with an argument exists since 2.10 | author |
| types | lax table, container copies, strict (three ways), JSON vs Python strict for `date`, `datetime` from an int, `Decimal`, `UUID`, `Enum`, `Literal`, URL, email, `SecretStr` | ran (03) |
| types | strict `tuple`: JSON array passes, Python list fails (`tuple_type`) | ran (10) |
| unions | smart mode exactness, `left_to_right`, model tie goes left, discriminated errors, `Tag` | ran (04) |
| unions | smart mode counts fields set to pick a model | source (`union.rs`) |
| unions | discriminated union is faster | author |
| validators | modes, `info.data`, stacking order, wrap, plain, `model_validator`, wrapped exceptions, context | ran (05) |
| validators | `assert` is removed under `python -O`; validators are inherited | author |
| errors | anatomy, `loc`, `json_invalid`, `errors()` options, `ctx["error"]` not JSON safe, custom errors, hiding input | ran (06) |
| serialization | python vs json, include/exclude, `exclude_*`, serializers, `computed_field`, subclass trap, warning text, `model_copy` | ran (07) |
| serialization | other values of `when_used`; discriminated union serializes by tag | author |
| models-config | `extra`, `frozen`, `validate_assignment`, string options, `from_attributes`, `revalidate_instances` reads the inner class, `RootModel`, generics, private attrs, `model_construct` | ran (08) |
| models-config | config merge between base and subclass | author (only the `extra` case is asserted) |
| adapters | `TypeAdapter`, `TypedDict`, `NamedTuple`, dataclass, `validate_call`, JSON Schema, validators invisible in schema | ran (09) |
| adapters | reuse ratio (77x printed, `assert` above 20x) | ran (09), number depends on the machine |
| under-the-hood | metaclass, core schema shape, `SchemaValidator` direct use, forward refs, `defer_build`, lazy import, `repr` of validator | ran (10) |
| under-the-hood | file names and roles in the Python and Rust halves, `Input` trait, `jiter`, `MockValSer` | source |
| under-the-hood | create 42 ms vs validate 0.30 ms | ran (10), numbers depend on the machine; `assert` above 20x |
| migration | deprecated method names and their warnings, `@validator`, `root_validator`, `regex`, `BaseSettings`, `Optional`, `Config` keys, `pydantic.v1` | ran (11) |
| migration | shim tables in `_migration.py`, 21 shim files, 26 legacy files | source |
| migration | V1 and V2 models cannot be mixed in one field; migration order; warnings as errors | author |
| capstone | whole boundary: good order, nine problems and their order, cross-field rules, JSON Schema, batch `loc` | ran (12) |
| capstone | `Field(pattern=...)` on `SecretStr` raised `TypeError` | author (seen while drafting, not kept in an exercise) |

## Not checked

- Other Pydantic versions. Messages and defaults may differ.
- Support of `pydantic.v1` on newer Python versions.
- The pages were built (`npm run build`, 325 pages with the English lessons, all internal lesson links and heading ids resolve in both languages) but not opened in
  a browser, and the quizzes were not clicked through.
