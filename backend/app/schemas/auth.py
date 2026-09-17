from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field

# EmailStr only lowercases the domain, not the local part. Lowercase the
# whole address once, here, so every per-email check (cooldown, hourly cap,
# allowlist) and the users.email lookup see one canonical form — otherwise
# "A@x.de" and "a@x.de" would get separate OTP quotas and separate accounts.
NormalizedEmail = Annotated[EmailStr, AfterValidator(str.lower)]


def _require_digits(value: str) -> str:
    if not value.isascii() or not value.isdigit():
        raise ValueError("code must contain only digits")
    return value


# Digits-only is checked in a validator rather than via `pattern=`: a pattern
# lands in the OpenAPI schema, and openapi-to-postmanv2 then generates a random
# matching example on every run, breaking the committed-collection check in CI.
DigitsCode = Annotated[str, Field(min_length=4, max_length=10), AfterValidator(_require_digits)]


class OtpRequestCreate(BaseModel):
    email: NormalizedEmail


class OtpRequestAccepted(BaseModel):
    detail: str = "A login code has been sent if delivery was possible."


class OtpVerifyRequest(BaseModel):
    email: NormalizedEmail
    # Bounded shape, so arbitrary-length input never reaches hashing/the DB.
    code: DigitsCode


class TokenRead(BaseModel):
    access_token: str
    token_type: str = "bearer"


class OtpDevPeekRead(BaseModel):
    code: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    created_at: datetime
