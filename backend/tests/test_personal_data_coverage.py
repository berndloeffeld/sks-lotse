"""Account deletion and the DSGVO export have to cover all personal data — checked on the schema.

Both lists used to be kept by hand (services/user.py, schemas/admin.py), and an export gap was found
twice after the fact. These tests walk `Base.metadata`, so a new table or column fails here until it
is dealt with: added to the export and the deletion, or listed below with the reason it needs
neither. Same idea as test_mutation_scope.py.
"""

import importlib
import pkgutil
from datetime import UTC, datetime, timedelta

import pytest
from pydantic import BaseModel
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import Session

import app.models
from app.core.database import Base
from app.models import (
    ChartAttempt,
    ChartAttemptTask,
    ExamAttempt,
    ExamAttemptQuestion,
    FocusTopic,
    OtpCode,
    Purchase,
    Question,
    QuestionGradingLog,
    QuestionProgress,
    QuestionReport,
    Topic,
    User,
)
from app.schemas.admin import (
    AdminBlocklistEntryExport,
    AdminChartAttemptExport,
    AdminChartTaskExport,
    AdminExamAttemptExport,
    AdminExamQuestionExport,
    AdminFocusTopicExport,
    AdminPurchaseExport,
    AdminQuestionGradingExport,
    AdminQuestionProgressExport,
    AdminQuestionReportExport,
    AdminUserListItem,
    AdminUserRead,
)
from app.services.user import delete_user_and_progress
from tests.helpers import progress_state

for _module in pkgutil.iter_modules(app.models.__path__):
    importlib.import_module(f"app.models.{_module.name}")  # every model is registered on Base.metadata

# What the export has for the account's own rows: table -> the schema(s) that carry its columns.
# The user's own row is the "user" part of the export (AdminUserRead extends AdminUserListItem).
EXPORT_SCHEMAS: dict[str, tuple[type[BaseModel], ...]] = {
    "users": (AdminUserRead, AdminUserListItem),
    "question_progress": (AdminQuestionProgressExport,),
    "question_grading_log": (AdminQuestionGradingExport,),
    "focus_topics": (AdminFocusTopicExport,),
    "question_reports": (AdminQuestionReportExport,),
    "exam_attempts": (AdminExamAttemptExport,),
    "exam_attempt_questions": (AdminExamQuestionExport,),
    "chart_attempts": (AdminChartAttemptExport,),
    "chart_attempt_tasks": (AdminChartTaskExport,),
    "purchases": (AdminPurchaseExport,),
    # Not an account row: entries naming the account's address or its domain (ADR-0045).
    "blocked_emails": (AdminBlocklistEntryExport,),
}

# A column that the export carries under another field name.
RENAMED = {
    ("exam_attempts", "id"): "exam_id",
    ("chart_attempts", "id"): "attempt_id",
}

_ROW_ID = "internal row id, means nothing outside the database"
_OWNER = "the account the export is about"
_RESOLVED = "exported as the catalog subject and number it points to, readable without the database"
_PARENT = "the parent row this one is nested in"

# A column the export deliberately leaves out, with the reason.
EXCLUDED: dict[str, dict[str, str]] = {
    "users": {
        "token_version": "session counter that revokes tokens, not data about the person",
        "totp_secret_encrypted": "authentication secret (ADR-0047); totp_enabled_at is exported",
        "totp_last_counter": "replay guard of the authentication secret",
    },
    "question_progress": {"id": _ROW_ID, "user_id": _OWNER},
    "question_grading_log": {"id": _ROW_ID, "user_id": _OWNER},
    "focus_topics": {
        "id": _ROW_ID,
        "user_id": _OWNER,
        "topic_id": "exported as subject, topic_slug and name",
    },
    "question_reports": {"id": _ROW_ID, "user_id": _OWNER},
    "exam_attempts": {"user_id": _OWNER},
    "exam_attempt_questions": {
        "id": _ROW_ID,
        "attempt_id": _PARENT,
        "question_id": _RESOLVED,
    },
    "chart_attempts": {"user_id": _OWNER},
    "chart_attempt_tasks": {"id": _ROW_ID, "attempt_id": _PARENT},
    "purchases": {
        "id": _ROW_ID,
        "user_id": _OWNER,
        "admin_user_id": "the granting admin's identity, not the learner's data",
    },
    "blocked_emails": {"id": _ROW_ID, "created_by": "the admin's address, not the learner's data"},
}

# Tables that hold no personal data at all.
NOT_PERSONAL = {
    "questions": "the official catalog",
    "topics": "the official catalog's topics",
    "app_settings": "operator prices and packages",
    "lotse_check_log": "deliberately without a user: counts checks and tokens only",
}

# Personal data that account deletion removes but the export doesn't list.
NOT_EXPORTED = {
    "otp_codes": "login and email-change codes (hash, address) that live for minutes (ADR-0010)",
}

USER = "users"
EMAIL_KEYED = {"blocked_emails"}  # matched by address, survives the account (ADR-0045)
TABLES = set(Base.metadata.tables)


def _linked_to_the_account() -> set[str]:
    """Every table that references `users`, directly or through another table that does."""
    linked = {USER}
    grew = True
    while grew:
        grew = False
        for table in Base.metadata.tables.values():
            targets = {fk.column.table.name for fk in table.foreign_keys}
            if table.name not in linked and targets & linked:
                linked.add(table.name)
                grew = True
    return linked - {USER}


ACCOUNT_TABLES = set(EXPORT_SCHEMAS) - {USER} - EMAIL_KEYED


def test_every_table_is_classified_as_personal_data_or_not():
    classified = set(EXPORT_SCHEMAS) | set(NOT_PERSONAL) | set(NOT_EXPORTED)
    assert TABLES - classified == set(), (
        "new table: if it holds personal data, add it to the export (schemas/admin.py), to "
        "delete_user_and_progress and to EXPORT_SCHEMAS here; otherwise to NOT_PERSONAL with the reason"
    )
    assert classified - TABLES == set(), "a table listed here no longer exists"
    assert not (set(EXPORT_SCHEMAS) & set(NOT_PERSONAL) | set(NOT_PERSONAL) & set(NOT_EXPORTED))


def test_every_table_that_references_the_account_is_exported_and_deleted():
    unhandled = _linked_to_the_account() - ACCOUNT_TABLES - set(NOT_EXPORTED)
    assert unhandled == set(), "references users: add it to the export and to delete_user_and_progress"
    assert not _linked_to_the_account() & set(NOT_PERSONAL)


@pytest.mark.parametrize("table", sorted(EXPORT_SCHEMAS))
def test_every_column_is_exported_or_left_out_on_purpose(table):
    fields = set().union(*(schema.model_fields for schema in EXPORT_SCHEMAS[table]))
    columns = {c.name for c in Base.metadata.tables[table].columns}
    renamed = {c: f for (t, c), f in RENAMED.items() if t == table}
    excluded = EXCLUDED.get(table, {})

    uncovered = columns - fields - set(renamed) - set(excluded)
    assert uncovered == set(), f"{table}: add to the export schema, or to EXCLUDED with the reason"
    assert set(renamed) <= columns, f"{table}: RENAMED names a column that no longer exists"
    assert set(renamed.values()) <= fields, f"{table}: RENAMED names a field the export doesn't have"
    assert set(excluded) <= columns, f"{table}: EXCLUDED names a column that no longer exists"
    assert not set(excluded) & (fields | set(renamed)), f"{table}: EXCLUDED but exported after all"


# --- Deletion, behaviourally -------------------------------------------------------------------


def _paid(user_id: int, admin_user_id: int | None = None, cents: int | None = 499) -> Purchase:
    return Purchase(
        user_id=user_id,
        product="tokens_s" if cents else "admin_grant",
        tokens_granted=20,
        amount_eur_cents=cents,
        granted_by="stripe" if cents else "admin_manual",
        admin_user_id=admin_user_id,
    )


def _attempts(db: Session, user: User, question: Question) -> None:
    now = datetime.now(UTC)
    exam = ExamAttempt(
        user_id=user.id, exam_variant="motor", started_at=now, deadline_at=now + timedelta(minutes=90)
    )
    chart = ChartAttempt(user_id=user.id, exercise_number=1, started_at=now)
    db.add_all([exam, chart])
    db.flush()
    db.add_all(
        [
            ExamAttemptQuestion(
                attempt_id=exam.id,
                question_id=question.id,
                position=1,
                subject_group="navigation",
                answer_text="Meine Antwort",
            ),
            ChartAttemptTask(attempt_id=chart.id, task_number=1, answer_text="HWZ", answered_at=now),
        ]
    )


def _rows_for(db: Session, user: User, question: Question, topic: Topic) -> None:
    """One row of every table of ACCOUNT_TABLES (and the OTP codes) that belongs to `user`."""
    now = datetime.now(UTC)
    db.add_all(
        [
            QuestionProgress(user_id=user.id, question_id=question.id, **progress_state(1)),
            QuestionGradingLog(
                user_id=user.id, question_id=question.id, outcome="richtig", half_life_days=2.5
            ),
            QuestionReport(user_id=user.id, question_id=question.id, category="wrong_answer"),
            FocusTopic(user_id=user.id, topic_id=topic.id),
            _paid(user.id),
            _paid(user.id, cents=None),
            OtpCode(email=user.email, code_hash="x", purpose="login", expires_at=now),
            OtpCode(
                email="elsewhere@example.com",
                code_hash="y",
                purpose="email_change",
                expires_at=now,
                user_id=user.id,
            ),
        ]
    )
    _attempts(db, user, question)


ROW_TABLES = ACCOUNT_TABLES | set(NOT_EXPORTED)


@pytest.fixture(params=[True, False], ids=["foreign-keys-on", "foreign-keys-off"])
def db(request):
    # Both ways: with enforcement (as in Postgres) nothing may block the delete or dangle; without
    # it, delete_user_and_progress has to remove everything itself instead of leaning on CASCADE.
    engine = create_engine("sqlite:///:memory:")
    with engine.connect() as connection:
        connection.exec_driver_sql(f"PRAGMA foreign_keys={int(request.param)}")
        assert connection.execute(text("PRAGMA foreign_keys")).scalar_one() == int(request.param)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def test_deleting_the_account_leaves_no_personal_data_behind(db):
    leaver = User(email="leaver@example.com")
    stays = User(email="stays@example.com")
    question = Question(subject="navigation", number=1, question_text="Q?", answer_text="A")
    topic = Topic(subject="navigation", slug="t", name="T", display_order=0)
    db.add_all([leaver, stays, question, topic])
    db.flush()
    _rows_for(db, leaver, question, topic)
    # The leaver once granted the other account tokens; that reference mustn't block the delete.
    db.add(_paid(stays.id, admin_user_id=leaver.id, cents=None))
    db.commit()
    stays_id = stays.id

    delete_user_and_progress(db, leaver)
    db.expire_all()

    for table in sorted(ROW_TABLES - {"purchases"}):
        assert db.execute(select(func.count()).select_from(Base.metadata.tables[table])).scalar_one() == 0, (
            table
        )
    assert db.get(User, stays_id) is not None
    # Money stays for the bookkeeping, anonymized; free grants go; the granting admin is severed.
    kept = db.execute(select(Purchase)).scalars().all()
    assert sorted((p.user_id, p.amount_eur_cents, p.admin_user_id) for p in kept if p.user_id is None) == [
        (None, 499, None)
    ]
    assert [(p.user_id, p.admin_user_id) for p in kept if p.user_id is not None] == [(stays_id, None)]
    # What isn't personal stays.
    assert db.query(Question).count() == 1
    assert db.query(Topic).count() == 1


def test_the_deletion_test_fills_every_table_it_checks(db):
    leaver = User(email="leaver@example.com")
    question = Question(subject="navigation", number=1, question_text="Q?", answer_text="A")
    topic = Topic(subject="navigation", slug="t", name="T", display_order=0)
    db.add_all([leaver, question, topic])
    db.flush()
    _rows_for(db, leaver, question, topic)
    db.commit()

    empty = [t for t in sorted(ROW_TABLES) if not db.execute(select(Base.metadata.tables[t])).first()]
    assert empty == [], "add a row for the new table to _rows_for, or its deletion goes unchecked"
