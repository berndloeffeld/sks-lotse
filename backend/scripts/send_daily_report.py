"""Mails the daily KPI report to every address in ADMIN_EMAILS.

Run by the `sks-lotse-daily-report` Render Cron Job (render.yaml) from the
backend directory: `python -m scripts.send_daily_report`. Exits non-zero when
there is nobody to send to or a send fails, so the failed run shows up in
Render. Aggregates only, see docs/adr/0032-daily-kpi-report.md.
"""

import logging
import sys
from datetime import UTC, datetime

from app.core.config import settings
from app.core.database import SessionLocal
from app.services.email import send_kpi_report_email
from app.services.kpis import compute_kpis, format_report

logger = logging.getLogger(__name__)


def main() -> int:
    recipients = sorted(settings.admin_emails_set)
    if not recipients:
        logger.error("ADMIN_EMAILS is empty - nobody to send the daily report to")
        return 1
    now = datetime.now(UTC)
    with SessionLocal() as db:
        report = compute_kpis(db, now)
    subject = f"SKS Lotse Tagesreport {now:%d.%m.%Y}"
    body = format_report(report)
    for recipient in recipients:
        send_kpi_report_email(recipient, subject, body)
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    sys.exit(main())
