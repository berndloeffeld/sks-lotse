from collections.abc import Sequence

from pydantic import AfterValidator


def one_of(field: str, allowed: Sequence[str]) -> AfterValidator:
    """Restrict a plain `str` field to `allowed`, e.g. `Annotated[str, one_of("kind", KINDS)]`.

    Used instead of a `Literal[...]`: a Literal renders as an OpenAPI `enum`, and
    openapi-to-postmanv2 picks a random member of it as the example on every generation —
    non-reproducible, which breaks the committed-collection CI check.
    """

    def check(value: str) -> str:
        if value not in allowed:
            raise ValueError(f"{field} must be one of: {', '.join(allowed)}")
        return value

    return AfterValidator(check)
