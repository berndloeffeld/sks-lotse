"""Manual email/domain blocklist for spam and abuse (see docs/adr/0045).

Separate from the disposable-email check (app/core/otp.py) and from ALLOWED_EMAILS/ADMIN_EMAILS
(app/core/config.py): those are either a third-party list or an operator-set env var, while this
one is edited at runtime from /admin, including a one-click "block this user" from the account
list, so it lives in its own table (app/models/blocked_email.py) rather than a settings string.

`is_email_blocked` is the one check, for the OTP hot path and the admin display field alike. It
reads the whole table through an in-process cache the same way the catalog is (ADR-0009); every
write here is committed via commit(), which also drops that cache, so an admin's change takes
effect on the very next request instead of waiting out the TTL.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import cache
from app.core.email_address import canonicalize_email, domain_of
from app.models.blocked_email import BlockedEmail
from app.models.user import User

KIND_EMAIL = "email"
KIND_DOMAIN = "domain"

_CACHE_KEY = "blocklist"
_CACHE_TTL_SECONDS = 300


def _normalize(kind: str, value: str) -> str:
    if kind == KIND_EMAIL:
        return canonicalize_email(value)
    stripped = value.strip().lower()
    if "@" in stripped:
        raise ValueError("A domain must not contain '@'")
    return stripped


def _find(db: Session, kind: str, normalized: str) -> BlockedEmail | None:
    return db.execute(
        select(BlockedEmail).where(BlockedEmail.kind == kind, BlockedEmail.value == normalized)
    ).scalar_one_or_none()


def add_block(db: Session, kind: str, value: str, reason: str | None, created_by: str) -> BlockedEmail:
    """Add an entry, or return the existing one for the same (kind, value) — a duplicate click on
    "block this user" is a no-op, not an error."""
    normalized = _normalize(kind, value)
    existing = _find(db, kind, normalized)
    if existing is not None:
        return existing
    entry = BlockedEmail(kind=kind, value=normalized, reason=reason, created_by=created_by)
    db.add(entry)
    db.flush()
    return entry


def remove_block(db: Session, block_id: int) -> bool:
    entry = db.get(BlockedEmail, block_id)
    if entry is None:
        return False
    db.delete(entry)
    return True


def list_blocks(db: Session) -> list[BlockedEmail]:
    return list(db.execute(select(BlockedEmail).order_by(BlockedEmail.created_at.desc())).scalars())


def commit(db: Session, app) -> None:
    """Commit a write made here and drop the cache, so the next check sees it immediately."""
    db.commit()
    cache.invalidate(app, _CACHE_KEY)


def _load(db: Session) -> tuple[frozenset[str], frozenset[str]]:
    rows = db.execute(select(BlockedEmail.kind, BlockedEmail.value)).all()
    emails = frozenset(value for kind, value in rows if kind == KIND_EMAIL)
    domains = frozenset(value for kind, value in rows if kind == KIND_DOMAIN)
    return emails, domains


def is_email_blocked(app, db: Session, email: str) -> bool:
    emails, domains = cache.get_or_set(app, _CACHE_KEY, _CACHE_TTL_SECONDS, lambda: _load(db))
    return email in emails or domain_of(email) in domains


def block_user(db: Session, user: User, admin_email: str) -> BlockedEmail:
    """Caller commits via commit(), like every other write here."""
    entry = add_block(db, KIND_EMAIL, user.email, reason=None, created_by=admin_email)
    # Invalidates the account's current session immediately, on top of blocking future logins
    # (see app/api/v1/auth.py::logout, same token_version mechanism).
    user.token_version += 1
    return entry


def unblock_user(db: Session, user: User) -> None:
    entry = _find(db, KIND_EMAIL, canonicalize_email(user.email))
    if entry is not None:
        db.delete(entry)
