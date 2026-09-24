from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, StringConstraints, computed_field

from app.core.config import settings
from app.core.email_address import canonicalize_email
from app.core.exam_variant import EXAM_VARIANTS
from app.schemas.common import one_of

# EmailStr only lowercases the domain, not the local part. Canonicalize the
# whole address once, here (see app/core/email_address.py), so every per-email
# check (cooldown, hourly cap, allowlist) and the users.email lookup see one
# form — otherwise "A@x.de" and "a@x.de", or "a.b+x@gmail.com" and
# "ab@gmail.com", would get separate OTP quotas and separate accounts.
NormalizedEmail = Annotated[EmailStr, AfterValidator(canonicalize_email)]


def _require_digits(value: str) -> str:
    if not value.isascii() or not value.isdigit():
        raise ValueError("code must contain only digits")
    return value


# Digits-only is checked in a validator rather than via `pattern=`: a pattern
# lands in the OpenAPI schema, and openapi-to-postmanv2 then generates a random
# matching example on every run, breaking the committed-collection check in CI.
DigitsCode = Annotated[str, Field(min_length=4, max_length=10), AfterValidator(_require_digits)]


ExamVariantField = Annotated[str, one_of("exam_variant", sorted(EXAM_VARIANTS))]

GENDERS = {"maennlich", "weiblich", "divers"}


def _blank_to_none(value: str) -> str | None:
    return value or None


# Matches the users.first_name/last_name column width. Postgres rejects a
# longer value with a DataError (a 500) — SQLite, which the test suite runs
# on, silently stores it — so it has to be caught here as a 422. Surrounding
# whitespace is stripped (before the length check) and a blank name is
# stored as NULL, the same "keine Angabe" as leaving it out — so "" or "  "
# never ends up in the DB or in getDisplayName on the frontend.
NameField = Annotated[
    str, StringConstraints(strip_whitespace=True, max_length=128), AfterValidator(_blank_to_none)
]


# Blank/"keine Angabe" is represented by the field being null, not a stored member of GENDERS.
GenderField = Annotated[str, one_of("gender", sorted(GENDERS))]


class OtpRequestCreate(BaseModel):
    email: NormalizedEmail


class OtpRequestAccepted(BaseModel):
    detail: str = "A login code has been sent if delivery was possible."


class OtpVerifyRequest(BaseModel):
    email: NormalizedEmail
    # Bounded shape, so arbitrary-length input never reaches hashing/the DB.
    code: DigitsCode


class EmailChangeRequestCreate(BaseModel):
    new_email: NormalizedEmail


class EmailChangeVerifyRequest(BaseModel):
    new_email: NormalizedEmail
    code: DigitsCode


class TokenRead(BaseModel):
    access_token: str
    token_type: str = "bearer"  # noqa: S105 - the OAuth token type, not a password


class OtpDevPeekRead(BaseModel):
    code: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    created_at: datetime
    exam_variant: str | None
    first_name: str | None
    last_name: str | None
    gender: str | None
    token_balance: int
    ads_removed: bool
    agb_accepted_version: str | None

    @computed_field  # type: ignore[prop-decorator]  # pydantic's documented pattern
    @property
    def is_admin(self) -> bool:
        return self.email in settings.admin_emails_set


class UserUpdate(BaseModel):
    # Partial update: a field left out of the request body is untouched; a
    # field sent as explicit null clears it (see update_current_user's
    # model_dump(exclude_unset=True) — that's what distinguishes "omitted"
    # from "sent as null" here).
    exam_variant: ExamVariantField | None = None
    first_name: NameField | None = None
    last_name: NameField | None = None
    gender: GenderField | None = None
