"""Weekly activity log.

The baseline schedule records what was PLANNED. This records what actually
happened, week by week, in the words of the person doing the work - while the
activity is still running rather than after it has quietly slipped.

The rule the whole module turns on: an activity is "due a log" in a week if the
week overlaps its planned start..finish window and it is not already Complete.
Everyone due one is expected to answer three things - what got done, what is in
the way, and what is next - even when the honest answer is "nothing happened".
"""

from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from ..models.database import get_db, Project, Task, User, WeeklyLog, PROGRESS_STATUSES
from ..schemas.weekly_log import (
    ActivityWeek, WeekBoard, WeeklyLog as WeeklyLogSchema, WeeklyLogWrite,
)
from .deps import get_current_user

router = APIRouter()

MANAGERS = {"admin", "pm", "executive"}


def monday_of(day: date) -> date:
    """Every week is named by its Monday, so 'this week' means one thing only."""
    return day - timedelta(days=day.weekday())


def resolve_week(week_start: Optional[date]) -> date:
    return monday_of(week_start or date.today())


@router.get("/statuses/")
def get_progress_statuses():
    """Single source of truth for the progress drop-down."""
    return {"statuses": PROGRESS_STATUSES}


def _live_in_week(query, week_start: date, week_end: date):
    """Activities whose planned window overlaps the week.

    An activity with no planned dates is always included: undated work is
    exactly the kind that goes unreported, so it gets asked about every week.
    """
    from sqlalchemy import or_, and_
    return query.filter(
        Task.status != "Complete",
        or_(
            and_(Task.planned_start == None, Task.planned_finish == None),  # noqa: E711
            and_(
                or_(Task.planned_start == None, Task.planned_start <= week_end),  # noqa: E711
                or_(Task.planned_finish == None, Task.planned_finish >= week_start),  # noqa: E711
            ),
        ),
    )


def _board(db: Session, tasks: List[Task], week_start: date) -> WeekBoard:
    week_end = week_start + timedelta(days=6)
    ids = [t.activity_id for t in tasks]
    logs = {}
    if ids:
        rows = (
            db.query(WeeklyLog)
            .options(joinedload(WeeklyLog.author))
            .filter(WeeklyLog.activity_id.in_(ids), WeeklyLog.week_start == week_start)
            .all()
        )
        logs = {r.activity_id: r for r in rows}

    items = []
    for t in tasks:
        items.append(
            ActivityWeek(
                activity_id=t.activity_id,
                activity_name=t.activity_name,
                project_id=t.project_id,
                project_name=t.project.project_name if t.project else "",
                project_number=t.project.project_number if t.project else None,
                status=t.status,
                planned_start=t.planned_start,
                planned_finish=t.planned_finish,
                responsible_user_id=t.responsible_user_id,
                responsible_name=t.responsible.full_name if t.responsible else None,
                expected_output=t.expected_output,
                kpi=t.kpi,
                log=WeeklyLogSchema.model_validate(logs[t.activity_id]) if t.activity_id in logs else None,
            )
        )
    items.sort(key=lambda a: (a.log is not None, a.project_name, a.planned_finish or date.max))
    return WeekBoard(
        week_start=week_start,
        week_end=week_end,
        due=len(items),
        logged=sum(1 for i in items if i.log),
        activities=items,
    )


@router.get("/my-week/", response_model=WeekBoard)
def my_week(
    week_start: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """What the signed-in person owes a write-up for this week."""
    ws = resolve_week(week_start)
    we = ws + timedelta(days=6)
    q = (
        db.query(Task)
        .join(Project, Task.project_id == Project.project_id)
        .options(joinedload(Task.project), joinedload(Task.responsible))
        .filter(Task.responsible_user_id == current_user.user_id, Project.archived_at == None)  # noqa: E711
    )
    return _board(db, _live_in_week(q, ws, we).all(), ws)


@router.get("/project/{project_id}/", response_model=WeekBoard)
def project_week(
    project_id: int,
    week_start: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Every activity live on one project this week, logged or not.

    This is the accountability view: the blanks are the point of it.
    """
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    ws = resolve_week(week_start)
    we = ws + timedelta(days=6)
    q = (
        db.query(Task)
        .options(joinedload(Task.project), joinedload(Task.responsible))
        .filter(Task.project_id == project_id)
    )
    return _board(db, _live_in_week(q, ws, we).all(), ws)


@router.get("/activity/{activity_id}/", response_model=List[WeeklyLogSchema])
def activity_history(
    activity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Every week ever logged against one activity, oldest first."""
    task = db.query(Task).filter(Task.activity_id == activity_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Activity not found")
    return (
        db.query(WeeklyLog)
        .options(joinedload(WeeklyLog.author))
        .filter(WeeklyLog.activity_id == activity_id)
        .order_by(WeeklyLog.week_start)
        .all()
    )


@router.post("/", response_model=WeeklyLogSchema, status_code=status.HTTP_201_CREATED)
def submit_weekly_log(
    payload: WeeklyLogWrite,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Write up one activity for one week.

    Submitting again for the same activity and week edits that week's entry
    rather than stacking a second one - the log is a record of the week, not a
    comment thread.
    """
    task = db.query(Task).filter(Task.activity_id == payload.activity_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Activity not found")

    is_owner = task.responsible_user_id == current_user.user_id
    if not is_owner and current_user.role not in MANAGERS:
        raise HTTPException(
            status_code=403,
            detail="Only the person responsible for this activity (or a manager) can log against it",
        )

    if not (payload.work_done or "").strip() and payload.progress_status != "Not Worked On":
        raise HTTPException(
            status_code=422,
            detail="Say what was done this week, or mark the week 'Not Worked On' and give the reason under blockers",
        )

    week = monday_of(payload.week_start)
    log = (
        db.query(WeeklyLog)
        .filter(WeeklyLog.activity_id == payload.activity_id, WeeklyLog.week_start == week)
        .first()
    )
    created = log is None
    if created:
        log = WeeklyLog(activity_id=payload.activity_id, project_id=task.project_id, week_start=week)

    log.work_done = payload.work_done
    log.blockers = payload.blockers
    log.next_steps = payload.next_steps
    log.progress_status = payload.progress_status
    log.percent_complete = payload.percent_complete
    log.logged_by = current_user.user_id

    # A first log on a not-yet-started activity means it has started. Anything
    # further (Complete, for instance) stays a deliberate act on the activity
    # itself - the log reports, it does not quietly close work.
    if task.status == "Not Started" and payload.progress_status != "Not Worked On":
        task.status = "Active"
        db.add(task)

    db.add(log)
    db.commit()
    db.refresh(log)

    from ..core.audit import log_event
    log_event(
        db,
        event_type="CREATE" if created else "UPDATE",
        category="WEEKLY_LOG",
        description=f"Week of {week}: {task.activity_name} - {payload.progress_status}",
        user_id=current_user.user_id,
        metadata={
            "activity_id": task.activity_id,
            "project_id": task.project_id,
            "week_start": str(week),
            "progress_status": payload.progress_status,
            "has_blockers": bool((payload.blockers or "").strip()),
        },
    )
    return log


@router.get("/compliance/")
def compliance(
    week_start: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Per-project coverage for a week: how many activities were due a write-up,
    how many were written up, and which of them are flagged blocked.

    Managers see the whole portfolio; everyone else sees their own activities.
    """
    ws = resolve_week(week_start)
    we = ws + timedelta(days=6)

    q = (
        db.query(Task)
        .join(Project, Task.project_id == Project.project_id)
        .options(joinedload(Task.project))
        .filter(Project.archived_at == None)  # noqa: E711
    )
    if current_user.role not in MANAGERS:
        q = q.filter(Task.responsible_user_id == current_user.user_id)
    tasks = _live_in_week(q, ws, we).all()

    ids = [t.activity_id for t in tasks]
    logs = {}
    if ids:
        logs = {
            r.activity_id: r
            for r in db.query(WeeklyLog)
            .filter(WeeklyLog.activity_id.in_(ids), WeeklyLog.week_start == ws)
            .all()
        }

    by_project = {}
    for t in tasks:
        p = by_project.setdefault(
            t.project_id,
            {
                "project_id": t.project_id,
                "project_name": t.project.project_name if t.project else "",
                "project_number": t.project.project_number if t.project else None,
                "due": 0, "logged": 0, "blocked": 0, "not_worked_on": 0, "missing": [],
            },
        )
        p["due"] += 1
        log = logs.get(t.activity_id)
        if log:
            p["logged"] += 1
            if log.progress_status == "Blocked":
                p["blocked"] += 1
            if log.progress_status == "Not Worked On":
                p["not_worked_on"] += 1
        else:
            p["missing"].append({"activity_id": t.activity_id, "activity_name": t.activity_name})

    projects = sorted(by_project.values(), key=lambda p: p["project_name"])
    return {
        "week_start": ws,
        "week_end": we,
        "due": sum(p["due"] for p in projects),
        "logged": sum(p["logged"] for p in projects),
        "blocked": sum(p["blocked"] for p in projects),
        "projects": projects,
    }
