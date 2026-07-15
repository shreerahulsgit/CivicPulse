"""
app/scheduler.py — Background Job Scheduler

Uses APScheduler to run periodic background tasks.
Currently registered jobs:
  - escalation_check: runs every 30 minutes, auto-escalates overdue complaints.

Start/stop is managed by main.py lifespan.
"""

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def _run_escalation_job() -> None:
    """Wrapper called by APScheduler — creates its own DB session."""
    try:
        from app.database.session import SessionLocal
        from app.services.escalation_service import run_escalation_check

        db = SessionLocal()
        try:
            result = run_escalation_check(db)
            if result["level1_escalated"] or result["level2_escalated"]:
                logger.info(
                    "[Scheduler] Escalation job: checked=%d L1=%d L2=%d",
                    result["checked"], result["level1_escalated"], result["level2_escalated"],
                )
        finally:
            db.close()
    except Exception as exc:
        logger.error("[Scheduler] Escalation job failed: %s", exc, exc_info=True)


def start_scheduler(interval_minutes: int = 30) -> None:
    """Start the background scheduler. Called once at app startup."""
    global _scheduler
    if _scheduler and _scheduler.running:
        logger.warning("Scheduler already running — skipping start")
        return

    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(
        _run_escalation_job,
        trigger=IntervalTrigger(minutes=interval_minutes),
        id="escalation_check",
        name="Auto-Escalation SLA Check",
        replace_existing=True,
        max_instances=1,       # prevent overlapping runs
    )
    _scheduler.start()
    logger.info(
        "[Scheduler] Started. Escalation check every %d min.", interval_minutes
    )
    # Run once immediately on startup to catch any already-overdue complaints
    _run_escalation_job()


def stop_scheduler() -> None:
    """Stop the scheduler gracefully. Called at app shutdown."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("[Scheduler] Stopped.")
