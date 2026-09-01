from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from ..models.database import get_db, Project, User
from ..services.project_service import ProjectService
from ..services.import_service import ImportService
from ..schemas.project import Project as ProjectSchema, ProjectCreate, ProjectUpdate
from .deps import get_current_user, get_current_active_admin
from typing import List, Any
from datetime import datetime

router = APIRouter()


def guard_project_access(db: Session, current_user: User, project_id: int) -> None:
    """
    A project someone is not on must be invisible, not merely unlisted.

    Filtering the portfolio list alone is decoration: the project id is in the
    URL, so anyone could read /projects/5/ or its budget by typing it. This is
    the same membership rule the list uses, applied to one project — and it
    raises 404 rather than 403 on purpose, because "you may not see this" still
    tells you the project exists.
    """
    if not ProjectService.can_see_project(db, current_user, project_id):
        raise HTTPException(status_code=404, detail="Project not found")


@router.post("/import/", response_model=ProjectSchema)
async def import_project(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    content = await file.read()
    return ImportService.import_project_excel(db, content, current_user.user_id)

@router.get("/", response_model=List[Any])
def list_projects(
    include_archived: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    The portfolio, as this person is allowed to see it.

    Administrators and executives get everything — oversight is their job.
    A project manager or a team member gets the projects they lead, are assigned
    to, or own an activity on, and nothing else.
    """
    return ProjectService.get_portfolio_metrics(
        db,
        viewer_id=ProjectService.viewer_id_for(current_user),
        include_archived=include_archived,
    )


@router.post("/{project_id}/archive/", response_model=ProjectSchema)
def archive_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """
    Close a project without destroying it: it drops out of the portfolio and the
    project pickers, keeps every activity, document, risk and expenditure, and
    can be restored at any time. This is the safe alternative to Delete.
    """
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.archived_at:
        raise HTTPException(status_code=400, detail="Project is already archived")

    project.archived_at = datetime.utcnow()
    project.archived_by = current_user.user_id
    db.add(project)
    db.commit()
    db.refresh(project)

    from ..core.audit import log_event
    log_event(
        db,
        event_type="ARCHIVE",
        category="PROJECT",
        description=f"Archived project: {project.project_name} ({project.project_number})",
        user_id=current_user.user_id
    )
    return project


@router.post("/{project_id}/restore/", response_model=ProjectSchema)
def restore_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """Bring an archived project back into the live portfolio."""
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.archived_at = None
    project.archived_by = None
    db.add(project)
    db.commit()
    db.refresh(project)

    from ..core.audit import log_event
    log_event(
        db,
        event_type="RESTORE",
        category="PROJECT",
        description=f"Restored project: {project.project_name} ({project.project_number})",
        user_id=current_user.user_id
    )
    return project

@router.get("/{project_id}/", response_model=ProjectSchema)
def read_project(
    project_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    guard_project_access(db, current_user, project_id)
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.get("/{project_id}/metrics/")
def get_metrics(
    project_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    guard_project_access(db, current_user, project_id)
    metrics = ProjectService.get_project_metrics(db, project_id)
    if not metrics:
        raise HTTPException(status_code=404, detail="Project not found")
    return metrics

@router.get("/{project_id}/spending-breakdown/")
def get_spending_breakdown(
    project_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    guard_project_access(db, current_user, project_id)
    return ProjectService.get_category_spending(db, project_id)

@router.get("/{project_id}/burndown/")
def get_burndown(
    project_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    guard_project_access(db, current_user, project_id)
    return ProjectService.get_burndown_data(db, project_id)

@router.get("/{project_id}/task-burndown/")
def get_task_burndown(
    project_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    guard_project_access(db, current_user, project_id)
    return ProjectService.get_task_burndown_data(db, project_id)

@router.get("/{project_id}/summary/")
def get_project_summary(
    project_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    guard_project_access(db, current_user, project_id)
    return {"summary": ProjectService.get_executive_summary(db, project_id)}

@router.get("/{project_id}/network-diagram/")
def get_network_diagram(
    project_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    guard_project_access(db, current_user, project_id)
    return ProjectService.get_network_diagram_data(db, project_id)

@router.post("/", response_model=ProjectSchema, status_code=status.HTTP_201_CREATED)
def create_project(
    project_in: ProjectCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    project = ProjectService.create_project(db, project_in.dict())
    from ..core.audit import log_event
    log_event(
        db,
        event_type="CREATE",
        category="PROJECT",
        description=f"Created project: {project.project_name}",
        user_id=current_user.user_id,
        metadata=project_in.dict()
    )
    return project

@router.put("/{project_id}/", response_model=ProjectSchema)
def update_project(
    project_id: int, 
    project_in: ProjectUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_data = project_in.dict(exclude_unset=True)
    for field in update_data:
        setattr(project, field, update_data[field])
    
    db.add(project)
    db.commit()
    db.refresh(project)
    
    from ..core.audit import log_event
    log_event(
        db,
        event_type="UPDATE",
        category="PROJECT",
        description=f"Updated project: {project.project_name}",
        user_id=current_user.user_id,
        metadata=update_data
    )
    return project

@router.delete("/{project_id}/", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Implementation: Full cascading cleanup or logical delete
    # For a real system we usually use CASCADE in DB schema, but we'll ensure commit
    db.delete(project)
    db.commit()
    return None

