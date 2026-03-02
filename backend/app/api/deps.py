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

def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(reusable_oauth2)
) -> models.User:
    try:
        print(f"DEBUG: Decoding token: {token[:20]}...")
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
        print(f"DEBUG: Token sub: {token_data.sub}")
    except (jwt.JWTError, ValidationError) as e:
        print(f"DEBUG: Token validation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    user = db.query(models.User).filter(models.User.user_id == int(token_data.sub)).first()
    if not user:
        print(f"DEBUG: User ID {token_data.sub} not found in DB")
        raise HTTPException(status_code=404, detail="User not found")
    if user.status != "approved" and user.status != "active":
        print(f"DEBUG: User ID {token_data.sub} has inactive status: {user.status}")
        raise HTTPException(status_code=400, detail="Inactive user")
    print(f"DEBUG: User authenticated: {user.username} (Role: {user.role})")
    return user

def get_current_active_admin(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user
