from sqlalchemy import create_engine, Column, Integer, String, Float, Date, ForeignKey, Text, DateTime, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from ..core.config import settings

# Since we are using an existing database, we'll avoid automatically creating tables
# to ensure we don't accidentally overwrite or change the schema.
engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})
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
    
    project = relationship("Project", back_populates="tasks")
    responsible = relationship("User", back_populates="tasks_assigned")
    outputs = relationship("TaskOutput", back_populates="task")

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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
