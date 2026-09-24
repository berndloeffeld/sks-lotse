import pytest

from app.main import app
from app.models.user import User
from app.services import blocklist


def test_add_block_canonicalizes_email(db_session):
    entry = blocklist.add_block(db_session, "email", "Anna.Meyer+x@googlemail.com", None, "admin@example.com")
    assert entry.kind == "email"
    assert entry.value == "annameyer@gmail.com"


def test_add_block_lowercases_and_strips_domain(db_session):
    entry = blocklist.add_block(db_session, "domain", "  Spammy.EXAMPLE.com  ", None, "admin@example.com")
    assert entry.value == "spammy.example.com"


def test_add_block_rejects_an_at_sign_in_a_domain(db_session):
    with pytest.raises(ValueError, match="@"):
        blocklist.add_block(db_session, "domain", "someone@spammy.example.com", None, "admin@example.com")


def test_add_block_is_idempotent(db_session):
    first = blocklist.add_block(db_session, "email", "spam@example.com", "first reason", "admin@example.com")
    second = blocklist.add_block(
        db_session, "email", "SPAM@example.com", "second reason", "admin@example.com"
    )
    assert first.id == second.id
    assert second.reason == "first reason"


def test_remove_block_returns_false_for_unknown_id(db_session):
    assert blocklist.remove_block(db_session, 999999) is False


def test_remove_block_removes_an_existing_entry(db_session):
    entry = blocklist.add_block(db_session, "email", "spam@example.com", None, "admin@example.com")
    db_session.commit()
    assert blocklist.remove_block(db_session, entry.id) is True
    db_session.commit()
    assert blocklist.list_blocks(db_session) == []


def test_is_email_blocked_matches_exact_email_or_domain(db_session):
    blocklist.add_block(db_session, "email", "spam@example.com", None, "admin@example.com")
    blocklist.add_block(db_session, "domain", "spammy.example", None, "admin@example.com")
    db_session.commit()
    assert blocklist.is_email_blocked(app, db_session, "spam@example.com") is True
    assert blocklist.is_email_blocked(app, db_session, "someone@spammy.example") is True
    assert blocklist.is_email_blocked(app, db_session, "clean@example.com") is False
    # A domain entry doesn't block an address that merely ends in it, nor an email entry its domain.
    assert blocklist.is_email_blocked(app, db_session, "someone@notspammy.example") is False
    assert blocklist.is_email_blocked(app, db_session, "other@example.com") is False


def test_is_email_blocked_uses_the_cache_until_invalidated(db_session):
    assert blocklist.is_email_blocked(app, db_session, "spam@example.com") is False
    blocklist.add_block(db_session, "email", "spam@example.com", None, "admin@example.com")
    db_session.commit()
    # Still cached from the call above — a write committed behind the cache's back isn't seen...
    assert blocklist.is_email_blocked(app, db_session, "spam@example.com") is False
    blocklist.commit(db_session, app)
    # ...one committed through commit() is, on the very next check.
    assert blocklist.is_email_blocked(app, db_session, "spam@example.com") is True


def test_block_user_bumps_token_version_and_blocks_the_address(db_session):
    user = User(email="target@example.com")
    db_session.add(user)
    db_session.commit()
    original_version = user.token_version

    blocklist.block_user(db_session, user, "admin@example.com")
    blocklist.commit(db_session, app)

    assert user.token_version == original_version + 1
    assert blocklist.is_email_blocked(app, db_session, "target@example.com") is True


def test_unblock_user_removes_the_email_block_without_touching_token_version(db_session):
    user = User(email="target@example.com")
    db_session.add(user)
    db_session.commit()
    blocklist.block_user(db_session, user, "admin@example.com")
    blocklist.commit(db_session, app)
    version_after_block = user.token_version

    blocklist.unblock_user(db_session, user)
    blocklist.commit(db_session, app)

    assert user.token_version == version_after_block
    assert blocklist.is_email_blocked(app, db_session, "target@example.com") is False


def test_unblock_user_is_a_noop_when_not_blocked(db_session):
    user = User(email="target@example.com")
    db_session.add(user)
    db_session.commit()
    blocklist.unblock_user(db_session, user)
    assert blocklist.list_blocks(db_session) == []
