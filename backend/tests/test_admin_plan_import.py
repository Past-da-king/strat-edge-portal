"""Proves the admin plan-import endpoint runs the same importer as the CLI."""
import os, secrets, tempfile, sys
_fd, _db = tempfile.mkstemp(suffix=".db"); os.close(_fd)
os.environ["DATABASE_URL"] = f"sqlite:///{_db}"
os.environ["SECRET_KEY"] = secrets.token_urlsafe(32)

from fastapi import FastAPI
from fastapi.testclient import TestClient
from jose import jwt
from app.models.database import Base, engine, SessionLocal, User, Project, Task, ensure_schema
from app.core.security import get_password_hash, ALGORITHM
from app.api import admin

Base.metadata.create_all(bind=engine); ensure_schema()
db = SessionLocal()
boss = User(username="boss", full_name="Sinqobile Shoba", role="admin", status="approved",
            mfa_enabled=1, password_hash=get_password_hash(secrets.token_urlsafe(16)))
team = User(username="t", full_name="Siphelele Mofokeng", role="team", status="approved",
            mfa_enabled=1, password_hash=get_password_hash(secrets.token_urlsafe(16)))
db.add_all([boss, team]); db.commit(); db.refresh(boss); db.refresh(team)

app = FastAPI(); app.include_router(admin.router, prefix="/admin")
c = TestClient(app)
h = {"Authorization": "Bearer " + jwt.encode({"sub": str(boss.user_id), "mfa": True},
     os.environ["SECRET_KEY"], algorithm=ALGORITHM)}
ht = {"Authorization": "Bearer " + jwt.encode({"sub": str(team.user_id), "mfa": True},
      os.environ["SECRET_KEY"], algorithm=ALGORITHM)}

ok = bad = 0
def check(label, cond):
    global ok, bad
    print(("  PASS  " if cond else "  FAIL  ") + label)
    ok, bad = ok + bool(cond), bad + (not cond)

r = c.get("/admin/plans/", headers=h)
check("admin can list the bundled plans", r.status_code == 200 and len(r.json()["plans"]) == 2)
check("counts are right", sorted(p["activities"] for p in r.json()["plans"]) == [25, 27])
check("a non-admin cannot", c.get("/admin/plans/", headers=ht).status_code == 403)

r = c.post("/admin/plans/import/", headers=h, json={"plan": "erp", "commit": False})
check("dry run returns 200", r.status_code == 200)
check("dry run writes nothing", db.query(Project).count() == 0)
check("dry run names who has no account",
      any("Ayanda Phaketsi" == u["name"] for u in r.json()["unassigned"]))

r = c.post("/admin/plans/import/", headers=h, json={"plan": "erp", "commit": True})
check("commit returns 200", r.status_code == 200 and r.json()["committed"])
db.expire_all()
check("project created", db.query(Project).filter(Project.project_number == "SE-ERP-2026").count() == 1)
check("25 activities", db.query(Task).count() == 25)

r = c.post("/admin/plans/import/", headers=h, json={"plan": "erp", "commit": True})
db.expire_all()
check("re-import duplicates nothing", db.query(Task).count() == 25 and r.json()["created"] == 0)
check("unknown plan is a 404",
      c.post("/admin/plans/import/", headers=h, json={"plan": "nope", "commit": False}).status_code == 404)
check("a non-admin cannot import",
      c.post("/admin/plans/import/", headers=ht, json={"plan": "erp", "commit": True}).status_code == 403)

print(f"\n{ok} passed, {bad} failed")
db.close(); os.unlink(_db); sys.exit(1 if bad else 0)
