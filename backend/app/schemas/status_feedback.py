from pydantic import BaseModel, ConfigDict, field_validator
from datetime import date, datetime
from typing import Optional, List, Dict

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


# ---------------------------------------------------------------- oversight report

class ReportEntry(BaseModel):
    """One log, flattened with the names an executive reads it by."""
    log_id: int
    week_start: date
    week_end: date
    project_id: int
    project_name: str
    project_number: Optional[str] = None
    project_archived: bool = False
    activity_id: int
    activity_name: str
    activity_status: Optional[str] = None
    responsible_user_id: Optional[int] = None
    responsible_name: Optional[str] = None
    logged_by: Optional[int] = None
    author_name: str
    author_role: Optional[str] = None
    progress_status: str
    percent_complete: int = 0
    work_done: Optional[str] = None
    blockers: Optional[str] = None
    next_steps: Optional[str] = None
    updated_at: Optional[datetime] = None
    days_ago: Optional[int] = None


class ReportPerson(BaseModel):
    user_id: Optional[int] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    entries: int
    blocked: int
    projects: int
    last_update_at: Optional[datetime] = None
    last_week_start: Optional[date] = None
    days_ago: Optional[int] = None


class ReportProject(BaseModel):
    project_id: int
    project_name: str
    project_number: Optional[str] = None
    archived: bool = False
    entries: int
    blocked: int
    people: int
    last_update_at: Optional[datetime] = None
    days_ago: Optional[int] = None


class ReportQuiet(BaseModel):
    user_id: int
    full_name: str
    role: Optional[str] = None
    open_activities: int
    last_update_at: Optional[datetime] = None
    days_quiet: Optional[int] = None      # None = has never logged


class ReportLatest(BaseModel):
    log_id: int
    updated_at: Optional[datetime] = None
    days_ago: Optional[int] = None
    author_name: str
    project_name: str
    activity_name: str
    progress_status: str


class ReportSummary(BaseModel):
    total: int
    people_reporting: int
    projects_reporting: int
    blocked: int
    delayed: int
    not_worked_on: int
    by_status: Dict[str, int]
    latest: Optional[ReportLatest] = None
    people: List[ReportPerson] = []
    projects: List[ReportProject] = []
    quiet: List[ReportQuiet] = []


class ReportFilterEcho(BaseModel):
    project_id: Optional[int] = None
    person_id: Optional[int] = None
    progress_status: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None


class ReportOptionProject(BaseModel):
    project_id: int
    project_name: str
    project_number: Optional[str] = None
    archived: bool = False


class ReportOptionPerson(BaseModel):
    user_id: int
    full_name: str
    role: Optional[str] = None


class ReportOptions(BaseModel):
    projects: List[ReportOptionProject] = []
    people: List[ReportOptionPerson] = []
    statuses: List[str] = []


class StatusFeedbackReport(BaseModel):
    generated_at: datetime
    filters: ReportFilterEcho
    quiet_after_days: int
    summary: ReportSummary
    entries: List[ReportEntry] = []
    options: ReportOptions
