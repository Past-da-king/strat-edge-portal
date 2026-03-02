from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from typing import Optional, List
from .user import User
from .task import Task

class ProjectBase(BaseModel):
    project_name: str
    project_number: str
    client: Optional[str] = None
    total_budget: float = 0.0
    start_date: Optional[date] = None
    target_end_date: Optional[date] = None
    status: str = "active"

class ProjectCreate(ProjectBase):
    pm_user_id: Optional[int] = None

class ProjectUpdate(ProjectBase):
    project_name: Optional[str] = None
    project_number: Optional[str] = None
    pm_user_id: Optional[int] = None

class Project(ProjectBase):
    project_id: int
    pm_user_id: Optional[int] = None
    created_at: datetime
    
    pm: Optional[User] = None
    tasks: List[Task] = []

    model_config = ConfigDict(from_attributes=True)
