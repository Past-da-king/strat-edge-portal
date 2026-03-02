from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from typing import Optional

class ExpenditureBase(BaseModel):
    project_id: int
    activity_id: Optional[int] = None
    category: str
    description: Optional[str] = None
    reference_id: Optional[str] = None
    amount: float = 0.0
    spend_date: Optional[date] = None

class ExpenditureCreate(ExpenditureBase):
    pass

class Expenditure(ExpenditureBase):
    exp_id: int
    recorded_by: Optional[int] = None
    recorded_at: datetime
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
