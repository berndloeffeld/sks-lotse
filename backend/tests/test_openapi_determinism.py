"""The committed Postman collection must regenerate byte for byte (the `postman-collection` CI job).

openapi-to-postmanv2 makes up a random example for a schema with `pattern` (e.g. a `^\\d{6}$`
code) or `enum` (e.g. a `Literal[...]` field) on every run, so the collection flaps and CI fails
after the push — it happened for the OTP code, exam_variant and the admin TOTP code. This catches
it in the local test run instead.
"""

from app.main import app

_RANDOM_EXAMPLE_KEYWORDS = ("pattern", "enum")


def _offending_paths(node: object, path: str = "") -> list[str]:
    if isinstance(node, dict):
        found = [f"{path}.{key}" for key in _RANDOM_EXAMPLE_KEYWORDS if key in node]
        for key, value in node.items():
            found += _offending_paths(value, f"{path}.{key}")
        return found
    if isinstance(node, list):
        return [hit for index, item in enumerate(node) for hit in _offending_paths(item, f"{path}[{index}]")]
    return []


def test_openapi_schema_has_nothing_the_collection_generator_randomizes():
    offending = _offending_paths(app.openapi())
    assert not offending, (
        "openapi-to-postmanv2 generates a random example for these on every run, so the committed "
        "collection can't stay in sync: "
        + ", ".join(offending)
        + ". Check the constraint in an AfterValidator on a plain str instead of pattern=/Literal "
        "(see DigitsCode, TotpCode and ExamVariantField in app/schemas/auth.py)."
    )


def test_the_guard_finds_pattern_and_enum_anywhere():
    schema = {"a": {"pattern": "x"}, "b": [{"c": {"enum": ["y"]}}], "d": {"pattern_like": 1}}
    assert _offending_paths(schema) == [".a.pattern", ".b[0].c.enum"]
