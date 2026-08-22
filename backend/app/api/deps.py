from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from pydantic import ValidationError
from sqlalchemy.orm import Session

from ..core import security
from ..core.config import settings
from ..models import database as models
from ..schemas.token import TokenPayload

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"/auth/login"
)

def get_db() -> Generator:
    try:
        db = models.SessionLocal()
        yield db
    finally:
        db.close()

def _decode(token: str) -> TokenPayload:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        return TokenPayload(**payload)
    except (jwt.JWTError, ValidationError) as e:
        print(f"DEBUG: Token validation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )


def _load_active_user(db: Session, token_data: TokenPayload) -> models.User:
    user = db.query(models.User).filter(models.User.user_id == int(token_data.sub)).first()
    if not user:
        print(f"DEBUG: User ID {token_data.sub} not found in DB")
        raise HTTPException(status_code=404, detail="User not found")
    if user.status != "approved" and user.status != "active":
        print(f"DEBUG: User ID {token_data.sub} has inactive status: {user.status}")
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(reusable_oauth2)
) -> models.User:
    """Full-access guard: only a token minted AFTER a verified 2FA code gets in."""
    token_data = _decode(token)

    # A half-finished login (password accepted, code not yet given) opens nothing.
    if token_data.scope == security.SCOPE_MFA_CHALLENGE:
        raise HTTPException(status_code=401, detail="MFA_CHALLENGE_TOKEN")

    # Tokens minted before 2FA became compulsory carry no mfa claim - kill them
    # now rather than let them run out their remaining days.
    if not token_data.mfa:
        raise HTTPException(status_code=401, detail="MFA_REQUIRED")

    user = _load_active_user(db, token_data)

    # Re-checked on every request, so an admin resetting someone's authenticator
    # drops that person's live session immediately.
    if not user.mfa_enabled:
        raise HTTPException(status_code=401, detail="MFA_ENROLMENT_REQUIRED")

    print(f"DEBUG: User authenticated: {user.username} (Role: {user.role})")
    return user


def get_mfa_challenge_user(
    db: Session = Depends(get_db), token: str = Depends(reusable_oauth2)
) -> models.User:
    """Guard for the enrolment/verify endpoints - accepts ONLY a challenge token."""
    token_data = _decode(token)
    if token_data.scope != security.SCOPE_MFA_CHALLENGE:
        raise HTTPException(status_code=401, detail="MFA challenge token required")
    return _load_active_user(db, token_data)

def get_current_active_admin(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    if current_user.role not in ["admin", "executive"]:
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user
