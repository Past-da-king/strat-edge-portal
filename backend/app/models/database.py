from sqlalchemy import create_engine, Column, Integer, String, Float, Date, ForeignKey, Text, DateTime, func, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from ..core.config import settings

# Since we are using an existing database, we'll avoid automatically creating tables
# to ensure we don't accidentally overwrite or change the schema.
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

# Render idles the service and the database drops idle connections with it, so the
# first request after a quiet spell was landing on a dead connection and 500ing.
# pool_pre_ping checks a connection before handing it out and reconnects if it is
# stale; pool_recycle retires them before the server does it for us.
engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=300,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    full_name = Column(String)
    password_hash = Column(String)
    role = Column(String, default="team") # admin, pm, team, executive
    status = Column(String, default="approved")

    # --- Strat Edge ID (single sign-on) ---
    email = Column(String, index=True)          # how ID matches a person to this row
    identity_id = Column(String, index=True)    # their id in Strat Edge ID

    # --- Two-factor authentication (TOTP) ---
    # Only used by the local username/password fallback; people who arrive
    # through ID have already cleared a second factor there.
    mfa_secret = Column(String)                 # base32 seed, set at enrolment
    mfa_enabled = Column(Integer, default=0)    # 1 once the first code is verified
    mfa_confirmed_at = Column(DateTime)

    
    projects_managed = relationship("Project", back_populates="pm", foreign_keys="Project.pm_user_id")
    tasks_assigned = relationship("Task", back_populates="responsible")

class Project(Base):
    __tablename__ = "projects"

    project_id = Column(Integer, primary_key=True, index=True)
    project_name = Column(String, nullable=False)
    project_number = Column(String, unique=True, index=True)
    client = Column(String)
    pm_user_id = Column(Integer, ForeignKey("users.user_id"))
    total_budget = Column(Float, default=0.0)
    start_date = Column(Date)
    target_end_date = Column(Date)
    status = Column(String, default="active")
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.user_id"))

    # --- Archive (a soft close: the project keeps all its data, it just leaves
    # the working portfolio). archived_at is the single source of truth. ---
    archived_at = Column(DateTime)
    archived_by = Column(Integer, ForeignKey("users.user_id"))

    @property
    def is_archived(self) -> bool:
        return self.archived_at is not None

    pm = relationship("User", back_populates="projects_managed", foreign_keys=[pm_user_id])
    creator = relationship("User", foreign_keys=[created_by])
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")

class ProjectAssignment(Base):
    __tablename__ = "project_assignments"

    assignment_id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.project_id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    assigned_role = Column(String) # pm, team, etc.
    assigned_by = Column(Integer, ForeignKey("users.user_id"))
    assigned_at = Column(DateTime, server_default=func.now())

    project = relationship("Project")
    user = relationship("User", foreign_keys=[user_id])

class RepositoryFile(Base):
    __tablename__ = "repository_files"

    file_id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.project_id"), nullable=False)
    parent_id = Column(Integer, ForeignKey("repository_files.file_id"), nullable=True)
    name = Column(String, nullable=False)
    is_folder = Column(Integer, default=0) # 0 for file, 1 for folder
    file_path = Column(String) # GCS Path
    uploaded_by = Column(Integer, ForeignKey("users.user_id"))
    created_at = Column(DateTime, server_default=func.now())

    uploader = relationship("User")

class RepositoryLink(Base):
    __tablename__ = "repository_links"

    link_id = Column(Integer, primary_key=True, index=True)
    source_type = Column(String, nullable=False) # 'R' repo, 'A' activity, 'K' risk
    source_id = Column(Integer, nullable=False)
    target_type = Column(String, nullable=False)
    target_id = Column(Integer, nullable=False)
    created_by = Column(Integer, ForeignKey("users.user_id"))
    created_at = Column(DateTime, server_default=func.now())

class Task(Base):
    __tablename__ = "baseline_schedule"

    activity_id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.project_id"))
    activity_name = Column(String, nullable=False)
    status = Column(String, default="Not Started")  # Not Started, Active, Complete
    planned_start = Column(Date)
    planned_finish = Column(Date)
    budgeted_cost = Column(Float, default=0.0)
    responsible_user_id = Column(Integer, ForeignKey("users.user_id"))
    expected_output = Column(Text)
    depends_on = Column(Integer)
    sort_order = Column(Integer)

    # --- Planning attributes (drop-downs on the activity plan) ---
    complexity = Column(String, default="Medium")       # Low | Medium | High | Very High
    input_type = Column(String, default="Manual")       # Manual | Hybrid | Automated | External
    financial_input = Column(String, default="No")      # Yes | No

    # --- Carried over from the written project plan so an imported plan keeps
    # every column it had on paper. Free text: the plans use their own wording. ---
    kpi = Column(Text)                                  # Key Performance Indicator
    critical_path = Column(String)                      # Y | N (and the plans' own notes)
    financial_input_type = Column(String)               # what the money is for
    implementing_agent = Column(String)                 # how the work gets done, plan's wording
    responsible_names = Column(String)                  # the plan's own "Person Responsible"
                                                        # cell, kept verbatim because it often
                                                        # names several people and their part
    plan_seq = Column(Integer)                          # the "#" the activity has on paper

    @property
    def rating_score(self) -> float:
        """1.0 - 5.0, derived from the drop-downs above plus the planned duration."""
        from ..core.rating import compute_rating
        score, _ = compute_rating(
            self.complexity, self.input_type, self.financial_input,
            self.planned_start, self.planned_finish
        )
        return score

    @property
    def rating_band(self) -> str:
        from ..core.rating import band_for
        return band_for(self.rating_score)

    
    project = relationship("Project", back_populates="tasks")
    responsible = relationship("User", back_populates="tasks_assigned")
    outputs = relationship("TaskOutput", back_populates="task")
    status_feedback = relationship("StatusFeedback", back_populates="activity",
                               cascade="all, delete-orphan",
                               order_by="StatusFeedback.week_start")

class TaskOutput(Base):
    __tablename__ = "task_outputs"

    output_id = Column(Integer, primary_key=True, index=True)
    activity_id = Column(Integer, ForeignKey("baseline_schedule.activity_id"))
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False) # GCS Path
    uploaded_by = Column(Integer, ForeignKey("users.user_id"))
    uploaded_at = Column(DateTime, server_default=func.now())
    doc_type = Column(String, default="Draft")

    task = relationship("Task", back_populates="outputs")

class StatusFeedback(Base):
    """One person's write-up of ONE activity for ONE week.

    The baseline schedule says what was PLANNED. This says what actually
    happened, in the words of the person doing it, while it is still happening -
    so a stalled activity is visible in the week it stalls rather than at the
    end of the project. Weeks are identified by their Monday (week_start), so
    two people logging "this week" always land on the same week.
    """

    __tablename__ = "status_feedback"
    __table_args__ = (UniqueConstraint("activity_id", "week_start", name="uq_status_feedback_activity_week"),)

    log_id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.project_id"), nullable=False, index=True)
    activity_id = Column(Integer, ForeignKey("baseline_schedule.activity_id"), nullable=False, index=True)
    week_start = Column(Date, nullable=False, index=True)   # always a Monday

    work_done = Column(Text)          # what was actually done this week
    blockers = Column(Text)           # what stopped it, if anything
    next_steps = Column(Text)         # what happens next week
    progress_status = Column(String, default="On Track")   # see PROGRESS_STATUSES
    percent_complete = Column(Integer, default=0)

    logged_by = Column(Integer, ForeignKey("users.user_id"))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    activity = relationship("Task", back_populates="status_feedback")
    project = relationship("Project")
    author = relationship("User", foreign_keys=[logged_by])


# The only answers status feedback accepts. "Not Worked On" is deliberately one
# of them: a week where nothing happened is the most important week to record.
PROGRESS_STATUSES = ["On Track", "Delayed", "Blocked", "Not Worked On", "Completed"]


class Expenditure(Base):
    __tablename__ = "expenditure_log"

    exp_id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.project_id"))
    activity_id = Column(Integer, ForeignKey("baseline_schedule.activity_id"), nullable=True)
    category = Column(String, nullable=False)
    description = Column(String)
    reference_id = Column(String)
    amount = Column(Float, default=0.0)
    spend_date = Column(Date)
    recorded_by = Column(Integer, ForeignKey("users.user_id"))
    recorded_at = Column(DateTime, server_default=func.now())
    approved_by = Column(Integer, ForeignKey("users.user_id"))
    approved_at = Column(DateTime)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    audit_log_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    event_type = Column(String, nullable=False)
    category = Column(String, nullable=False)
    description = Column(String, nullable=False)
    ip_address = Column(String)
    session_fingerprint = Column(String)
    event_metadata = Column("metadata", Text) # JSON string
    execution_time_ms = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())

class Risk(Base):
    __tablename__ = "risks"

    risk_id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.project_id"), nullable=False)
    activity_id = Column(Integer, ForeignKey("baseline_schedule.activity_id"), nullable=True)
    description = Column(String, nullable=False)
    impact = Column(String) # H, M, L
    status = Column(String, default="Open")
    mitigation_action = Column(Text)
    date_identified = Column(Date)
    recorded_by = Column(Integer, ForeignKey("users.user_id"))
    recorded_at = Column(DateTime, server_default=func.now())
    closure_file_path = Column(Text)
    
    proofs = relationship("RiskProof", back_populates="risk", cascade="all, delete-orphan")

class RiskProof(Base):
    __tablename__ = "risk_proofs"

    proof_id = Column(Integer, primary_key=True, index=True)
    risk_id = Column(Integer, ForeignKey("risks.risk_id"), nullable=False)
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.user_id"))
    uploaded_at = Column(DateTime, server_default=func.now())

    risk = relationship("Risk", back_populates="proofs")
    uploader = relationship("User")

# Columns added after the original schema shipped. Adding them here (rather than
# in a migration tool) keeps an already-populated SQLite or Postgres database in
# step on deploy - the check is idempotent and safe to run on every boot.
LATER_COLUMNS = {
    "baseline_schedule": {
        "complexity": ("VARCHAR", "Medium"),
        "input_type": ("VARCHAR", "Manual"),
        "financial_input": ("VARCHAR", "No"),
        "kpi": ("TEXT", None),
        "critical_path": ("VARCHAR", None),
        "financial_input_type": ("VARCHAR", None),
        "implementing_agent": ("VARCHAR", None),
        "responsible_names": ("VARCHAR", None),
        "plan_seq": ("INTEGER", None),
    },
    "users": {
        "email": ("VARCHAR", None),
        "identity_id": ("VARCHAR", None),
        "mfa_secret": ("VARCHAR", None),
        "mfa_enabled": ("INTEGER", 0),
        "mfa_confirmed_at": ("TIMESTAMP", None),
    },
    "projects": {
        "archived_at": ("TIMESTAMP", None),
        "archived_by": ("INTEGER", None),
    },
}


# Tables introduced after the original schema shipped. create_all only touches
# what is missing, so this is safe to run against a populated database.
LATER_TABLES = ["status_feedback"]


def ensure_schema():
    """Bring an already-existing database up to the model: new tables, new columns."""
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    missing = [Base.metadata.tables[t] for t in LATER_TABLES
               if t not in tables and t in Base.metadata.tables]
    if missing:
        Base.metadata.create_all(bind=engine, tables=missing)
        for t in missing:
            print(f"[schema] created table {t.name}")
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())

    with engine.begin() as conn:
        for table, columns in LATER_COLUMNS.items():
            if table not in tables:
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, (col_type, default) in columns.items():
                if name in existing:
                    continue
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {col_type}"))
                if default is not None:
                    conn.execute(
                        text(f"UPDATE {table} SET {name} = :val WHERE {name} IS NULL"),
                        {"val": default},
                    )
                print(f"[schema] added {table}.{name}" + (f" (backfilled '{default}')" if default is not None else ""))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
