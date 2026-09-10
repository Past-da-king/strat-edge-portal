"""The risk register shows live projects only, and only the projects you are on.

Before 10 Sep 2026 GET /risks/ returned every risk in the database: archiving a
project left its risks on the board (every live risk at the time belonged to an
archived project), anyone could read any project's risks, and logging a new
risk crashed on a column that does not exist.

Run:  cd backend && PYTHONPATH=. .venv/bin/python tests/test_risks_archive_and_visibility.py
"""

import os, secrets, sys, tempfile
from datetime import datetime

_fd, _db = tempfile.mkstemp(suffix=".db"); os.close(_fd)
os.environ["DATABASE_URL"] = f"sqlite:///{_db}"
os.environ["SECRET_KEY"] = secrets.token_urlsafe(32)

from fastapi import FastAPI
from fastapi.testclient import TestClient
from jose import jwt

from app.models.database import Base, engine, SessionLocal, User, Project, Task, Risk, ensure_schema
from app.core.security import ALGORITHM
from app.api import risks

Base.metadata.create_all(bind=engine)
ensure_schema()
db = SessionLocal()

app = FastAPI()
app.include_router(risks.router, prefix="/risks")
c = TestClient(app)

passed = failed = 0


def check(label, cond):
    global passed, failed
    print(("  PASS  " if cond else "  FAIL  ") + label)
    if cond:
        passed += 1
    else:
        failed += 1


def person(username, role):
    u = User(username=username, full_name=username.title(), role=role, status="approved", mfa_enabled=1,
             password_hash=secrets.token_hex(8))
    db.add(u); db.commit(); db.refresh(u)
    return u


def hdr(user):
    return {"Authorization": "Bearer " + jwt.encode({"sub": str(user.user_id), "mfa": True},
                                                    os.environ["SECRET_KEY"], algorithm=ALGORITHM)}


def ids(r):
    return sorted(x["risk_id"] for x in r.json())


admin = person("ayanda", "admin")
executive = person("sinqobile", "executive")
pm = person("siphelele", "pm")          # leads ERP and the archived project
team = person("bongani", "team")        # owns an activity on Mthashana
outsider = person("stranger", "team")   # on nothing

print("\n--- EMPTY ---")
r = c.get("/risks/", headers=hdr(admin))
check("an empty register is 200 and []", r.status_code == 200 and r.json() == [])
check("no token is refused", c.get("/risks/").status_code == 401)

erp = Project(project_name="ERP", project_number="SE-ERP-2026", pm_user_id=pm.user_id)
mth = Project(project_name="Mthashana", project_number="MTH-02-PL-2026")
old = Project(project_name="LINKAGES&PARTNERSHIPS", project_number="OLD-1", pm_user_id=pm.user_id,
              archived_at=datetime(2026, 8, 20))
db.add_all([erp, mth, old]); db.commit()
for p in (erp, mth, old):
    db.refresh(p)
db.add(Task(project_id=mth.project_id, activity_name="Partner tracker", responsible_user_id=team.user_id))


def risk(project, text):
    x = Risk(project_id=project.project_id, description=text, impact="M", status="Open")
    db.add(x); db.commit(); db.refresh(x)
    return x.risk_id


e1, e2 = risk(erp, "CRM licence not approved"), risk(erp, "Data source delayed")
m1 = risk(mth, "Partner MOU unsigned")
o1, o2, o3 = risk(old, "Old risk A"), risk(old, "Old risk B"), risk(old, "Old risk C")

print("\n--- ARCHIVED PROJECTS ---")
r = c.get("/risks/", headers=hdr(admin))
check("admin's register leaves out the archived project's risks", ids(r) == sorted([e1, e2, m1]))
check("executive's too", ids(c.get("/risks/", headers=hdr(executive))) == sorted([e1, e2, m1]))
r = c.get("/risks/", headers=hdr(admin), params={"include_archived": "true"})
check("include_archived brings them back", ids(r) == sorted([e1, e2, m1, o1, o2, o3]))
r = c.get("/risks/", headers=hdr(admin), params={"project_id": old.project_id, "include_archived": "true"})
check("an archived project's own page can still list its risks", ids(r) == sorted([o1, o2, o3]))

print("\n--- ONLY PROJECTS YOU ARE ON ---")
check("a pm sees only the live project they lead", ids(c.get("/risks/", headers=hdr(pm))) == sorted([e1, e2]))
check("a team member sees the project they own an activity on",
      ids(c.get("/risks/", headers=hdr(team))) == [m1])
check("someone on no project sees no risks", c.get("/risks/", headers=hdr(outsider)).json() == [])
r = c.get("/risks/", headers=hdr(pm), params={"project_id": mth.project_id})
check("asking for another project's risks is a 404", r.status_code == 404)
r = c.get("/risks/", headers=hdr(admin), params={"project_id": erp.project_id})
check("project_id filter", ids(r) == sorted([e1, e2]))

print("\n--- WRITING ---")
r = c.post("/risks/", headers=hdr(pm), json={"project_id": erp.project_id, "description": "Vendor slips", "impact": "H"})
check(f"logging a risk works (201, got {r.status_code})", r.status_code == 201)
check("it records who logged it", r.status_code == 201 and r.json()["recorded_by"] == pm.user_id)
r = c.post("/risks/", headers=hdr(pm), json={"project_id": mth.project_id, "description": "x"})
check("cannot log a risk on a project you are not on (404)", r.status_code == 404)
r = c.post("/risks/", headers=hdr(admin), json={"project_id": old.project_id, "description": "x"})
check("cannot log a risk on an archived project (409)", r.status_code == 409)
r = c.put(f"/risks/{m1}", headers=hdr(pm), json={"project_id": mth.project_id, "status": "Closed"})
check("cannot edit another project's risk (404)", r.status_code == 404)
r = c.put(f"/risks/{e1}", headers=hdr(pm), json={"project_id": erp.project_id, "status": "Closed"})
check("can edit a risk on your own project", r.status_code == 200 and r.json()["status"] == "Closed")
r = c.put(f"/risks/{e2}", headers=hdr(pm), json={"project_id": mth.project_id})
check("cannot move a risk onto a project you are not on (404)", r.status_code == 404)
r = c.post(f"/risks/{m1}/proof/", headers=hdr(pm), files={"file": ("proof.txt", b"x", "text/plain")})
check("cannot upload proof against another project's risk (404)", r.status_code == 404)

print(f"\n{passed} passed, {failed} failed")
db.close()
os.unlink(_db)
sys.exit(1 if failed else 0)
