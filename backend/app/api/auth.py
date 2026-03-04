from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Any, List
from ..core import security
from ..core.config import settings
from ..models import database as models
from ..schemas import token as token_schema
from ..schemas import user as user_schema
from .deps import get_db, get_current_active_admin

router = APIRouter()

@router.post("/login/", response_model=token_schema.Token)
def login_access_token(
    db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    user = security.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    elif user.status != "approved" and user.status != "active":
        raise HTTPException(status_code=400, detail="Inactive user")
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.user_id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
        "user_id": user.user_id,
        "role": user.role,
        "full_name": user.full_name,
        "username": user.username
    }

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
    
    user.status = payload.get("status", user.status)
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
