from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from typing import Optional, List

class RiskBase(BaseModel):
    project_id: int
    activity_id: Optional[int] = None
    description: str
    impact: str = "L"
    status: str = "Open"
    mitigation_action: Optional[str] = None
    date_identified: Optional[date] = None

class RiskCreate(RiskBase):
    pass

class RiskUpdate(RiskBase):
    description: Optional[str] = None

class Risk(RiskBase):
    risk_id: int
    recorded_by: Optional[int] = None
    recorded_at: Optional[datetime] = None
    closure_file_path: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)
