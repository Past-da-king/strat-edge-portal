from pydantic import BaseModel, ConfigDict, field_validator
from datetime import date, datetime
from typing import Optional, List

from ..models.database import PROGRESS_STATUSES


class StatusFeedbackBase(BaseModel):
    work_done: Optional[str] = None
    blockers: Optional[str] = None
    next_steps: Optional[str] = None
    progress_status: str = "On Track"
    percent_complete: int = 0

    @field_validator("progress_status")
    @classmethod
    def known_status(cls, v: str) -> str:
        if v not in PROGRESS_STATUSES:
            raise ValueError(f"progress_status must be one of {PROGRESS_STATUSES}")
        return v

    @field_validator("percent_complete")
    @classmethod
    def in_range(cls, v: int) -> int:
        if not 0 <= v <= 100:
            raise ValueError("percent_complete must be between 0 and 100")
        return v


class StatusFeedbackWrite(StatusFeedbackBase):
    """One submission. week_start is snapped to its Monday on the way in, so a
    client that sends any day of the week still lands on the right log."""
    activity_id: int
    week_start: date


class StatusFeedbackAuthor(BaseModel):
    user_id: int
    full_name: Optional[str] = None
    username: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class StatusFeedback(StatusFeedbackBase):
    log_id: int
    project_id: int
    activity_id: int
    week_start: date
    logged_by: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    author: Optional[StatusFeedbackAuthor] = None

    model_config = ConfigDict(from_attributes=True)


class ActivityWeek(BaseModel):
    """An activity that is live in a given week, and the log for it if one exists."""
    activity_id: int
    activity_name: str
    project_id: int
    project_name: str
    project_number: Optional[str] = None
    status: Optional[str] = None
    planned_start: Optional[date] = None
    planned_finish: Optional[date] = None
    responsible_user_id: Optional[int] = None
    responsible_name: Optional[str] = None   # portal account, or the plan's own wording
    has_account: bool = True                 # False when the plan names someone with no login
    expected_output: Optional[str] = None
    kpi: Optional[str] = None
    log: Optional[StatusFeedback] = None


class WeekBoard(BaseModel):
    week_start: date
    week_end: date
    due: int          # activities live this week
    logged: int       # of those, how many have been written up
    activities: List[ActivityWeek] = []
