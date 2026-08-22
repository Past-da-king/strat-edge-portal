from datetime import datetime, timedelta
from typing import Any, Union, Optional
from jose import jwt
from werkzeug.security import generate_password_hash, check_password_hash
from .config import settings
from sqlalchemy.orm import Session
from ..models import database as models

ALGORITHM = "HS256"

# Two token kinds. A challenge token is what you hold between "password accepted"
# and "6-digit code accepted" - it opens nothing but the 2FA endpoints.
SCOPE_SESSION = "session"
SCOPE_MFA_CHALLENGE = "mfa"
MFA_CHALLENGE_MINUTES = 10


def create_access_token(
    subject: Union[str, Any],
    expires_delta: timedelta = None,
    scope: str = SCOPE_SESSION,
    mfa: bool = True,
) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {"exp": expire, "sub": str(subject), "scope": scope, "mfa": mfa}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_session_token(user_id: Union[str, int]) -> str:
    """The ONLY place a full-access token is minted - it always carries mfa=True."""
    return create_access_token(
        user_id,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        scope=SCOPE_SESSION,
        mfa=True,
    )


def create_mfa_challenge_token(user_id: Union[str, int]) -> str:
    return create_access_token(
        user_id,
        expires_delta=timedelta(minutes=MFA_CHALLENGE_MINUTES),
        scope=SCOPE_MFA_CHALLENGE,
        mfa=False,
    )

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return check_password_hash(hashed_password, plain_password)

def get_password_hash(password: str) -> str:
    return generate_password_hash(password)

def authenticate_user(db: Session, username: str, password: str) -> Optional[models.User]:
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user
