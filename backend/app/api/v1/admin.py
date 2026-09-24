import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import pricing as pricing_core
from app.core.database import get_db
from app.core.jwt import require_admin
from app.models.question import Question
from app.models.question_report import QuestionReport
from app.models.user import User
from app.schemas.admin import (
    AdminBlockedEmailCreate,
    AdminBlockedEmailRead,
    AdminQuestionReportRead,
    AdminSettingsRead,
    AdminSettingsUpdate,
    AdminUserExport,
    AdminUserListItem,
    AdminUserListPage,
    AdminUserRead,
    AdminUserUpdate,
    TokenPackageSettings,
)
from app.schemas.kpis import KpiReport
from app.schemas.question import QuestionRead
from app.services import admin_users, blocklist, token_wallet
from app.services import catalog as catalog_service
from app.services import pricing as pricing_service
from app.services.kpis import compute_kpis
from app.services.user import delete_user_and_progress

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

_NOT_FOUND = HTTPException(status_code=status.HTTP_404_NOT_FOUND)

logger = logging.getLogger(__name__)


def _audit(admin: User, action: str, **details: object) -> None:
    # Who did what to whom, for the GDPR record (ADR-0019) — ids and settings only, never the
    # exported data or an address.
    rendered = " ".join(f"{key}={value}" for key, value in details.items())
    logger.info("admin action: admin=%s action=%s %s", admin.id, action, rendered)


def _get_user_or_404(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise _NOT_FOUND
    return user


@router.get("/users", response_model=AdminUserListPage)
def list_users(
    request: Request,
    q: str = Query(default="", max_length=254),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AdminUserListPage:
    """Accounts, newest first; `q` searches email and name. The term isn't logged (may be an address)."""
    users, total = admin_users.list_users(db, q, offset, limit)
    _audit(admin, "list_users", offset=offset, results=len(users))
    items = [
        AdminUserListItem.model_validate(user).model_copy(
            update={"is_blocked": blocklist.is_email_blocked(request.app, db, user.email)}
        )
        for user in users
    ]
    return AdminUserListPage(items=items, total=total)


@router.get("/users/{user_id}", response_model=AdminUserRead)
def get_user(user_id: int, request: Request, db: Session = Depends(get_db)) -> AdminUserRead:
    user = _get_user_or_404(db, user_id)
    return admin_users.admin_user_read(request.app, db, user)


@router.patch("/users/{user_id}", response_model=AdminUserRead)
def update_user(
    user_id: int,
    payload: AdminUserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AdminUserRead:
    """Remove ads or grant tokens (ADR-0043) — an off-platform payment the operator credits by
    hand until a payment provider exists."""
    user = _get_user_or_404(db, user_id)
    turning_ads_removed_on = payload.ads_removed is not None and payload.ads_removed and not user.ads_removed
    if payload.ads_removed is not None:
        user.ads_removed = payload.ads_removed
    # token_wallet.grant() below re-fetches this row with populate_existing=True (it must, to lock
    # it) — with the session's autoflush off, that would silently overwrite the plain attribute
    # assignments above with their still-unflushed-to-the-DB old values unless flushed first.
    db.flush()
    if turning_ads_removed_on:
        token_wallet.grant(
            db,
            user.id,
            product="ads_removed",
            tokens=None,
            amount_eur_cents=payload.grant_amount_eur_cents,
            granted_by="admin_manual",
            admin_user_id=admin.id,
        )
    if payload.grant_tokens is not None:
        token_wallet.grant(
            db,
            user.id,
            product="admin_grant",
            tokens=payload.grant_tokens,
            amount_eur_cents=payload.grant_amount_eur_cents,
            granted_by="admin_manual",
            admin_user_id=admin.id,
        )
    db.commit()
    _audit(
        admin,
        "update_user",
        target_user=user.id,
        **payload.model_dump(exclude_unset=True, exclude={"grant_amount_eur_cents"}),
    )
    return admin_users.admin_user_read(request.app, db, user)


def _package_settings(db: Session, product: str) -> TokenPackageSettings:
    package = pricing_core.token_package(db, product)
    return TokenPackageSettings(tokens=package.tokens, price_cents=package.price_cents)


def _settings_read(db: Session) -> AdminSettingsRead:
    return AdminSettingsRead(
        price_ads_removed_cents=pricing_core.ads_removed_price_cents(db),
        signup_bonus_tokens=pricing_core.signup_bonus_tokens(db),
        tokens_s=_package_settings(db, "tokens_s"),
        tokens_m=_package_settings(db, "tokens_m"),
        tokens_l=_package_settings(db, "tokens_l"),
        tokens_xl=_package_settings(db, "tokens_xl"),
    )


@router.get("/settings", response_model=AdminSettingsRead)
def get_settings(db: Session = Depends(get_db)) -> AdminSettingsRead:
    return _settings_read(db)


@router.put("/settings", response_model=AdminSettingsRead)
def update_settings(
    payload: AdminSettingsUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> AdminSettingsRead:
    """Set the signup bonus and every price (ADR-0043) at once."""
    pricing_service.set_prices(
        db,
        price_ads_removed_cents=payload.price_ads_removed_cents,
        signup_bonus_tokens=payload.signup_bonus_tokens,
        packages={
            product: pricing_core.TokenPackage(product, package.tokens, package.price_cents)
            for product, package in (
                ("tokens_s", payload.tokens_s),
                ("tokens_m", payload.tokens_m),
                ("tokens_l", payload.tokens_l),
                ("tokens_xl", payload.tokens_xl),
            )
        },
    )
    _audit(
        admin,
        "update_settings",
        price_ads_removed_cents=payload.price_ads_removed_cents,
        signup_bonus_tokens=payload.signup_bonus_tokens,
        tokens_s=(payload.tokens_s.tokens, payload.tokens_s.price_cents),
        tokens_m=(payload.tokens_m.tokens, payload.tokens_m.price_cents),
        tokens_l=(payload.tokens_l.tokens, payload.tokens_l.price_cents),
        tokens_xl=(payload.tokens_xl.tokens, payload.tokens_xl.price_cents),
    )
    return _settings_read(db)


@router.get("/kpis", response_model=KpiReport)
def get_kpis(db: Session = Depends(get_db)):
    return compute_kpis(db, datetime.now(UTC))


@router.get("/questions", response_model=list[QuestionRead])
def search_questions(
    request: Request,
    q: str = Query(default="", max_length=200),
    subject: str | None = Query(default=None, max_length=64),
    db: Session = Depends(get_db),
) -> list[QuestionRead]:
    """Look up question and official answer texts across all subjects, from the cached catalog."""
    return catalog_service.search_catalog(catalog_service.catalog(request, db), q, subject)


@router.get("/question-reports", response_model=list[AdminQuestionReportRead])
def list_question_reports(db: Session = Depends(get_db)) -> list[AdminQuestionReportRead]:
    """All "Frage melden" notes, newest first (ADR-0030)."""
    rows = db.execute(
        select(QuestionReport, Question.subject, Question.number, User.email)
        .join(Question, Question.id == QuestionReport.question_id)
        .join(User, User.id == QuestionReport.user_id)
        .order_by(QuestionReport.created_at.desc(), QuestionReport.id.desc())
    ).all()
    return [
        AdminQuestionReportRead(
            question_id=report.question_id,
            subject=subject,
            question_number=number,
            category=report.category,
            comment=report.comment,
            created_at=report.created_at,
            user_id=report.user_id,
            user_email=email,
        )
        for report, subject, number, email in rows
    ]


@router.get("/users/{user_id}/export", response_model=AdminUserExport)
def export_user(
    user_id: int, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> AdminUserExport:
    user = _get_user_or_404(db, user_id)
    _audit(admin, "export_user", target_user=user.id)
    return admin_users.build_user_export(request.app, db, user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> None:
    user = _get_user_or_404(db, user_id)
    delete_user_and_progress(db, user)
    _audit(admin, "delete_user", target_user=user_id)


@router.post("/users/{user_id}/block", response_model=AdminUserRead)
def block_user(
    user_id: int, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> AdminUserRead:
    """Add the account's own address to the blocklist and end its current session immediately
    (ADR-0045) — a domain-wide block, by contrast, only stops future logins."""
    user = _get_user_or_404(db, user_id)
    blocklist.block_user(db, user, admin.email)
    blocklist.commit(db, request.app)
    _audit(admin, "block_user", target_user=user_id)
    return admin_users.admin_user_read(request.app, db, user)


@router.delete("/users/{user_id}/block", response_model=AdminUserRead)
def unblock_user(
    user_id: int, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> AdminUserRead:
    user = _get_user_or_404(db, user_id)
    blocklist.unblock_user(db, user)
    blocklist.commit(db, request.app)
    _audit(admin, "unblock_user", target_user=user_id)
    return admin_users.admin_user_read(request.app, db, user)


@router.get("/blocklist", response_model=list[AdminBlockedEmailRead])
def list_blocklist(db: Session = Depends(get_db)) -> list[AdminBlockedEmailRead]:
    """Every manually blocked address/domain (ADR-0045), newest first."""
    return [AdminBlockedEmailRead.model_validate(entry) for entry in blocklist.list_blocks(db)]


@router.post("/blocklist", response_model=AdminBlockedEmailRead, status_code=status.HTTP_201_CREATED)
def create_blocklist_entry(
    payload: AdminBlockedEmailCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AdminBlockedEmailRead:
    try:
        entry = blocklist.add_block(db, payload.kind, payload.value, payload.reason, admin.email)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    blocklist.commit(db, request.app)
    # Never the address itself (see the module docstring on _audit) — it stays retrievable via GET.
    _audit(admin, "create_block", block_id=entry.id, kind=entry.kind)
    return AdminBlockedEmailRead.model_validate(entry)


@router.delete("/blocklist/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_blocklist_entry(
    block_id: int, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> None:
    if not blocklist.remove_block(db, block_id):
        raise _NOT_FOUND
    blocklist.commit(db, request.app)
    _audit(admin, "delete_block", block_id=block_id)
