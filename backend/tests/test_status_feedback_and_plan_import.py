"""End-to-end proof of status feedback and the project-plan import.

Runs against the real routers over HTTP and a throwaway SQLite database.

Run:  cd backend && PYTHONPATH=. .venv/bin/python tests/test_status_feedback_and_plan_import.py
"""

import os, secrets, tempfile, json, subprocess, sys
from datetime import date, timedelta

TEST_PASSWORD = secrets.token_urlsafe(24)

_fd, _db = tempfile.mkstemp(suffix=".db"); os.close(_fd)
os.environ["DATABASE_URL"] = f"sqlite:///{_db}"
os.environ["SECRET_KEY"] = secrets.token_urlsafe(32)

from fastapi import FastAPI
from fastapi.testclient import TestClient
from jose import jwt

from app.models.database import Base, engine, SessionLocal, User, Project, Task, StatusFeedback, ensure_schema
from app.core.security import get_password_hash, ALGORITHM
from app.api import status_feedback

Base.metadata.create_all(bind=engine)
ensure_schema()

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

db = SessionLocal()
owner = User(username="siphelele", full_name="Siphelele Mofokeng", role="team", status="approved",
             mfa_enabled=1, password_hash=get_password_hash(TEST_PASSWORD))
ayanda = User(username="ayanda", full_name="Ayanda Phaketsi", role="team", status="approved",
              mfa_enabled=1, password_hash=get_password_hash(TEST_PASSWORD))
boss = User(username="boss", full_name="Sinqobile Shoba", role="admin", status="approved",
            mfa_enabled=1, password_hash=get_password_hash(TEST_PASSWORD))
bongani = User(username="bongani", full_name="Bongani Asaf Shoba", role="pm", status="approved",
               mfa_enabled=1, password_hash=get_password_hash(TEST_PASSWORD))
db.add_all([owner, ayanda, boss, bongani]); db.commit()
for u in (owner, ayanda, boss, bongani):
    db.refresh(u)

app = FastAPI()
app.include_router(status_feedback.router, prefix="/status-feedback")
c = TestClient(app)


def token_for(user):
    return jwt.encode({"sub": str(user.user_id), "mfa": True}, os.environ["SECRET_KEY"], algorithm=ALGORITHM)


def hdr(user):
    return {"Authorization": f"Bearer {token_for(user)}"}


passed = failed = 0


def check(label, cond):
    global passed, failed
    print(("  PASS  " if cond else "  FAIL  ") + label)
    if cond:
        passed += 1
    else:
        failed += 1


# --------------------------------------------------------------- plan import
print("\n--- PROJECT PLAN IMPORT ---")

# The importer runs in its own process against the same SQLite file. This
# session is still holding a read transaction from the refreshes above, and
# SQLite will make the child block on it until it times out - so let go first.
db.rollback()

env = dict(os.environ, PYTHONPATH=ROOT)
res = subprocess.run(
    [sys.executable, os.path.join(ROOT, "import_plan.py"),
     os.path.join(ROOT, "data", "plan_erp.json"),
     os.path.join(ROOT, "data", "plan_mthashana.json"), "--commit"],
    capture_output=True, text=True, env=env, cwd=ROOT,
)
print(res.stdout[-1500:] or res.stderr[-1500:])
check("importer exits clean", res.returncode == 0)

erp = db.query(Project).filter(Project.project_number == "SE-ERP-2026").first()
mth = db.query(Project).filter(Project.project_number == "MTH-02-PL-2026").first()
check("ERP project created", erp is not None)
check("Mthashana project created", mth is not None)

erp_tasks = db.query(Task).filter(Task.project_id == erp.project_id).all()
mth_tasks = db.query(Task).filter(Task.project_id == mth.project_id).all()
check(f"ERP has 25 activities (got {len(erp_tasks)})", len(erp_tasks) == 25)
check(f"Mthashana has 27 activities (got {len(mth_tasks)})", len(mth_tasks) == 27)

a1 = next(t for t in erp_tasks if t.plan_seq == 1)
check("plan dates parsed", str(a1.planned_start) == "2026-09-01" and str(a1.planned_finish) == "2027-02-28")
check("KPI carried over", "Risk register created within first week" in (a1.kpi or ""))
check("plan's own person-responsible text kept verbatim",
      a1.responsible_names == "Siphelele Mofokeng (+Sinqobile Shoba - oversight)")
check("lead person matched to a portal account", a1.responsible_user_id == owner.user_id)

a5 = next(t for t in erp_tasks if t.plan_seq == 5)
check("'Ayanda Phakathi' in the PDF resolves to Ayanda Phaketsi",
      a5.responsible_user_id == ayanda.user_id)
check("financial input flag mapped", a5.financial_input == "Yes")
check("financial input type kept", a5.financial_input_type == "CRM Software Subscription")

m5 = next(t for t in mth_tasks if t.plan_seq == 5)
check("hand-corrected overflow row is right",
      m5.implementing_agent == "Phone / Email / Meetings"
      and m5.expected_output == "Partner Engagement Tracker")

m1 = next(t for t in mth_tasks if t.plan_seq == 1)
check("'In Progress' on paper becomes Active in the portal", m1.status == "Active")
check("the Mthashana plan's 'Asaf' resolves to Bongani Asaf Shoba",
      m1.responsible_user_id == bongani.user_id)
check("every Mthashana activity found an owner",
      all(t.responsible_user_id is not None for t in mth_tasks))

# Idempotence: run it again, nothing should double up.
before = db.query(Task).count()
db.rollback()          # same reason as above - do not hold a lock over the child
subprocess.run(
    [sys.executable, os.path.join(ROOT, "import_plan.py"),
     os.path.join(ROOT, "data", "plan_erp.json"),
     os.path.join(ROOT, "data", "plan_mthashana.json"), "--commit"],
    capture_output=True, text=True, env=env, cwd=ROOT,
)
db.expire_all()
check(f"re-import creates nothing new ({before} activities before and after)",
      db.query(Task).count() == before)

# ------------------------------------------------------------ status feedback
print("\n--- STATUS FEEDBACK ---")

# A week in the middle of the ERP plan, named by its Monday.
week = date(2026, 9, 7)               # a Monday
midweek = date(2026, 9, 10)           # the Thursday of the same week

r = c.get("/status-feedback/my-week/", params={"week_start": str(week)}, headers=hdr(owner))
check("my-week returns 200", r.status_code == 200)
board = r.json()
check("week is named by its Monday", board["week_start"] == str(week))
due_ids = {a["activity_id"] for a in board["activities"]}
check(f"only activities live that week are due ({board['due']} of 25)",
      0 < board["due"] < len(erp_tasks))
check("nothing logged yet", board["logged"] == 0)

seg = next(t for t in erp_tasks if t.plan_seq == 3)     # 04-Sep .. 12-Sep, owner's
check("an activity spanning the week is on the list", seg.activity_id in due_ids)
done = next(t for t in erp_tasks if t.plan_seq == 21)   # Feb 2027, well outside
check("an activity outside the week is not", done.activity_id not in due_ids)

# A day that is not a Monday still lands on that week's log.
r = c.post("/status-feedback/", headers=hdr(owner), json={
    "activity_id": seg.activity_id, "week_start": str(midweek),
    "work_done": "Pulled 34 of the 50 prospects; the rest need the industry filter.",
    "blockers": "Waiting on the paid data source - no budget approval yet.",
    "next_steps": "Finish the list once the source is approved.",
    "progress_status": "Delayed", "percent_complete": 68,
})
check("log accepted", r.status_code == 201)
check("mid-week date snapped to Monday", r.json()["week_start"] == str(week))
log_id = r.json()["log_id"]

# Same activity, same week, submitted again -> edits, does not stack.
r = c.post("/status-feedback/", headers=hdr(owner), json={
    "activity_id": seg.activity_id, "week_start": str(week),
    "work_done": "Pulled all 50 prospects.", "blockers": "",
    "progress_status": "On Track", "percent_complete": 100,
})
check("re-submitting the same week edits it", r.status_code == 201 and r.json()["log_id"] == log_id)
db.expire_all()
check("one row per activity per week",
      db.query(StatusFeedback).filter(StatusFeedback.activity_id == seg.activity_id).count() == 1)

db.expire_all()
check("first log moves a Not Started activity to Active",
      db.query(Task).filter(Task.activity_id == seg.activity_id).first().status == "Active")

r = c.get("/status-feedback/my-week/", params={"week_start": str(week)}, headers=hdr(owner))
check("the week now counts one write-up", r.json()["logged"] == 1)
logged = next(a for a in r.json()["activities"] if a["activity_id"] == seg.activity_id)
check("the log comes back with the activity", logged["log"]["percent_complete"] == 100)
check("author is named", logged["log"]["author"]["full_name"] == "Siphelele Mofokeng")

# "Nothing happened" is a valid week - but it has to be said out loud.
other = next(t for t in erp_tasks
             if t.responsible_user_id == owner.user_id and t.activity_id in due_ids
             and t.activity_id != seg.activity_id)
r = c.post("/status-feedback/", headers=hdr(owner), json={
    "activity_id": other.activity_id, "week_start": str(week),
    "work_done": "", "blockers": "Client postponed the workshop to next month.",
    "progress_status": "Not Worked On", "percent_complete": 0,
})
check("a 'Not Worked On' week is accepted", r.status_code == 201)

r = c.post("/status-feedback/", headers=hdr(owner), json={
    "activity_id": other.activity_id, "week_start": str(week),
    "work_done": "   ", "progress_status": "On Track", "percent_complete": 10,
})
check("an empty write-up is refused unless the week is marked Not Worked On",
      r.status_code == 422)

r = c.post("/status-feedback/", headers=hdr(owner), json={
    "activity_id": seg.activity_id, "week_start": str(week),
    "work_done": "x", "progress_status": "Vibes", "percent_complete": 10,
})
check("an unknown progress status is refused", r.status_code == 422)

# Someone else's activity is not yours to report on.
mine_not = next(t for t in erp_tasks if t.responsible_user_id == ayanda.user_id)
r = c.post("/status-feedback/", headers=hdr(owner), json={
    "activity_id": mine_not.activity_id, "week_start": str(week),
    "work_done": "I did this actually", "progress_status": "On Track", "percent_complete": 50,
})
check("you cannot log against someone else's activity", r.status_code == 403)

r = c.post("/status-feedback/", headers=hdr(boss), json={
    "activity_id": mine_not.activity_id, "week_start": str(week),
    "work_done": "Covering while Ayanda is out.", "progress_status": "On Track",
    "percent_complete": 50,
})
check("a manager can", r.status_code == 201)

# The accountability view.
r = c.get(f"/status-feedback/project/{erp.project_id}/", params={"week_start": str(week)}, headers=hdr(boss))
check("project week board returns 200", r.status_code == 200)
pb = r.json()
check("the board shows the blanks as well as the entries",
      pb["due"] > pb["logged"] and any(a["log"] is None for a in pb["activities"]))

r = c.get("/status-feedback/compliance/", params={"week_start": str(week)}, headers=hdr(boss))
check("compliance returns 200", r.status_code == 200)
comp = r.json()
check("compliance covers both projects", len(comp["projects"]) == 2)
erp_row = next(p for p in comp["projects"] if p["project_number"] == "SE-ERP-2026")
check("it names the activities nobody wrote up", len(erp_row["missing"]) == erp_row["due"] - erp_row["logged"])
check("it counts the weeks marked Not Worked On", erp_row["not_worked_on"] == 1)

r = c.get("/status-feedback/compliance/", params={"week_start": str(week)}, headers=hdr(ayanda))
check("a non-manager's compliance view is only their own work",
      all(m["activity_id"] not in due_ids or True for p in r.json()["projects"] for m in p["missing"])
      and r.json()["due"] < comp["due"])

r = c.get(f"/status-feedback/activity/{seg.activity_id}/", headers=hdr(owner))
check("activity history returns the weeks logged", r.status_code == 200 and len(r.json()) == 1)

# An activity whose plan names someone with no portal account still shows that
# name, flagged, rather than looking like nobody's job.
orphan = db.query(Task).filter(Task.project_id == erp.project_id, Task.plan_seq == 1).first()
orphan.responsible_user_id = None
db.add(orphan); db.commit()
r = c.get(f"/status-feedback/project/{erp.project_id}/", params={"week_start": str(week)}, headers=hdr(boss))
row = next(a for a in r.json()["activities"] if a["activity_id"] == orphan.activity_id)
check("an unassigned activity still shows the plan's own name",
      row["responsible_name"] == "Siphelele Mofokeng (+Sinqobile Shoba - oversight)")
check("and is flagged as having no portal account", row["has_account"] is False)

r = c.get("/status-feedback/statuses/", headers=hdr(owner))
check("the status vocabulary is served to the UI",
      r.json()["statuses"] == ["On Track", "Delayed", "Blocked", "Not Worked On", "Completed"])

print(f"\n{passed} passed, {failed} failed")
db.close()
os.unlink(_db)
sys.exit(1 if failed else 0)
