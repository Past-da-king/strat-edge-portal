"""The executive and admin report over every status feedback log.

Everyone else gets 403 from the server itself; hiding the tab in the UI is a
courtesy, not the lock.
"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..models.database import get_db, User, PROGRESS_STATUSES
from ..schemas.status_feedback import StatusFeedbackReport
from ..services.status_feedback_report import (
    ReportFilters, build_report, report_csv, report_pdf,
)
from .deps import get_current_active_admin

router = APIRouter()


def report_filters(
    project_id: Optional[int] = None,
    person_id: Optional[int] = None,
    progress_status: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> ReportFilters:
    if progress_status and progress_status not in PROGRESS_STATUSES:
        raise HTTPException(status_code=422, detail=f"progress_status must be one of {PROGRESS_STATUSES}")
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from is after date_to")
    return ReportFilters(project_id, person_id, progress_status or None, date_from, date_to)


@router.get("/report/", response_model=StatusFeedbackReport)
def status_feedback_report(
    current_user: User = Depends(get_current_active_admin),
    filters: ReportFilters = Depends(report_filters),
    db: Session = Depends(get_db),
):
    """Every status feedback log by everyone on every project, for executives and admins only.

    Filter by project, person (author or activity owner), status and a date range
    the log's week overlaps. The summary counts per person and per project, names
    the latest update, and lists who owns open work but has gone quiet.
    """
    return build_report(db, filters)


@router.get("/report/export/")
def export_status_feedback_report(
    current_user: User = Depends(get_current_active_admin),
    fmt: str = Query("csv", alias="format", pattern="^(csv|pdf)$"),
    filters: ReportFilters = Depends(report_filters),
    db: Session = Depends(get_db),
):
    """The status feedback report as a CSV or PDF download, same filters, same executive-and-admin lock."""
    report = build_report(db, filters)
    stamp = report["generated_at"].strftime("%Y-%m-%d")

    if fmt == "pdf":
        body = report_pdf(report, current_user.full_name or current_user.username)
        media = "application/pdf"
    else:
        body = report_csv(report).encode("utf-8")
        media = "text/csv; charset=utf-8"
    filename = f"status-feedback-report_{stamp}.{fmt}"

    from ..core.audit import log_event
    log_event(
        db,
        event_type="DOWNLOAD",
        category="REPORT",
        description=f"Status feedback report ({fmt.upper()}, {report['summary']['total']} logs)",
        user_id=current_user.user_id,
        metadata={k: (str(v) if v is not None else None) for k, v in report["filters"].items()},
    )

    return Response(
        content=body,
        media_type=media,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )
