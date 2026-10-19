from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, func
from sqlalchemy.orm import Session
from datetime import date, timedelta
from typing import List, Optional

from ..models.database import get_db, TenderBrief as TenderBriefModel, User, TENDER_STATUSES
from ..schemas.tender import TenderBrief, TenderIngest, TenderIngestResult, TenderStatusUpdate
from .deps import get_current_user, get_current_active_admin

router = APIRouter()

# What a re-post may change: everything the watcher sends except the id (which
# identifies the row), the status and created_at. The status is left out on
# purpose: a person marks a brief shortlisted or no-bid from the Portal, and the
# next morning's scan must not wipe that back to "new".
WRITABLE = [
    "title", "reference", "source", "source_url", "slack_url", "buyer", "category",
    "published", "closing", "days_to_close", "amount", "summary",
    "requirements", "documents", "relevance_score", "relevance_reason",
    "created_at",
]


def _days_between(closing: Optional[date]) -> Optional[int]:
    if not closing:
        return None
    return (closing - date.today()).days


@router.get("/", response_model=List[TenderBrief])
def list_tenders(
    status: Optional[str] = None,
    max_days_to_close: Optional[int] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Every brief, newest first.

    Filters: status (new, shortlisted, bid, no-bid), max_days_to_close (only
    tenders still open that close within that many days) and q (a word in the
    title, the reference or the buyer).

    "Days to close" is measured from the closing date we hold, not from the
    number the watcher sent, so a brief filed last week cannot claim it still
    has ten days left when it closes tomorrow.
    """
    query = db.query(TenderBriefModel)

    if status:
        if status not in TENDER_STATUSES:
            raise HTTPException(status_code=422,
                                detail=f"status must be one of {TENDER_STATUSES}")
        query = query.filter(TenderBriefModel.status == status)

    if max_days_to_close is not None:
        if max_days_to_close < 0:
            raise HTTPException(status_code=422, detail="max_days_to_close cannot be negative")
        cutoff = date.today() + timedelta(days=max_days_to_close)
        query = query.filter(
            or_(
                # Closing date known: still open, and closing on or before the cutoff.
                (TenderBriefModel.closing.isnot(None))
                & (TenderBriefModel.closing >= date.today())
                & (TenderBriefModel.closing <= cutoff),
                # No closing date on the brief: fall back to the watcher's number.
                (TenderBriefModel.closing.is_(None))
                & (TenderBriefModel.days_to_close.isnot(None))
                & (TenderBriefModel.days_to_close >= 0)
                & (TenderBriefModel.days_to_close <= max_days_to_close),
            )
        )

    if q:
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                TenderBriefModel.title.ilike(term),
                TenderBriefModel.reference.ilike(term),
                TenderBriefModel.buyer.ilike(term),
            )
        )

    return query.order_by(
        TenderBriefModel.created_at.desc(),
        func.coalesce(TenderBriefModel.closing, date.max).asc(),
        TenderBriefModel.id.asc(),
    ).all()


@router.post("/ingest/", response_model=TenderIngestResult)
def ingest_briefs(
    payload: TenderIngest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin),
):
    """File a batch of briefs from the tender watcher, upserting on id.

    Posting the same brief twice updates it, so a watcher that reruns or retries
    cannot fill the page with duplicates.
    """
    created = 0
    updated = 0
    seen: List[str] = []

    for brief in payload.briefs:
        data = brief.model_dump()
        brief_id = data.pop("id")

        # Never trust the sender's number when a closing date is known: the date
        # is the fact. A brief with no closing date keeps whatever count the
        # watcher sent, so a portal that hides the date is still usable.
        if data.get("closing"):
            data["days_to_close"] = _days_between(data.get("closing"))

        row = db.query(TenderBriefModel).filter(TenderBriefModel.id == brief_id).first()
        if row is None:
            fields = {k: data.get(k) for k in WRITABLE if k != "created_at"}
            fields["status"] = data.get("status") or "new"
            if data.get("created_at"):
                fields["created_at"] = data["created_at"]
            row = TenderBriefModel(id=brief_id, **fields)
            db.add(row)
            created += 1
        else:
            for field in WRITABLE:
                value = data.get(field)
                # A re-post that omits created_at must not blank the date the
                # brief was first filed: the page sorts on it.
                if field == "created_at" and value is None:
                    continue
                setattr(row, field, value)
            updated += 1
        seen.append(brief_id)

    db.commit()

    from ..core.audit import log_event
    log_event(
        db,
        event_type="INGEST",
        category="TENDER",
        description=f"Filed {len(seen)} tender brief(s): {created} new, {updated} updated",
        user_id=current_user.user_id,
        metadata={"created": created, "updated": updated, "ids": seen},
    )

    return TenderIngestResult(received=len(seen), created=created, updated=updated, ids=seen)


@router.patch("/{tender_id}/status/", response_model=TenderBrief)
def set_tender_status(
    tender_id: str,
    payload: TenderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Move one brief along: new, shortlisted, bid or no-bid.

    This is the only field a person owns; everything else on a brief belongs to
    the watcher, and a re-post keeps whatever status was set here.
    """
    row = db.query(TenderBriefModel).filter(TenderBriefModel.id == tender_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Tender brief not found")

    before = row.status
    row.status = payload.status
    db.commit()
    db.refresh(row)

    from ..core.audit import log_event
    log_event(
        db,
        event_type="UPDATE",
        category="TENDER",
        description=f"Tender '{row.title[:80]}' moved from {before} to {row.status}",
        user_id=current_user.user_id,
        metadata={"id": row.id, "from": before, "to": row.status},
    )

    return row


@router.get("/{tender_id}/", response_model=TenderBrief)
def get_tender(
    tender_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """One brief in full, including its summary, requirements and documents."""
    row = db.query(TenderBriefModel).filter(TenderBriefModel.id == tender_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Tender brief not found")
    return row
