from pydantic import BaseModel
from typing import Optional

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    role: str
    full_name: str
    username: str

class LoginChallenge(BaseModel):
    """Returned by /auth/login/ - the password was right, 2FA is still owed."""
    mfa_required: bool = True
    mfa_enrolled: bool
    challenge_token: str
    full_name: Optional[str] = None
    username: Optional[str] = None


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    scope: Optional[str] = None
    mfa: Optional[bool] = None
