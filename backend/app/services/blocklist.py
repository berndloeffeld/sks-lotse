"""Manual email/domain blocklist for spam and abuse (see docs/adr/0045).

Separate from the disposable-email check (app/core/otp.py) and from ALLOWED_EMAILS/ADMIN_EMAILS
(app/core/config.py): those are either a third-party list or an operator-set env var, while this
one is edited at runtime from /admin, including a one-click "block this user" from the account
list, so it lives in its own table (app/models/blocked_email.py) rather than a settings string.

`is_email_blocked` is the hot-path check (called from every /auth/otp/request) and is cached
in-process the same way the catalog is (ADR-0009). Every caller that commits a write here also
calls invalidate_cache() right after, so an admin's change takes effect on the very next request
instead of waiting out the TTL (see app/api/v1/admin.py).
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import cache
from app.core.email_address import canonicalize_email
from app.models.blocked_email import BlockedEmail
from app.models.user import User

KIND_EMAIL = "email"
KIND_DOMAIN = "domain"

_CACHE_KEY = "blocklist"
_CACHE_TTL_SECONDS = 300


def _domain_of(email: str) -> str:
    return email.rpartition("@")[2].lower()


def _normalize(kind: str, value: str) -> str:
    if kind == KIND_EMAIL:
        return canonicalize_email(value)
    stripped = value.strip().lower()
    if "@" in stripped:
        raise ValueError("A domain must not contain '@'")
    return stripped


def add_block(db: Session, kind: str, value: str, reason: str | None, created_by: str) -> BlockedEmail:
    """Add an entry, or return the existing one for the same (kind, value) — a duplicate click on
    "block this user" is a no-op, not an error."""
    normalized = _normalize(kind, value)
    existing = db.execute(
        select(BlockedEmail).where(BlockedEmail.kind == kind, BlockedEmail.value == normalized)
    ).scalar_one_or_none()
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


def remove_block_by_value(db: Session, kind: str, value: str) -> None:
    normalized = _normalize(kind, value)
    entry = db.execute(
        select(BlockedEmail).where(BlockedEmail.kind == kind, BlockedEmail.value == normalized)
    ).scalar_one_or_none()
    if entry is not None:
        db.delete(entry)


def list_blocks(db: Session) -> list[BlockedEmail]:
    return list(db.execute(select(BlockedEmail).order_by(BlockedEmail.created_at.desc())).scalars())


def invalidate_cache(app) -> None:
    """Call after committing a write here, so the next is_email_blocked call sees it immediately
    instead of waiting out the TTL."""
    cache.invalidate(app, _CACHE_KEY)


def blocked_sets(db: Session) -> tuple[set[str], set[str]]:
    """Plain, uncached read — for the admin list/detail `is_blocked` display field, which loads
    rarely enough that it doesn't need the hot-path cache below."""
    rows = db.execute(select(BlockedEmail.kind, BlockedEmail.value)).all()
    emails = {value for kind, value in rows if kind == KIND_EMAIL}
    domains = {value for kind, value in rows if kind == KIND_DOMAIN}
    return emails, domains


def is_blocked(email: str, emails: set[str], domains: set[str]) -> bool:
    return email in emails or _domain_of(email) in domains


def is_email_blocked(app, db: Session, email: str) -> bool:
    emails, domains = cache.get_or_set(app, _CACHE_KEY, _CACHE_TTL_SECONDS, lambda: blocked_sets(db))
    return is_blocked(email, emails, domains)


def block_user(db: Session, user: User, admin_email: str) -> BlockedEmail:
    """Caller commits and then calls invalidate_cache() — same two-step as every other write here."""
    entry = add_block(db, KIND_EMAIL, user.email, reason=None, created_by=admin_email)
    # Invalidates the account's current session immediately, on top of blocking future logins
    # (see app/api/v1/auth.py::logout, same token_version mechanism).
    user.token_version += 1
    return entry


def unblock_user(db: Session, user: User) -> None:
    remove_block_by_value(db, KIND_EMAIL, user.email)
