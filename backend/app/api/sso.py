"""
Signing in through Strat Edge ID.

The portal keeps its own users table — every activity, project and expenditure
has a foreign key into it — but it stops being the thing that decides WHO you
are. ID does that, and hands back the person plus the role they hold here.

The flow, from the browser's side:

  /auth/sso/start/     -> where to send them (ID's authorize URL, PKCE included)
  ...ID does password + two-factor...
  /auth/sso/callback/  -> swap the one-time code for a portal session

The portal's own username/password login still exists behind it as a way in if
ID is ever down, but nobody needs to use it.
"""

import base64
import hashlib
import os
import secrets
from datetime import datetime
from typing import Any

import requests
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..core import security
from ..models.database import get_db, User
from .deps import get_db as _get_db  # noqa: F401  (kept for symmetry with the other routers)

router = APIRouter()

ID_BASE_URL = os.getenv("SSO_ID_BASE_URL", "https://id.strategyedge.co.za")
APP_KEY = os.getenv("SSO_APP_KEY", "portal")
CLIENT_SECRET = os.getenv("SSO_CLIENT_SECRET")
REDIRECT_URI = os.getenv("SSO_REDIRECT_URI", "https://portal.strategyedge.co.za/auth/callback")

# ID's roles for this app are the portal's own four, so they map straight across.
KNOWN_ROLES = {"admin", "pm", "team", "executive"}


def _challenge(verifier: str) -> str:
    return base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()


@router.get("/config/")
def sso_config() -> Any:
    """
    Whether single sign-on is switched on, where to send people, and whether
    this portal is still allowed to show its own password form.

    That last one is Strat Edge ID's decision, resolved through the fallback
    chain in core/sso_policy.py so an ID outage can never hide the only way in.
    """
    from ..core import sso_policy

    resolved = sso_policy.policy()
    return {
        "enabled": bool(CLIENT_SECRET),
        "id_base_url": ID_BASE_URL,
        "local_sign_in_allowed": resolved["local_sign_in_allowed"],
        "policy_source": resolved["source"],
    }


@router.get("/start/")
def sso_start() -> Any:
    """
    Hand the browser a ready-made authorize URL plus the verifier it must keep.
    The verifier never leaves the browser until the exchange, which is what stops
    a stolen code from being worth anything.
    """
    if not CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Single sign-on is not configured")

    verifier = secrets.token_urlsafe(48)
    state = secrets.token_urlsafe(16)
    url = (
        f"{ID_BASE_URL}/oidc/authorize"
        f"?app={APP_KEY}"
        f"&redirect_uri={requests.utils.quote(REDIRECT_URI, safe='')}"
        f"&code_challenge={_challenge(verifier)}"
        f"&code_challenge_method=S256"
        f"&state={state}"
    )
    return {"authorize_url": url, "code_verifier": verifier, "state": state}


@router.post("/callback/")
def sso_callback(payload: dict, db: Session = Depends(get_db)) -> Any:
    """
    Swap the one-time code for a portal session.

    ID has already checked the password AND the second factor, so the token this
    mints carries mfa=true — asking again here would be theatre.
    """
    if not CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Single sign-on is not configured")

    code = payload.get("code")
    verifier = payload.get("code_verifier")
    if not code or not verifier:
        raise HTTPException(status_code=400, detail="Missing code or verifier")

    try:
        res = requests.post(
            f"{ID_BASE_URL}/oidc/token",
            json={
                "app": APP_KEY,
                "client_secret": CLIENT_SECRET,
                "code": code,
                "code_verifier": verifier,
            },
            timeout=20,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach Strat Edge ID: {exc}")

    if res.status_code != 200:
        detail = res.json().get("error", "Sign-in failed") if res.content else "Sign-in failed"
        raise HTTPException(status_code=401, detail=detail)

    data = res.json()
    identity = data.get("identity") or {}
    email = (identity.get("email") or "").lower()
    role = data.get("role") or "team"
    if not email:
        raise HTTPException(status_code=502, detail="Strat Edge ID returned no email")

    user = _find_or_create(db, identity_id=identity.get("id"), email=email,
                           full_name=identity.get("fullName"), role=role)

    from ..core.audit import log_event
    log_event(
        db,
        event_type="LOGIN",
        category="AUTH",
        description=f"Signed in through Strat Edge ID: {email}",
        user_id=user.user_id,
        metadata={"role": role},
    )

    return {
        "access_token": security.create_session_token(user.user_id),
        "token_type": "bearer",
        "user_id": user.user_id,
        "role": user.role,
        "full_name": user.full_name,
        "username": user.username,
    }


def _find_or_create(db: Session, identity_id: str, email: str, full_name: str, role: str) -> User:
    """
    Match an existing portal account before making a new one — people already
    have work attached to their user row and it must not be orphaned.

    Order: the ID we stored last time, then the email, then a legacy account
    whose username IS the email. Only then create.
    """
    user = None
    if identity_id:
        user = db.query(User).filter(User.identity_id == identity_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
    if not user:
        user = db.query(User).filter(User.username == email).first()

    if not user:
        user = User(
            username=email,
            full_name=full_name or email,
            email=email,
            role=role if role in KNOWN_ROLES else "team",
            status="approved",
            password_hash=None,          # this account has no local password, by design
            mfa_enabled=1,               # ID owns the second factor
            mfa_confirmed_at=datetime.utcnow(),
        )
        db.add(user)
    else:
        user.email = email
        if full_name:
            user.full_name = full_name
        # ID is the authority on what someone may do here.
        if role in KNOWN_ROLES:
            user.role = role
        user.status = "approved"
        user.mfa_enabled = 1

    user.identity_id = identity_id
    db.commit()
    db.refresh(user)
    return user
