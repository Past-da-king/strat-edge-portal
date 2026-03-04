from pydantic import BaseModel
from typing import Optional

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    role: str
    full_name: str
    username: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None
