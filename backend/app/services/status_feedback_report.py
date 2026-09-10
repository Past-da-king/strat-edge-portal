"""The oversight report over status feedback: every log, by everyone, on every project.

Status feedback is written one activity and one week at a time, and the weekly
board only ever shows one week. Executives need the other axis - the whole
record, filterable, with the people who have stopped reporting called out -
and they need to carry it into a meeting as a CSV or a PDF.

This module only queries and shapes. Who may ask for it is the router's call.
"""

import csv
import io
from dataclasses import dataclass, asdict
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from ..models.database import Project, Task, User, StatusFeedback, PROGRESS_STATUSES

# Someone with open work and no write-up for this long has gone quiet. Two
# weeks, because one missed Friday is a busy week and two is a pattern.
QUIET_AFTER_DAYS = 14

ACTIVE_USER_STATUSES = ("approved", "active")


@dataclass
class ReportFilters:
    project_id: Optional[int] = None
    person_id: Optional[int] = None       # matches the author OR the activity's owner
    progress_status: Optional[str] = None
    date_from: Optional[date] = None      # any log whose week overlaps the range
    date_to: Optional[date] = None

    def is_empty(self) -> bool:
        return not any(asdict(self).values())


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Postgres and SQLite hand timestamps back with and without a zone; compare like with like."""
    if dt is None:
        return None
    if isinstance(dt, str):                       # SQLite, when an aggregate loses the column type
        dt = datetime.fromisoformat(dt)
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _days_since(dt: Optional[datetime], now: datetime) -> Optional[int]:
    return None if dt is None else max(0, (now.date() - dt.date()).days)


def _name(user: Optional[User]) -> Optional[str]:
    if user is None:
        return None
    return user.full_name or user.username


def build_report(db: Session, f: ReportFilters, now: Optional[datetime] = None) -> dict:
    now = now or _now()

    q = db.query(StatusFeedback).options(
        joinedload(StatusFeedback.author),
        joinedload(StatusFeedback.project),
        joinedload(StatusFeedback.activity).joinedload(Task.responsible),
    )
    if f.project_id is not None:
        q = q.filter(StatusFeedback.project_id == f.project_id)
    if f.person_id is not None:
        # "Everything about this person": what they wrote, and what anyone wrote
        # on their activities - a manager covering a week still belongs to them.
        owned = select(Task.activity_id).where(Task.responsible_user_id == f.person_id)
        q = q.filter(or_(StatusFeedback.logged_by == f.person_id, StatusFeedback.activity_id.in_(owned)))
    if f.progress_status:
        q = q.filter(StatusFeedback.progress_status == f.progress_status)
    # A log covers Monday..Sunday, so a range starting mid-week still catches that week.
    if f.date_from:
        q = q.filter(StatusFeedback.week_start >= f.date_from - timedelta(days=6))
    if f.date_to:
        q = q.filter(StatusFeedback.week_start <= f.date_to)

    # Newest week first, and inside a week the most recently touched write-up first.
    logs = q.order_by(
        StatusFeedback.week_start.desc(),
        func.coalesce(StatusFeedback.updated_at, StatusFeedback.created_at).desc(),
        StatusFeedback.log_id.desc(),
    ).all()

    entries = []
    for log in logs:
        act, proj = log.activity, log.project
        touched = _naive_utc(log.updated_at or log.created_at)
        entries.append({
            "log_id": log.log_id,
            "week_start": log.week_start,
            "week_end": log.week_start + timedelta(days=6),
            "project_id": log.project_id,
            "project_name": proj.project_name if proj else "",
            "project_number": proj.project_number if proj else None,
            "project_archived": bool(proj and proj.archived_at),
            "activity_id": log.activity_id,
            "activity_name": act.activity_name if act else "",
            "activity_status": act.status if act else None,
            "responsible_user_id": act.responsible_user_id if act else None,
            "responsible_name": (_name(act.responsible) or act.responsible_names) if act else None,
            "logged_by": log.logged_by,
            "author_name": _name(log.author) or "Unknown",
            "author_role": log.author.role if log.author else None,
            "progress_status": log.progress_status,
            "percent_complete": log.percent_complete or 0,
            "work_done": log.work_done,
            "blockers": log.blockers,
            "next_steps": log.next_steps,
            "updated_at": touched,
            "days_ago": _days_since(touched, now),
        })

    return {
        "generated_at": now,
        "filters": asdict(f),
        "quiet_after_days": QUIET_AFTER_DAYS,
        "summary": _summarise(db, f, entries, now),
        "entries": entries,
        "options": _options(db),
    }


def _later(a: Optional[datetime], b: Optional[datetime]) -> Optional[datetime]:
    if a is None:
        return b
    if b is None:
        return a
    return max(a, b)


def _summarise(db: Session, f: ReportFilters, entries: list, now: datetime) -> dict:
    by_status = {s: 0 for s in PROGRESS_STATUSES}
    people, projects = {}, {}
    latest = None

    for e in entries:
        by_status[e["progress_status"]] = by_status.get(e["progress_status"], 0) + 1
        blocked = e["progress_status"] == "Blocked"

        p = people.setdefault(e["logged_by"], {
            "user_id": e["logged_by"], "full_name": e["author_name"], "role": e["author_role"],
            "entries": 0, "blocked": 0, "_projects": set(), "last_update_at": None, "last_week_start": None,
        })
        p["entries"] += 1
        p["blocked"] += blocked
        p["_projects"].add(e["project_id"])
        p["last_update_at"] = _later(p["last_update_at"], e["updated_at"])
        p["last_week_start"] = max(p["last_week_start"] or e["week_start"], e["week_start"])

        pr = projects.setdefault(e["project_id"], {
            "project_id": e["project_id"], "project_name": e["project_name"],
            "project_number": e["project_number"], "archived": e["project_archived"],
            "entries": 0, "blocked": 0, "_people": set(), "last_update_at": None,
        })
        pr["entries"] += 1
        pr["blocked"] += blocked
        pr["_people"].add(e["logged_by"])
        pr["last_update_at"] = _later(pr["last_update_at"], e["updated_at"])

        if e["updated_at"] and (latest is None or e["updated_at"] > latest["updated_at"]):
            latest = e

    people_rows = []
    for p in people.values():
        p["projects"] = len(p.pop("_projects"))
        p["days_ago"] = _days_since(p["last_update_at"], now)
        people_rows.append(p)
    people_rows.sort(key=lambda p: (-p["entries"], p["full_name"] or ""))

    project_rows = []
    for pr in projects.values():
        pr["people"] = len(pr.pop("_people"))
        pr["days_ago"] = _days_since(pr["last_update_at"], now)
        project_rows.append(pr)
    project_rows.sort(key=lambda p: (-p["entries"], p["project_name"]))

    return {
        "total": len(entries),
        "people_reporting": len(people_rows),
        "projects_reporting": len(project_rows),
        "blocked": by_status.get("Blocked", 0),
        "delayed": by_status.get("Delayed", 0),
        "not_worked_on": by_status.get("Not Worked On", 0),
        "by_status": by_status,
        "latest": None if latest is None else {
            "log_id": latest["log_id"], "updated_at": latest["updated_at"], "days_ago": latest["days_ago"],
            "author_name": latest["author_name"], "project_name": latest["project_name"],
            "activity_name": latest["activity_name"], "progress_status": latest["progress_status"],
        },
        "people": people_rows,
        "projects": project_rows,
        "quiet": _gone_quiet(db, f, now),
    }


def _gone_quiet(db: Session, f: ReportFilters, now: datetime) -> list:
    """Everyone who owns open work on a live project and has not written a log lately.

    This is about NOW, so it ignores the status and date filters; it does honour
    the project (quiet on this project) and person filters.
    """
    owners_q = (
        db.query(Task.responsible_user_id, func.count(Task.activity_id))
        .join(Project, Task.project_id == Project.project_id)
        .join(User, Task.responsible_user_id == User.user_id)
        .filter(
            Task.status != "Complete",
            Project.archived_at == None,  # noqa: E711
            User.status.in_(ACTIVE_USER_STATUSES),
        )
    )
    if f.project_id is not None:
        owners_q = owners_q.filter(Task.project_id == f.project_id)
    if f.person_id is not None:
        owners_q = owners_q.filter(Task.responsible_user_id == f.person_id)
    open_work = dict(owners_q.group_by(Task.responsible_user_id).all())
    if not open_work:
        return []

    last_q = (
        db.query(StatusFeedback.logged_by,
                 func.max(func.coalesce(StatusFeedback.updated_at, StatusFeedback.created_at)))
        .filter(StatusFeedback.logged_by.in_(list(open_work)))
    )
    if f.project_id is not None:
        last_q = last_q.filter(StatusFeedback.project_id == f.project_id)
    last = {uid: _naive_utc(at) for uid, at in last_q.group_by(StatusFeedback.logged_by).all()}

    users = {u.user_id: u for u in db.query(User).filter(User.user_id.in_(list(open_work))).all()}
    quiet = []
    for uid, count in open_work.items():
        at = last.get(uid)
        days = _days_since(at, now)
        if at is None or days >= QUIET_AFTER_DAYS:
            u = users.get(uid)
            quiet.append({
                "user_id": uid, "full_name": _name(u) or "Unknown", "role": u.role if u else None,
                "open_activities": count, "last_update_at": at, "days_quiet": days,
            })
    # Never-logged first, then the longest silence.
    quiet.sort(key=lambda q: (q["days_quiet"] is not None, -(q["days_quiet"] or 0), q["full_name"]))
    return quiet


def _options(db: Session) -> dict:
    """What the filter drop-downs offer. Deliberately unfiltered, archived projects included."""
    return {
        "projects": [
            {"project_id": p.project_id, "project_name": p.project_name,
             "project_number": p.project_number, "archived": p.archived_at is not None}
            for p in db.query(Project).order_by(Project.project_name).all()
        ],
        "people": [
            {"user_id": u.user_id, "full_name": _name(u) or f"User {u.user_id}", "role": u.role}
            for u in db.query(User).order_by(User.full_name, User.username).all()
        ],
        "statuses": list(PROGRESS_STATUSES),
    }


# ----------------------------------------------------------------------- exports

CSV_COLUMNS = [
    ("Week starting", lambda e: e["week_start"].isoformat()),
    ("Week ending", lambda e: e["week_end"].isoformat()),
    ("Project number", lambda e: e["project_number"] or ""),
    ("Project", lambda e: e["project_name"] + (" (archived)" if e["project_archived"] else "")),
    ("Activity", lambda e: e["activity_name"]),
    ("Activity owner", lambda e: e["responsible_name"] or ""),
    ("Logged by", lambda e: e["author_name"]),
    ("Status", lambda e: e["progress_status"]),
    ("Percent complete", lambda e: e["percent_complete"]),
    ("Work done", lambda e: e["work_done"] or ""),
    ("Blockers", lambda e: e["blockers"] or ""),
    ("Next steps", lambda e: e["next_steps"] or ""),
    ("Last updated (UTC)", lambda e: e["updated_at"].strftime("%Y-%m-%d %H:%M") if e["updated_at"] else ""),
]


def _csv_cell(value):
    """Free text typed by staff is opened in Excel by executives: never let a cell run as a formula."""
    if isinstance(value, str) and value and (
        value[0] in "=+@\t\r" or (value[0] == "-" and len(value) > 1 and not value[1].isspace())
    ):
        return "'" + value
    return value


def report_csv(report: dict) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\r\n")
    writer.writerow([label for label, _ in CSV_COLUMNS])
    for e in report["entries"]:
        writer.writerow([_csv_cell(get(e)) for _, get in CSV_COLUMNS])
    return "\ufeff" + buf.getvalue()        # the BOM, or Excel mangles every accented name


# A single table row taller than the page makes reportlab give up on the whole
# document, so one runaway write-up cannot be allowed to be that row.
PDF_CELL_CAP = 1800


def _pdf_text(value: Optional[str], cap: int = PDF_CELL_CAP) -> str:
    """Escape for reportlab's mini-markup and fold to what the built-in fonts can draw."""
    from xml.sax.saxutils import escape

    s = value or ""
    for bad, good in (("\u2018", "'"), ("\u2019", "'"), ("\u201c", '"'), ("\u201d", '"'),
                      ("\u2013", "-"), ("\u2014", "-"), ("\u2026", "..."), ("\u00a0", " ")):
        s = s.replace(bad, good)
    s = s.encode("cp1252", errors="ignore").decode("cp1252")
    if len(s) > cap:
        s = s[:cap].rstrip() + f" ... [cut at {cap} of {len(value)} characters - the full text is in the portal and the CSV]"
    return escape(s).replace("\n", "<br/>")


def _describe_filters(report: dict) -> str:
    f = report["filters"]
    opts = report["options"]
    parts = []
    if f["project_id"] is not None:
        p = next((p for p in opts["projects"] if p["project_id"] == f["project_id"]), None)
        parts.append(f"Project: {p['project_name'] if p else f['project_id']}")
    if f["person_id"] is not None:
        u = next((u for u in opts["people"] if u["user_id"] == f["person_id"]), None)
        parts.append(f"Person: {u['full_name'] if u else f['person_id']}")
    if f["progress_status"]:
        parts.append(f"Status: {f['progress_status']}")
    if f["date_from"] or f["date_to"]:
        parts.append(f"Dates: {f['date_from'] or 'start'} to {f['date_to'] or 'today'}")
    return " | ".join(parts) if parts else "No filters - every log on record"


def report_pdf(report: dict, generated_by: str) -> bytes:
    # Imported here so the JSON report does not need the PDF stack to load.
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas as rl_canvas
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, LongTable, TableStyle

    primary = colors.HexColor("#0c4a6e")
    line = colors.HexColor("#e2e8f0")
    muted = colors.HexColor("#64748b")
    rose = colors.HexColor("#e11d48")

    base = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=base["Title"], fontName="Helvetica-Bold", fontSize=20, leading=24,
                        textColor=primary, alignment=0, spaceAfter=4)
    h2 = ParagraphStyle("h2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=11, leading=14,
                        textColor=primary, spaceBefore=12, spaceAfter=6)
    small = ParagraphStyle("small", parent=base["Normal"], fontName="Helvetica", fontSize=8, leading=10,
                           textColor=muted)
    cell = ParagraphStyle("cell", parent=base["Normal"], fontName="Helvetica", fontSize=7.5, leading=9.5)
    head = ParagraphStyle("head", parent=cell, fontName="Helvetica-Bold", textColor=colors.white)

    def P(text, style=cell):
        return Paragraph(text, style)

    def grid(rows, widths, long=False):
        t = (LongTable if long else Table)(rows, colWidths=widths, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), primary),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LINEBELOW", (0, 0), (-1, -1), 0.4, line),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        return t

    def when(days):
        if days is None:
            return "never"
        return "today" if days == 0 else "yesterday" if days == 1 else f"{days} days ago"

    s = report["summary"]
    generated = report["generated_at"].strftime("%d %b %Y %H:%M UTC")
    story = [
        Paragraph("Status Feedback Report", h1),
        P(_pdf_text(f"Every status log across the portfolio. Generated {generated} by {generated_by}."), small),
        P(_pdf_text(_describe_filters(report)), small),
        Spacer(1, 8),
    ]

    latest = s["latest"]
    stats = [
        [P("<b>Logs</b>", head), P("<b>People reporting</b>", head), P("<b>Projects</b>", head),
         P("<b>Blocked</b>", head), P("<b>Delayed</b>", head), P("<b>Latest update</b>", head)],
        [P(str(s["total"])), P(str(s["people_reporting"])), P(str(s["projects_reporting"])),
         P(str(s["blocked"])), P(str(s["delayed"])),
         P(_pdf_text(f"{when(latest['days_ago'])} - {latest['author_name']} on {latest['activity_name']}")
           if latest else "none yet")],
    ]
    story.append(grid(stats, [30 * mm, 36 * mm, 30 * mm, 26 * mm, 26 * mm, 119 * mm]))

    story.append(Paragraph("By person", h2))
    if s["people"]:
        rows = [[P("<b>Person</b>", head), P("<b>Logs</b>", head), P("<b>Blocked</b>", head),
                 P("<b>Projects</b>", head), P("<b>Last update</b>", head)]]
        rows += [[P(_pdf_text(p["full_name"])), P(str(p["entries"])), P(str(p["blocked"])),
                  P(str(p["projects"])), P(when(p["days_ago"]))] for p in s["people"]]
        story.append(grid(rows, [90 * mm, 30 * mm, 30 * mm, 30 * mm, 50 * mm]))
    else:
        story.append(P("Nobody has logged anything in this view.", small))

    story.append(Paragraph("By project", h2))
    if s["projects"]:
        rows = [[P("<b>Project</b>", head), P("<b>Logs</b>", head), P("<b>People</b>", head),
                 P("<b>Blocked</b>", head), P("<b>Last update</b>", head)]]
        rows += [[P(_pdf_text(f"{p['project_number'] + ' - ' if p['project_number'] else ''}{p['project_name']}"
                              + (" (archived)" if p["archived"] else ""))),
                  P(str(p["entries"])), P(str(p["people"])), P(str(p["blocked"])), P(when(p["days_ago"]))]
                 for p in s["projects"]]
        story.append(grid(rows, [90 * mm, 30 * mm, 30 * mm, 30 * mm, 50 * mm]))
    else:
        story.append(P("No project has a log in this view.", small))

    story.append(Paragraph(f"Gone quiet - open work, no log in {report['quiet_after_days']}+ days", h2))
    if s["quiet"]:
        rows = [[P("<b>Person</b>", head), P("<b>Role</b>", head), P("<b>Open activities</b>", head),
                 P("<b>Last log</b>", head)]]
        rows += [[P(_pdf_text(q["full_name"])), P(_pdf_text(q["role"] or "")), P(str(q["open_activities"])),
                  P(when(q["days_quiet"]))] for q in s["quiet"]]
        story.append(grid(rows, [90 * mm, 40 * mm, 40 * mm, 60 * mm]))
    else:
        story.append(P(f"Everyone with open work has logged in the last {report['quiet_after_days']} days.", small))

    story.append(Paragraph(f"All logs ({s['total']})", h2))
    if report["entries"]:
        rows = [[P("<b>Week</b>", head), P("<b>Project</b>", head), P("<b>Activity</b>", head),
                 P("<b>Person</b>", head), P("<b>Status</b>", head), P("<b>Comment</b>", head)]]
        for e in report["entries"]:
            person = _pdf_text(e["author_name"])
            if e["responsible_name"] and e["responsible_name"] != e["author_name"]:
                person += f"<br/><font color='#64748b'>for {_pdf_text(e['responsible_name'])}</font>"
            status = _pdf_text(f"{e['progress_status']} - {e['percent_complete']}%")
            if e["progress_status"] == "Blocked":
                status = f"<font color='#e11d48'><b>{status}</b></font>"
            comment = _pdf_text(e["work_done"]) or "<i>Nothing written for work done.</i>"
            if e["blockers"]:
                comment += f"<br/><font color='#e11d48'><b>Blocked by:</b> {_pdf_text(e['blockers'], 600)}</font>"
            if e["next_steps"]:
                comment += f"<br/><b>Next:</b> {_pdf_text(e['next_steps'], 600)}"
            rows.append([
                P(e["week_start"].strftime("%d %b %Y")),
                P(_pdf_text(e["project_number"] or e["project_name"])),
                P(_pdf_text(e["activity_name"], 300)),
                P(person),
                P(status),
                P(comment),
            ])
        story.append(grid(rows, [20 * mm, 28 * mm, 50 * mm, 34 * mm, 24 * mm, 111 * mm], long=True))
    else:
        story.append(P("No status logs match these filters.", small))

    class NumberedCanvas(rl_canvas.Canvas):
        """'Page 3 of 11' needs page 11 to exist first, so hold every page until the end."""

        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._pages = []

        def showPage(self):
            self._pages.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            total = len(self._pages)
            for state in self._pages:
                self.__dict__.update(state)
                w, _ = landscape(A4)
                self.setStrokeColor(line)
                self.line(12 * mm, 11 * mm, w - 12 * mm, 11 * mm)
                self.setFont("Helvetica", 7)
                self.setFillColor(muted)
                self.drawString(12 * mm, 7 * mm, "Strat Edge Project Portal - Status Feedback report - executives and admins only")
                self.drawRightString(w - 12 * mm, 7 * mm, f"Page {self._pageNumber} of {total}")
                super().showPage()
            super().save()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=landscape(A4), leftMargin=12 * mm, rightMargin=12 * mm, topMargin=12 * mm,
        bottomMargin=16 * mm, title="Status Feedback Report", author="Strat Edge Project Portal",
    )
    doc.build(story, canvasmaker=NumberedCanvas)
    return buf.getvalue()
