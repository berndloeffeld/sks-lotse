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


def test_remove_block_by_value_is_a_noop_when_absent(db_session):
    blocklist.remove_block_by_value(db_session, "email", "nobody@example.com")
    assert blocklist.list_blocks(db_session) == []


def test_is_blocked_matches_exact_email_or_domain(db_session):
    emails = {"spam@example.com"}
    domains = {"spammy.example"}
    assert blocklist.is_blocked("spam@example.com", emails, domains) is True
    assert blocklist.is_blocked("someone@spammy.example", emails, domains) is True
    assert blocklist.is_blocked("clean@example.com", emails, domains) is False


def test_blocked_sets_separates_kinds(db_session):
    blocklist.add_block(db_session, "email", "spam@example.com", None, "admin@example.com")
    blocklist.add_block(db_session, "domain", "spammy.example", None, "admin@example.com")
    db_session.commit()
    emails, domains = blocklist.blocked_sets(db_session)
    assert emails == {"spam@example.com"}
    assert domains == {"spammy.example"}


def test_is_email_blocked_uses_the_cache_until_invalidated(db_session):
    assert blocklist.is_email_blocked(app, db_session, "spam@example.com") is False
    blocklist.add_block(db_session, "email", "spam@example.com", None, "admin@example.com")
    db_session.commit()
    # Still cached from the call above — a fresh admin write doesn't take effect until invalidated.
    assert blocklist.is_email_blocked(app, db_session, "spam@example.com") is False
    blocklist.invalidate_cache(app)
    assert blocklist.is_email_blocked(app, db_session, "spam@example.com") is True


def test_block_user_bumps_token_version_and_blocks_the_address(db_session):
    user = User(email="target@example.com")
    db_session.add(user)
    db_session.commit()
    original_version = user.token_version

    blocklist.block_user(db_session, user, "admin@example.com")
    db_session.commit()

    assert user.token_version == original_version + 1
    emails, _ = blocklist.blocked_sets(db_session)
    assert "target@example.com" in emails


def test_unblock_user_removes_the_email_block_without_touching_token_version(db_session):
    user = User(email="target@example.com")
    db_session.add(user)
    db_session.commit()
    blocklist.block_user(db_session, user, "admin@example.com")
    db_session.commit()
    version_after_block = user.token_version

    blocklist.unblock_user(db_session, user)
    db_session.commit()

    assert user.token_version == version_after_block
    emails, _ = blocklist.blocked_sets(db_session)
    assert "target@example.com" not in emails
