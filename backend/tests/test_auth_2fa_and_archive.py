"""
End-to-end proof of the two features, against the real routers over HTTP.

Run:  cd backend && PYTHONPATH=. .venv/bin/python tests/test_auth_2fa_and_archive.py
"""

import os, secrets, tempfile, datetime

# Everything below is generated per run and thrown away with the temp database.
# Nothing here is a real credential - keep it that way so secret scanners on this
# public repo stay quiet and a genuine leak is never lost in the noise.
TEST_USERNAME = "test-user"
TEST_PASSWORD = secrets.token_urlsafe(24)

_fd, _db = tempfile.mkstemp(suffix=".db"); os.close(_fd)
os.environ["DATABASE_URL"] = f"sqlite:///{_db}"
os.environ["SECRET_KEY"] = secrets.token_urlsafe(32)

import pyotp
from fastapi import FastAPI
from fastapi.testclient import TestClient
from jose import jwt

from app.models.database import Base, engine, SessionLocal, User, Project, ensure_schema
from app.core.security import get_password_hash, ALGORITHM
from app.api import auth, projects

Base.metadata.create_all(bind=engine)
ensure_schema()

db = SessionLocal()
db.add(User(username=TEST_USERNAME, full_name="Test Admin", role="admin", status="approved",
            password_hash=get_password_hash(TEST_PASSWORD)))
db.commit()

app = FastAPI()
app.include_router(auth.router, prefix="/auth")
app.include_router(projects.router, prefix="/projects")
c = TestClient(app)

def check(label, cond):
    print(("  PASS  " if cond else "  FAIL  ") + label)
    assert cond, label

print("\n--- 2FA ---")
r = c.post("/auth/login/", data={"username": TEST_USERNAME, "password": "not-the-password"})
check("wrong password rejected", r.status_code == 400)

r = c.post("/auth/login/", data={"username": TEST_USERNAME, "password": TEST_PASSWORD})
body = r.json()
check("password alone returns a challenge, never a session", r.status_code == 200 and "access_token" not in body)
check("challenge says not yet enrolled", body["mfa_required"] is True and body["mfa_enrolled"] is False)
challenge = body["challenge_token"]

r = c.get("/projects/", headers={"Authorization": f"Bearer {challenge}"})
check("challenge token opens nothing (401)", r.status_code == 401)

r = c.get("/projects/")
check("anonymous is refused", r.status_code in (401, 403))

r = c.post("/auth/mfa/setup/", json={}, headers={"Authorization": f"Bearer {challenge}"})
setup = r.json()
secret = setup["secret"]
check("setup returns a secret and a QR image", bool(secret) and setup["qr_data_uri"].startswith("data:image/png;base64,"))

r = c.post("/auth/mfa/verify/", json={"code": "000000"}, headers={"Authorization": f"Bearer {challenge}"})
check("wrong code rejected", r.status_code == 400)

r = c.post("/auth/mfa/verify/", json={"code": pyotp.TOTP(secret).now()},
           headers={"Authorization": f"Bearer {challenge}"})
check("correct code mints a session token", r.status_code == 200 and "access_token" in r.json())
token = r.json()["access_token"]
H = {"Authorization": f"Bearer {token}"}

r = c.get("/projects/", headers=H)
check("session token works", r.status_code == 200)

legacy = jwt.encode({"sub": "1", "exp": datetime.datetime.utcnow() + datetime.timedelta(days=1)},
                    os.environ["SECRET_KEY"], algorithm=ALGORITHM)
r = c.get("/projects/", headers={"Authorization": f"Bearer {legacy}"})
check("pre-2FA token (no mfa claim) is dead", r.status_code == 401)

r = c.post("/auth/login/", data={"username": TEST_USERNAME, "password": TEST_PASSWORD})
check("returning user is flagged as enrolled", r.json()["mfa_enrolled"] is True)
challenge2 = r.json()["challenge_token"]
r = c.post("/auth/mfa/setup/", json={}, headers={"Authorization": f"Bearer {challenge2}"})
check("cannot silently re-enrol an existing authenticator", r.status_code == 400)

print("\n--- ARCHIVE ---")
p1 = c.post("/projects/", headers=H, json={"project_name": "Mthashana Stage 2", "project_number": "MTH-001", "total_budget": 100000}).json()
p2 = c.post("/projects/", headers=H, json={"project_name": "Old Engagement", "project_number": "OLD-001", "total_budget": 50000}).json()
check("two projects created", p1["project_id"] and p2["project_id"])

names = [p["project_name"] for p in c.get("/projects/", headers=H).json()]
check("both listed before archiving", len(names) == 2)

r = c.post(f"/projects/{p2['project_id']}/archive/", headers=H)
check("archive returns the project marked archived", r.status_code == 200 and r.json()["is_archived"] is True)

live = c.get("/projects/", headers=H).json()
check("archived project drops out of the portfolio", [p["project_name"] for p in live] == ["Mthashana Stage 2"])

allp = c.get("/projects/?include_archived=true", headers=H).json()
check("include_archived brings it back", len(allp) == 2)
check("and it is flagged", [p for p in allp if p["project_id"] == p2["project_id"]][0]["is_archived"] is True)

detail = c.get(f"/projects/{p2['project_id']}/", headers=H).json()
check("its data is untouched (still readable)", detail["project_number"] == "OLD-001" and detail["archived_at"] is not None)

r = c.post(f"/projects/{p2['project_id']}/archive/", headers=H)
check("archiving twice is refused", r.status_code == 400)

r = c.post(f"/projects/{p2['project_id']}/restore/", headers=H)
check("restore clears the flag", r.status_code == 200 and r.json()["is_archived"] is False)
check("and it is back in the portfolio", len(c.get("/projects/", headers=H).json()) == 2)

print("\n--- ADMIN 2FA RESET ---")
r = c.post(f"/auth/users/1/mfa/reset/", headers=H)
check("admin can reset an authenticator", r.status_code == 200 and r.json()["mfa_enabled"] == 0)
r = c.get("/projects/", headers=H)
check("the reset kills the live session immediately", r.status_code == 401)

print("\nALL CHECKS PASSED\n")
