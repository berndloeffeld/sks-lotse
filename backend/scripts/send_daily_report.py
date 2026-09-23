"""Mails the daily KPI report to every address in ADMIN_EMAILS.

Run by the `sks-lotse-daily-report` Render Cron Job (render.yaml) from the
backend directory: `python -m scripts.send_daily_report`. Exits non-zero when
there is nobody to send to or any send fails, so the failed run shows up in
Render; one failing recipient doesn't stop the others. After a fully
successful run it pings BETTERSTACK_HEARTBEAT_URL (if set), so a run that
failed or never started at all raises a Better Stack alert. Aggregates only,
see docs/adr/0032-daily-kpi-report.md.
"""

import logging
import sys
import urllib.request
from datetime import UTC, datetime

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.log_config import configure_logging
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
    failed = 0
    for position, recipient in enumerate(recipients, start=1):
        try:
            send_kpi_report_email(recipient, subject, body)
        except Exception:
            failed += 1
            # Position only, not the address (personal data).
            logger.exception("Daily report send failed for recipient %s of %s", position, len(recipients))
    if failed:
        return 1
    _ping_heartbeat()
    return 0


def _ping_heartbeat() -> None:
    url = settings.betterstack_heartbeat_url
    if not url:
        return
    try:
        # Not a user-supplied URL: an operator-set env var pointing at Better Stack.
        with urllib.request.urlopen(url, timeout=10):  # noqa: S310 - fixed https URL from config
            pass
    except OSError:
        # The report itself went out; a missed ping only makes Better Stack alert, which is the
        # safe side. Still worth a line, so that alert can be told apart from a real failure.
        logger.exception("Heartbeat ping failed")


if __name__ == "__main__":
    configure_logging(settings.log_level, settings.log_format)
    sys.exit(main())
