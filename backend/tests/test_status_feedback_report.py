"""End-to-end proof of the executive + admin status feedback report.

Runs the real router over HTTP. It checks the report on an EMPTY database first,
because pages in this estate have shipped that only worked once there was data.

Run:  cd backend && PYTHONPATH=. .venv/bin/python tests/test_status_feedback_report.py
Against a throwaway local Postgres instead of SQLite:
      docker exec guavas-pg psql -U postgres -c "CREATE DATABASE portal_report_test"
      TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/portal_report_test \
        PYTHONPATH=. .venv/bin/python tests/test_status_feedback_report.py
"""

import csv, io, os, secrets, shutil, subprocess, sys, tempfile
from datetime import date, datetime, timedelta, timezone

TEST_PASSWORD = secrets.token_urlsafe(24)

_db = None
if os.environ.get("TEST_DATABASE_URL"):
    url = os.environ["TEST_DATABASE_URL"]
    if not any(h in url for h in ("localhost", "127.0.0.1")):
        sys.exit("Refusing to run: this test drops every table, and TEST_DATABASE_URL is not local.")
    os.environ["DATABASE_URL"] = url
else:
    _fd, _db = tempfile.mkstemp(suffix=".db"); os.close(_fd)
    os.environ["DATABASE_URL"] = f"sqlite:///{_db}"
os.environ["SECRET_KEY"] = secrets.token_urlsafe(32)

from fastapi import FastAPI
from fastapi.testclient import TestClient
from jose import jwt

from app.models.database import (
    Base, engine, SessionLocal, User, Project, Task, StatusFeedback, ensure_schema,
)
from app.core.security import get_password_hash, ALGORITHM
from app.api import status_feedback, status_feedback_report

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
ensure_schema()

db = SessionLocal()


def person(username, full_name, role, status="approved"):
    u = User(username=username, full_name=full_name, role=role, status=status, mfa_enabled=1,
             password_hash=get_password_hash(TEST_PASSWORD))
    db.add(u); db.commit(); db.refresh(u)
    return u


admin = person("ayanda", "Ayanda Phaketsi", "admin")
executive = person("sinqobile", "Sinqobile Shoba", "executive")
pm = person("bongani", "Bongani Asaf Shoba", "pm")
team = person("siphelele", "Siphelele Mofokeng", "team")

app = FastAPI()
app.include_router(status_feedback.router, prefix="/status-feedback")
app.include_router(status_feedback_report.router, prefix="/status-feedback")
c = TestClient(app)


def hdr(user):
    token = jwt.encode({"sub": str(user.user_id), "mfa": True}, os.environ["SECRET_KEY"], algorithm=ALGORITHM)
    return {"Authorization": f"Bearer {token}"}


passed = failed = 0


def check(label, cond):
    global passed, failed
    print(("  PASS  " if cond else "  FAIL  ") + label)
    if cond:
        passed += 1
    else:
        failed += 1


def pdf_text(data: bytes) -> str:
    """What was actually drawn. Grepping PDF bytes proves nothing - content streams are compressed."""
    if not shutil.which("pdftotext"):
        return ""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as fh:
        fh.write(data)
    try:
        out = subprocess.run(["pdftotext", fh.name, "-"], capture_output=True, text=True).stdout
        return " ".join(out.split())     # a table cell wraps a sentence across lines
    finally:
        os.unlink(fh.name)


def parse_csv(text: str):
    return list(csv.reader(io.StringIO(text.lstrip("\ufeff"), newline="")))


# ------------------------------------------------------------------- the lock
print("\n--- WHO MAY SEE IT ---")

for who in (admin, executive):
    r = c.get("/status-feedback/report/", headers=hdr(who))
    check(f"{who.role} gets the report (200)", r.status_code == 200)
for who in (pm, team):
    r = c.get("/status-feedback/report/", headers=hdr(who))
    check(f"{who.role} is refused by the server (403, got {r.status_code})", r.status_code == 403)
    for fmt in ("csv", "pdf"):
        r = c.get("/status-feedback/report/export/", params={"format": fmt}, headers=hdr(who))
        check(f"{who.role} cannot export it as {fmt} either (403)", r.status_code == 403)
r = c.get("/status-feedback/report/", headers=hdr(team), params={"project_id": 1, "person_id": team.user_id})
check("a team member asking only about themselves is still refused", r.status_code == 403)
r = c.get("/status-feedback/report/")
check("no token at all is refused (401)", r.status_code == 401)
bad = jwt.encode({"sub": str(admin.user_id)}, os.environ["SECRET_KEY"], algorithm=ALGORITHM)
r = c.get("/status-feedback/report/", headers={"Authorization": f"Bearer {bad}"})
check("an admin token without a verified 2FA claim is refused (401)", r.status_code == 401)

# ------------------------------------------------------------- empty database
print("\n--- EMPTY DATABASE ---")

r = c.get("/status-feedback/report/", headers=hdr(admin))
empty = r.json()
check("empty report returns 200", r.status_code == 200)
check("no entries, zero totals", empty["entries"] == [] and empty["summary"]["total"] == 0)
check("no latest update, no people, no projects",
      empty["summary"]["latest"] is None and empty["summary"]["people"] == [] and empty["summary"]["projects"] == [])
check("nobody is quiet when nobody owns work", empty["summary"]["quiet"] == [])
check("every status is present with a zero count",
      empty["summary"]["by_status"] == {"On Track": 0, "Delayed": 0, "Blocked": 0, "Not Worked On": 0, "Completed": 0})
check("filter options still list the people", len(empty["options"]["people"]) == 4)

r = c.get("/status-feedback/report/export/", params={"format": "csv"}, headers=hdr(admin))
check("empty CSV downloads", r.status_code == 200 and r.headers["content-type"].startswith("text/csv"))
rows = parse_csv(r.content.decode("utf-8"))
check("empty CSV is just the header row", len(rows) == 1 and rows[0][0] == "Week starting")
check("CSV starts with a BOM so Excel keeps accents", r.content.startswith("\ufeff".encode("utf-8")))
check("CSV is offered as a named attachment",
      'filename="status-feedback-report_' in r.headers.get("content-disposition", ""))

r = c.get("/status-feedback/report/export/", params={"format": "pdf"}, headers=hdr(executive))
check("empty PDF downloads", r.status_code == 200 and r.content.startswith(b"%PDF"))
text = pdf_text(r.content)
if text:
    check("empty PDF says so rather than printing naked headings", "No status logs match these filters." in text)
    check("empty PDF is numbered", "Page 1 of 1" in text)

r = c.get("/status-feedback/report/export/", params={"format": "xlsx"}, headers=hdr(admin))
check("an unknown export format is refused (422)", r.status_code == 422)

# ---------------------------------------------------------------- populated
print("\n--- POPULATED ---")

now = datetime.now(timezone.utc).replace(tzinfo=None)
this_monday = date.today() - timedelta(days=date.today().weekday())

quiet_one = person("nkululeko", "Nkululeko Shoba", "team")              # owns work, never logged
lapsed = person("thandi", "Thandi Dlamini", "team")                      # last logged 20 days ago
gone = person("former", "Former Staffer", "team", status="rejected")     # inactive: not "quiet"
archived_only = person("archie", "Archie Ved", "team")                   # only work is on an archived project

erp = Project(project_name="ERP Sales & Market Entry Plan", project_number="SE-ERP-2026")
mth = Project(project_name="Mthashana Partnerships", project_number="MTH-02-PL-2026")
old = Project(project_name="Closed Pilot", project_number="OLD-1", archived_at=now - timedelta(days=40))
db.add_all([erp, mth, old]); db.commit()
for p in (erp, mth, old):
    db.refresh(p)


def activity(project, name, owner, status="Active"):
    t = Task(project_id=project.project_id, activity_name=name, status=status,
             responsible_user_id=owner.user_id if owner else None)
    db.add(t); db.commit(); db.refresh(t)
    return t


a_prospects = activity(erp, "Build the prospect list", team)
a_crm = activity(erp, "Stand up the CRM", team)
a_partner = activity(mth, "Partner engagement tracker", pm)
a_quiet = activity(mth, "Draft MOU", quiet_one)
a_lapsed = activity(erp, "Pricing sheet", lapsed)
a_gone = activity(erp, "Old handover", gone)
a_arch = activity(old, "Pilot wrap-up", archived_only)
a_done = activity(mth, "Kick-off", quiet_one, status="Complete")

HOSTILE = 'Called 12 clients, "warm" leads, one said: no — thanks… 😀 <b>bold</b> & more,\nsecond line'
RUNAWAY = "word " * 5000


def log(act, author, week, status, pct, work, when, blockers=None, next_steps=None):
    entry = StatusFeedback(activity_id=act.activity_id, project_id=act.project_id, week_start=week,
                           progress_status=status, percent_complete=pct, work_done=work,
                           blockers=blockers, next_steps=next_steps, logged_by=author.user_id,
                           created_at=when, updated_at=when)
    db.add(entry); db.commit(); db.refresh(entry)
    return entry


w0, w1, w3 = this_monday, this_monday - timedelta(weeks=1), this_monday - timedelta(weeks=3)
l1 = log(a_prospects, team, w0, "Delayed", 60, HOSTILE, now - timedelta(days=1),
         blockers="Waiting on budget approval", next_steps="=HYPERLINK(\"http://x\")")
l2 = log(a_prospects, team, w1, "On Track", 40, "Pulled 34 of 50 prospects", now - timedelta(days=8))
l3 = log(a_crm, admin, w0, "Blocked", 10, RUNAWAY, now - timedelta(hours=2),
         blockers="Covering for Siphelele: licence not bought")
l4 = log(a_partner, pm, w1, "On Track", 50, "Two partner meetings held", now - timedelta(days=6))
l5 = log(a_lapsed, lapsed, w3, "Not Worked On", 0, "", now - timedelta(days=20),
         blockers="On leave")
l6 = log(a_arch, archived_only, w3, "Completed", 100, "Wrapped up the pilot", now - timedelta(days=21))

r = c.get("/status-feedback/report/", headers=hdr(admin))
rep = r.json()
check("populated report returns 200", r.status_code == 200)
check(f"every log is in it (6, got {rep['summary']['total']})", rep["summary"]["total"] == 6 and len(rep["entries"]) == 6)
check("newest week first", [e["week_start"] for e in rep["entries"]] == sorted((e["week_start"] for e in rep["entries"]), reverse=True))
ids = [e["log_id"] for e in rep["entries"]]
check("inside a week, the most recently updated write-up comes first", ids.index(l3.log_id) < ids.index(l1.log_id))
e1 = next(e for e in rep["entries"] if e["log_id"] == l1.log_id)
check("an entry carries who, project, activity, status and the comment",
      e1["author_name"] == "Siphelele Mofokeng" and e1["project_number"] == "SE-ERP-2026"
      and e1["activity_name"] == "Build the prospect list" and e1["progress_status"] == "Delayed"
      and e1["work_done"] == HOSTILE and e1["blockers"] == "Waiting on budget approval")
e3 = next(e for e in rep["entries"] if e["log_id"] == l3.log_id)
check("a manager's cover log names both the author and the activity owner",
      e3["author_name"] == "Ayanda Phaketsi" and e3["responsible_name"] == "Siphelele Mofokeng")
check("logs on an archived project are kept, and flagged",
      next(e for e in rep["entries"] if e["log_id"] == l6.log_id)["project_archived"] is True)

s = rep["summary"]
check("latest update is the most recent write-up", s["latest"]["log_id"] == l3.log_id and s["latest"]["days_ago"] == 0)
check("blocked and delayed are counted", s["blocked"] == 1 and s["delayed"] == 1 and s["not_worked_on"] == 1)
sip = next(p for p in s["people"] if p["full_name"] == "Siphelele Mofokeng")
check("per person: Siphelele wrote 2 logs, last yesterday", sip["entries"] == 2 and sip["days_ago"] == 1)
check(f"per person: 5 people have written something (got {s['people_reporting']})", s["people_reporting"] == 5)
erp_row = next(p for p in s["projects"] if p["project_number"] == "SE-ERP-2026")
check("per project: ERP has 4 logs from 3 people, 1 blocked",
      erp_row["entries"] == 4 and erp_row["people"] == 3 and erp_row["blocked"] == 1)

quiet = {q["full_name"]: q for q in s["quiet"]}
check("someone with open work who has never logged is quiet",
      "Nkululeko Shoba" in quiet and quiet["Nkululeko Shoba"]["days_quiet"] is None)
check("their completed activity is not counted as open work", quiet["Nkululeko Shoba"]["open_activities"] == 1)
check("someone whose last log was 20 days ago is quiet", quiet.get("Thandi Dlamini", {}).get("days_quiet") == 20)
check("people who logged this week are not quiet",
      not {"Siphelele Mofokeng", "Bongani Asaf Shoba"} & set(quiet))
check("an inactive account is not chased", "Former Staffer" not in quiet)
check("work on an archived project does not make you quiet", "Archie Ved" not in quiet)
check("never-logged are listed before the longest silence", s["quiet"][0]["days_quiet"] is None)

print("\n--- FILTERS ---")


def report(**params):
    r = c.get("/status-feedback/report/", headers=hdr(admin), params=params)
    return r.status_code, r.json()


code, f = report(project_id=mth.project_id)
check("project filter", code == 200 and {e["project_id"] for e in f["entries"]} == {mth.project_id})
check("project filter narrows the quiet list to that project",
      {q["full_name"] for q in f["summary"]["quiet"]} == {"Nkululeko Shoba"})

code, f = report(person_id=team.user_id)
check("person filter includes what they wrote AND a manager's cover on their activity",
      {e["log_id"] for e in f["entries"]} == {l1.log_id, l2.log_id, l3.log_id})

code, f = report(progress_status="Blocked")
check("status filter", [e["log_id"] for e in f["entries"]] == [l3.log_id])

mid_last_week = w1 + timedelta(days=3)
code, f = report(date_from=str(mid_last_week), date_to=str(mid_last_week))
check("a date range starting mid-week still catches that week's logs",
      {e["log_id"] for e in f["entries"]} == {l2.log_id, l4.log_id})

code, f = report(project_id=erp.project_id, person_id=team.user_id, progress_status="On Track")
check("filters combine", [e["log_id"] for e in f["entries"]] == [l2.log_id])

code, f = report(project_id=99999)
check("a filter that matches nothing is an empty report, not an error",
      code == 200 and f["entries"] == [] and f["summary"]["latest"] is None)

code, _ = report(date_from="2026-09-10", date_to="2026-09-01")
check("a backwards date range is refused (422)", code == 422)
code, _ = report(progress_status="Vibes")
check("an unknown status is refused (422)", code == 422)

print("\n--- EXPORTS ---")

r = c.get("/status-feedback/report/export/", params={"format": "csv"}, headers=hdr(admin))
rows = parse_csv(r.content.decode("utf-8"))
check("CSV has a header plus one row per log", len(rows) == 7)
check("every CSV row has the header's width", all(len(row) == len(rows[0]) for row in rows))
hostile_row = next(row for row in rows if row[9] == HOSTILE)
check("commas, quotes, a newline and an emoji survive the CSV round trip", hostile_row[6] == "Siphelele Mofokeng")
check("a comment that looks like a formula cannot run in Excel", hostile_row[11].startswith("'="))

r = c.get("/status-feedback/report/export/", params={"format": "csv", "progress_status": "Blocked"}, headers=hdr(admin))
check("CSV honours the filters", len(parse_csv(r.content.decode("utf-8"))) == 2)

r = c.get("/status-feedback/report/export/", params={"format": "pdf"}, headers=hdr(admin))
check("PDF with hostile text and a 25,000-character write-up still builds",
      r.status_code == 200 and r.content.startswith(b"%PDF") and r.headers["content-type"] == "application/pdf")
text = pdf_text(r.content)
if text:
    check("PDF title is drawn", "Status Feedback Report" in text)
    check("PDF names people and projects", "Siphelele Mofokeng" in text and "SE-ERP-2026" in text)
    check("PDF shows the quiet list", "Nkululeko Shoba" in text and "never" in text)
    check("markup in a comment is printed, not interpreted", "<b>bold</b>" in text)
    check("the runaway write-up is cut and says where the rest is", "the full text is in the portal" in text)
    check("PDF pages are numbered 'of N'", "Page 1 of " in text)
else:
    print("  (pdftotext not installed - skipped reading the PDF's drawn text)")

r = c.get("/status-feedback/report/export/", params={"format": "pdf", "person_id": quiet_one.user_id}, headers=hdr(admin))
text = pdf_text(r.content)
check("a filtered PDF with no logs still builds", r.status_code == 200 and (not text or "No status logs match" in text))

print(f"\n{passed} passed, {failed} failed")
db.close()
if _db:
    os.unlink(_db)
else:
    Base.metadata.drop_all(bind=engine)
sys.exit(1 if failed else 0)
