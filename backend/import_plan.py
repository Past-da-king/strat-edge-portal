"""Load a written project plan into the portal.

The two Strat Edge plans live as PDFs. `data/plan_*.json` is a faithful,
hand-checked transcription of those tables (see tools/extract_plan_pdf.py for
how they were pulled), and this script turns one of those files into a project
plus its baseline schedule.

    cd backend
    .venv/bin/python import_plan.py data/plan_erp.json            # dry run
    .venv/bin/python import_plan.py data/plan_erp.json --commit   # write it

Run it twice and nothing duplicates: the project is matched on project_number
and each activity on (project, plan_seq), so a re-run updates the row it made
last time. Nothing is ever deleted - an activity that has since been removed
from the paper plan is reported, not dropped, because it may already carry
uploads, spend and weekly logs.
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.models.database import SessionLocal, Project, Task, User, ensure_schema  # noqa: E402

# The plans spell some names differently from the portal's user records. Left is
# what the PDF says, right is the person's real name. Ayanda's surname is
# Phaketsi - the ERP plan has it wrong.
NAME_ALIASES = {
    "ayanda phakathi": "Ayanda Phaketsi",
    "ayanda pakati": "Ayanda Phaketsi",
    "siphumelele mfukeng": "Siphelele Mofokeng",
    # The Mthashana plan lists him by his middle name only.
    "asaf": "Bongani Asaf Shoba",
}

# The plans use their own status words; the portal has three.
STATUS_MAP = {
    "not started": "Not Started",
    "planned": "Not Started",
    "tbc": "Not Started",
    "in progress": "Active",
    "active": "Active",
    "ongoing": "Active",
    "complete": "Complete",
    "completed": "Complete",
}

COMPLEXITY_MAP = {"low": "Low", "medium": "Medium", "high": "High", "very high": "Very High"}


def map_input_type(implementing_agent: str) -> str:
    """Fold the plan's 'Implementing Agent' wording into the portal's four options.

    Anything that needs another party in the room (a call, a meeting, a site
    visit) is External; anything with a tool or a model in the loop is Hybrid;
    the rest is Manual. The plan's own wording is kept verbatim on the activity,
    so nothing is lost by this.
    """
    v = (implementing_agent or "").lower()
    if any(k in v for k in ("phone", "email", "meeting", "site", "interview")):
        return "External"
    if any(k in v for k in ("ai", "data", "portal", "crm", "automat")):
        return "Hybrid"
    return "Manual"


def parse_date(raw):
    """The two plans date things differently ('01-Sep-26' vs '01-Sept-2026')."""
    if not raw:
        return None
    v = re.sub(r"\s+", "", str(raw)).strip(",")
    v = re.sub(r"(?i)\bsept\b", "Sep", v)
    v = re.sub(r"(?i)Sept-", "Sep-", v)
    for fmt in ("%d-%b-%y", "%d-%b-%Y", "%d-%B-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(v, fmt).date()
        except ValueError:
            continue
    print(f"    ! could not read date {raw!r}")
    return None


def first_name_in(cell: str) -> str:
    """The lead person is the first one listed; the rest are support."""
    if not cell:
        return ""
    lead = re.split(r"[,(]|\+", cell)[0]
    return re.sub(r"\s+", " ", lead).strip(" -")


def resolve_user(db, cell: str, cache: dict):
    """Match the plan's lead name to a portal account, or leave it unassigned.

    Deliberately never creates accounts: who has a login is an access decision,
    not an import side effect.
    """
    name = first_name_in(cell)
    if not name:
        return None, None
    key = name.lower()
    canonical = NAME_ALIASES.get(key, name)
    if canonical in cache:
        return cache[canonical], canonical

    users = db.query(User).all()
    match = None
    for u in users:
        full = (u.full_name or "").strip().lower()
        if full == canonical.lower():
            match = u
            break
    if not match:
        # Fall back to a first-name match - the Mthashana plan lists people by
        # first name only ("Asaf", "Sinqobile", "Ayanda").
        first = canonical.split()[0].lower()
        hits = [u for u in users if (u.full_name or "").strip().lower().split()[:1] == [first]]
        if len(hits) == 1:
            match = hits[0]
    cache[canonical] = match
    return match, canonical


def import_plan(path: str, commit: bool) -> int:
    doc = json.load(open(path, encoding="utf-8"))
    meta, activities = doc["project"], doc["activities"]

    db = SessionLocal()
    cache: dict = {}
    unmatched: dict = {}
    created_activities = updated_activities = 0
    try:
        project = (
            db.query(Project).filter(Project.project_number == meta["project_number"]).first()
        )
        starts = [d for d in (parse_date(a.get("start")) for a in activities) if d]
        ends = [d for d in (parse_date(a.get("finish")) for a in activities) if d]

        if project:
            print(f"Project {meta['project_number']} already exists (id {project.project_id}) - updating")
        else:
            project = Project(project_number=meta["project_number"])
            db.add(project)
            print(f"Creating project {meta['project_number']}")
        project.project_name = meta["project_name"]
        project.client = meta.get("client")
        project.start_date = min(starts) if starts else None
        project.target_end_date = max(ends) if ends else None
        if not project.status:
            project.status = "active"
        db.flush()

        existing = {t.plan_seq: t for t in db.query(Task).filter(Task.project_id == project.project_id).all()
                    if t.plan_seq is not None}
        by_name = {t.activity_name.strip().lower(): t
                   for t in db.query(Task).filter(Task.project_id == project.project_id).all()}

        seen = set()
        for a in activities:
            seq = int(a["seq"])
            seen.add(seq)
            user, canonical = resolve_user(db, a.get("responsible", ""), cache)
            if canonical and not user:
                unmatched.setdefault(canonical, 0)
                unmatched[canonical] += 1

            task = existing.get(seq) or by_name.get(a["activity"].strip().lower())
            if task is None:
                task = Task(project_id=project.project_id)
                db.add(task)
                created_activities += 1
            else:
                updated_activities += 1

            task.plan_seq = seq
            task.sort_order = seq
            task.activity_name = a["activity"]
            task.responsible_names = a.get("responsible")
            task.responsible_user_id = user.user_id if user else None
            task.planned_start = parse_date(a.get("start"))
            task.planned_finish = parse_date(a.get("finish"))
            task.status = STATUS_MAP.get((a.get("status") or "").strip().lower(), "Not Started")
            task.kpi = a.get("kpi")
            task.critical_path = a.get("critical_path")
            task.expected_output = a.get("output")
            task.implementing_agent = a.get("implementing_agent")
            task.input_type = map_input_type(a.get("implementing_agent"))
            fin = (a.get("financial_input") or "").strip().lower()
            task.financial_input = "Yes" if fin in ("y", "yes") else "No"
            task.financial_input_type = a.get("financial_input_type")
            task.complexity = COMPLEXITY_MAP.get((a.get("complexity") or "").strip().lower(), "Medium")

        stale = [t for seq, t in existing.items() if seq not in seen]
        if stale:
            print(f"  ! {len(stale)} activity/activities are in the portal but not in this plan "
                  f"- left untouched: {[t.activity_name for t in stale]}")

        print(f"  activities: {created_activities} new, {updated_activities} updated")
        if unmatched:
            print("  ! no portal account matches these names - activities left unassigned:")
            for name, n in sorted(unmatched.items()):
                print(f"      {name} ({n} activities)")

        if commit:
            db.commit()
            print(f"  COMMITTED -> project_id {project.project_id}")
        else:
            db.rollback()
            print("  DRY RUN - nothing written. Re-run with --commit to apply.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("plan", nargs="+", help="path to a data/plan_*.json file")
    ap.add_argument("--commit", action="store_true", help="actually write to the database")
    args = ap.parse_args()

    ensure_schema()
    rc = 0
    for p in args.plan:
        print(f"\n=== {p} ===")
        rc |= import_plan(p, args.commit)
    sys.exit(rc)
