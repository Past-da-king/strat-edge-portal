from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from typing import Optional, List
from .user import User

class TaskBase(BaseModel):
    activity_name: str
    status: str = "Not Started"
    planned_start: Optional[date] = None
    planned_finish: Optional[date] = None
    budgeted_cost: float = 0.0
    responsible_user_id: Optional[int] = None
    expected_output: Optional[str] = None
    depends_on: Optional[int] = None
    complexity: Optional[str] = "Medium"
    input_type: Optional[str] = "Manual"
    financial_input: Optional[str] = "No"
    # Carried over from the written project plan.
    kpi: Optional[str] = None
    critical_path: Optional[str] = None
    financial_input_type: Optional[str] = None
    implementing_agent: Optional[str] = None
    responsible_names: Optional[str] = None
    plan_seq: Optional[int] = None

class TaskCreate(TaskBase):
    project_id: int

class TaskUpdate(TaskBase):
    activity_name: Optional[str] = None
    project_id: Optional[int] = None

class TaskOutputBase(BaseModel):
    file_name: str
    file_path: str
    uploaded_by: Optional[int] = None
    doc_type: str = "Draft"

class TaskOutput(TaskOutputBase):
    output_id: int
    activity_id: int
    uploaded_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class Task(TaskBase):
    activity_id: int
    project_id: int
    outputs: List[TaskOutput] = []
    responsible: Optional[User] = None
    # Derived on the model from the drop-downs + planned duration; read-only.
    rating_score: float = 1.0
    rating_band: str = "Low"

    model_config = ConfigDict(from_attributes=True)
