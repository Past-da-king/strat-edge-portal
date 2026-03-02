from sqlalchemy.orm import Session
from ..models.database import AuditLog
import json
from typing import Any, Dict, Optional

def log_event(
    db: Session,
    event_type: str,
    category: str,
    description: str,
    user_id: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
    execution_time_ms: Optional[int] = None,
    ip_address: Optional[str] = None
):
    """
    Logs an event to the audit_logs table.
    """
    try:
        db_log = AuditLog(
            user_id=user_id,
            event_type=event_type,
            category=category,
            description=description,
            event_metadata=json.dumps(metadata) if metadata else None,
            execution_time_ms=execution_time_ms,
            ip_address=ip_address
        )
        db.add(db_log)
        db.commit()
    except Exception as e:
        print(f"Error logging event: {e}")
        db.rollback()
