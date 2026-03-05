from pydantic import BaseModel, ConfigDict, Field
from typing import Optional

class UserBase(BaseModel):
    username: str
    full_name: Optional[str] = None
    role: str = "team"

class UserCreate(UserBase):
    password: str

class UserUpdate(UserBase):
    password: Optional[str] = None

class UserUpdateMe(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    old_password: Optional[str] = None

class User(UserBase):
    user_id: int
    status: str = "approved"

    model_config = ConfigDict(from_attributes=True)
