from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional

class AuditLogBase(BaseModel):
    event_type: str
    category: str
    description: str
    ip_address: Optional[str] = None
    session_fingerprint: Optional[str] = None
    event_metadata: Optional[str] = None # Field name in model is event_metadata (mapped from 'metadata')
    execution_time_ms: Optional[int] = None

class AuditLog(AuditLogBase):
    audit_log_id: int
    user_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
