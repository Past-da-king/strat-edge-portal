import os
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta, datetime
from typing import Any, List
from ..core import security
from ..core.config import settings
from ..models import database as models
from ..schemas import token as token_schema
from ..schemas import user as user_schema
from ..core import mfa as mfa_service
from .deps import get_db, get_current_active_admin, get_current_user, get_mfa_challenge_user

router = APIRouter()

def _session_response(user: models.User) -> dict:
    return {
        "access_token": security.create_session_token(user.user_id),
        "token_type": "bearer",
        "user_id": user.user_id,
        "role": user.role,
        "full_name": user.full_name,
        "username": user.username,
    }


@router.post("/login/", response_model=token_schema.LoginChallenge)
def login_access_token(
    db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    Step 1 of 2. A correct password does NOT hand back a session token - it hands
    back a short-lived challenge token. Two-factor is compulsory for everyone, so
    a user who has never enrolled is sent into enrolment instead of being let in.
    """
    # Hiding the form in the browser is not a policy, it is a suggestion. If
    # Strat Edge ID says this application is ID-only, the local route has to
    # refuse — and it still yields to the break-glass flag, because that flag
    # exists precisely for when ID cannot be reached.
    from ..core import sso_policy

    if not sso_policy.local_sign_in_allowed():
        raise HTTPException(
            status_code=403,
            detail="This portal signs in through Strat Edge ID. Use the Strat Edge ID button.",
        )

    user = security.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    elif user.status != "approved" and user.status != "active":
        raise HTTPException(status_code=400, detail="Inactive user")

    return {
        "mfa_required": True,
        "mfa_enrolled": bool(user.mfa_enabled),
        "challenge_token": security.create_mfa_challenge_token(user.user_id),
        "full_name": user.full_name,
        "username": user.username,
    }


@router.post("/mfa/setup/")
def mfa_setup(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_mfa_challenge_user),
) -> Any:
    """
    Step 2a - first time only. Issues a fresh TOTP seed and the QR to scan. The
    seed is stored but 2FA is NOT switched on until a code proves it works, so an
    abandoned enrolment cannot lock anyone out.
    """
    if current_user.mfa_enabled:
        raise HTTPException(
            status_code=400,
            detail="Two-factor is already set up. Ask an administrator to reset it.",
        )

    secret = mfa_service.generate_secret()
    current_user.mfa_secret = secret
    db.add(current_user)
    db.commit()

    uri = mfa_service.provisioning_uri(secret, current_user.username)
    return {
        "secret": secret,          # for manual entry if the QR will not scan
        "otpauth_uri": uri,
        "qr_data_uri": mfa_service.qr_data_uri(uri),
        "issuer": mfa_service.ISSUER,
    }


@router.post("/mfa/verify/", response_model=token_schema.Token)
def mfa_verify(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_mfa_challenge_user),
) -> Any:
    """Step 2b. A verified code is the only thing that mints a session token."""
    code = str(payload.get("code", ""))

    if not mfa_service.verify_code(current_user.mfa_secret, code):
        from ..core.audit import log_event
        log_event(
            db,
            event_type="MFA_FAILED",
            category="AUTH",
            description=f"Failed 2FA code for {current_user.username}",
            user_id=current_user.user_id,
        )
        raise HTTPException(status_code=400, detail="Invalid authentication code")

    first_time = not current_user.mfa_enabled
    if first_time:
        current_user.mfa_enabled = 1
        current_user.mfa_confirmed_at = datetime.utcnow()
        db.add(current_user)
        db.commit()
        db.refresh(current_user)

    from ..core.audit import log_event
    log_event(
        db,
        event_type="MFA_ENROLLED" if first_time else "LOGIN",
        category="AUTH",
        description=(
            f"Enrolled two-factor for {current_user.username}"
            if first_time else f"Signed in: {current_user.username}"
        ),
        user_id=current_user.user_id,
    )
    return _session_response(current_user)


@router.post("/users/{user_id}/mfa/reset/", response_model=user_schema.User)
def reset_user_mfa(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_admin),
) -> Any:
    """
    Admin recovery: clears someone's authenticator so they enrol again on their
    next login. It also drops their live session, because every request re-checks
    mfa_enabled.
    """
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.mfa_secret = None
    user.mfa_enabled = 0
    user.mfa_confirmed_at = None
    db.add(user)
    db.commit()
    db.refresh(user)

    from ..core.audit import log_event
    log_event(
        db,
        event_type="MFA_RESET",
        category="AUTH",
        description=f"Reset two-factor for {user.username}",
        user_id=current_user.user_id,
    )
    return user

# The four access levels this application defines. Strat Edge ID reads this so
# the access-administration dashboard offers the Portal's REAL roles - add one
# here and it appears there on the next sync, with no change to ID itself.
PORTAL_ROLES = [
    {"key": "admin", "label": "Administrator", "description": "Full control of the portal"},
    {"key": "pm", "label": "Project Manager", "description": "Owns projects, plans and budgets"},
    {"key": "team", "label": "Team Member", "description": "Records activity and uploads outputs"},
    {"key": "executive", "label": "Executive", "description": "Oversight across the portfolio"},
]


@router.get("/roles/")
def list_roles(request: Request) -> Any:
    """Machine-readable access levels, for Strat Edge ID. Shared-secret guarded."""
    expected = os.getenv("SSO_SHARED_SECRET")
    if not expected or request.headers.get("X-Strat-Edge-Secret") != expected:
        raise HTTPException(status_code=401, detail="Not authorised")
    return PORTAL_ROLES


@router.get("/users/", response_model=List[user_schema.User])
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_admin)
) -> Any:
    return db.query(models.User).all()

@router.post("/users/", response_model=user_schema.User, status_code=status.HTTP_201_CREATED)
def register_user(
    user_in: user_schema.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_admin)
) -> Any:
    user = db.query(models.User).filter(models.User.username == user_in.username).first()
    if user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    db_user = models.User(
        username=user_in.username,
        full_name=user_in.full_name,
        role=user_in.role,
        status=user_in.status,
        password_hash=security.get_password_hash(user_in.password)
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.put("/users/{user_id}/status/", response_model=user_schema.User)
def update_user_status(
    user_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_admin)
) -> Any:
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if "status" in payload:
        user.status = payload["status"]
    if "role" in payload:
        user.role = payload["role"]
        
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.get("/audit-logs/")
def get_audit_logs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_admin)
):
    from ..models.database import AuditLog
    from sqlalchemy import text
    query = text("""
        SELECT a.*, u.username 
        FROM audit_logs a
        JOIN users u ON a.user_id = u.user_id
        ORDER BY a.created_at DESC
        LIMIT 100
    """)
    results = db.execute(query).fetchall()
    return [dict(r._mapping) for r in results]

@router.put("/users/me/", response_model=user_schema.User)
def update_my_settings(
    payload: user_schema.UserUpdateMe,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
) -> Any:
    # Check if they are trying to change to an existing username
    if payload.username and payload.username != current_user.username:
        user_conflict = db.query(models.User).filter(models.User.username == payload.username).first()
        if user_conflict:
            raise HTTPException(status_code=400, detail="Username already exists")
        current_user.username = payload.username
        
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
        
    if payload.password:
        if not payload.old_password or not security.verify_password(payload.old_password, current_user.password_hash):
            raise HTTPException(status_code=400, detail="Incorrect old password")
        current_user.password_hash = security.get_password_hash(payload.password)
        
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user
