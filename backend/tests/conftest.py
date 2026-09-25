import time
from collections import defaultdict, deque

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.database import Base, get_db, get_session_factory
from app.core.jwt import create_access_token
from app.main import app
from app.models import User
from tests.helpers import FIXTURE_EMAIL


@pytest.fixture(autouse=True)
def _disable_real_emails(monkeypatch):
    # A developer's local backend/.env may carry a real RESEND_API_KEY for
    # manually testing email delivery. Force it empty for every test run so
    # a test that doesn't mock the send (e.g. test_security_headers.py, via
    # the OTP background task) can never fire a real email.
    monkeypatch.setattr(settings, "resend_api_key", "")


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    # RateLimitMiddleware's counters live on the shared `app.state` for the
    # whole test process — without this, requests across unrelated test
    # functions would accumulate toward the same limit.
    app.state.rate_limit_hits = defaultdict(deque)
    app.state.rate_limit_windows = {}


@pytest.fixture(autouse=True)
def _reset_cache():
    # Same reasoning as _reset_rate_limits: app.core.cache stores entries on
    # the shared `app.state`, so a cached catalog from one test's (in-memory,
    # per-test) database would otherwise leak into the next test.
    app.state.cache_entries = {}


@pytest.fixture(autouse=True)
def _reset_dev_otp_codes():
    # Same reasoning as _reset_rate_limits: the dev-only OTP peek store (see
    # dev_otp_codes in app/services/otp_codes.py) also lives on the shared
    # `app.state`.
    app.state.dev_otp_codes = {}


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    # StaticPool: every session from this factory shares the one in-memory
    # connection, so background work sees (and changes) the same data.
    app.dependency_overrides[get_session_factory] = lambda: session_factory
    yield session
    app.dependency_overrides.clear()
    session.close()


@pytest.fixture()
def client(db_session):
    return TestClient(app)


@pytest.fixture()
def auth_headers(db_session):
    user = User(email=FIXTURE_EMAIL)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    # With a fresh TOTP check (ADR-0047), so a test that makes the fixture user an admin
    # (helpers.make_admin) reaches the admin routes; it means nothing for a learner.
    # test_admin_mfa.py mints its own tokens for the sessions without one.
    token = create_access_token(user.id, user.token_version, mfa_at=int(time.time()))
    return {"Authorization": f"Bearer {token}"}
