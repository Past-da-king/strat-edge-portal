from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from ..models.database import get_db, Project, User, ProjectAssignment, Task, AuditLog
from ..core.audit import log_event
from .deps import get_current_active_admin
import shutil
import os
import zipfile
from datetime import datetime
import io
from ..core.config import settings

router = APIRouter()

# --- Pydantic Schemas for Admin Actions ---
class UpdateProjectPM(BaseModel):
    new_pm_id: int

class UpdateProjectTeam(BaseModel):
    user_ids: List[int]

class UpdateTaskAssignment(BaseModel):
    task_id: int
    user_id: Optional[int]

class BulkTaskAssignment(BaseModel):
    assignments: List[UpdateTaskAssignment]

# --- Endpoints ---

@router.put("/projects/{project_id}/pm/", status_code=status.HTTP_200_OK)
def update_lead_pm(
    project_id: int, 
    payload: UpdateProjectPM, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """
    Change the Lead Project Manager for a project.
    Updates the project record and the assignments table.
    """
    # 1. Update Project Record
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    old_pm_id = project.pm_user_id
    project.pm_user_id = payload.new_pm_id
    db.add(project)
    
    # 2. Update Assignments: Remove old PM role, Add new PM role
    db.query(ProjectAssignment).filter(
        ProjectAssignment.project_id == project_id,
        ProjectAssignment.assigned_role == 'pm'
    ).delete()
    
    new_assignment = ProjectAssignment(
        project_id=project_id,
        user_id=payload.new_pm_id,
        assigned_role='pm',
        assigned_by=current_user.user_id
    )
    db.add(new_assignment)
    db.commit()
    
    log_event(
        db,
        event_type="UPDATE",
        category="PROJECT",
        description=f"Changed Lead PM for {project.project_name}",
        user_id=current_user.user_id,
        metadata={"old_pm": old_pm_id, "new_pm": payload.new_pm_id}
    )
    return {"message": "Lead PM updated successfully"}

@router.put("/projects/{project_id}/team/", status_code=status.HTTP_200_OK)
def update_project_team(
    project_id: int, 
    payload: UpdateProjectTeam, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """
    Update the team members for a project.
    Replaces existing 'team' role assignments with the new list.
    """
    # 1. Clear existing 'team' assignments
    db.query(ProjectAssignment).filter(
        ProjectAssignment.project_id == project_id,
        ProjectAssignment.assigned_role != 'pm'
    ).delete()
    
    # 2. Add new assignments
    for uid in payload.user_ids:
        assignment = ProjectAssignment(
            project_id=project_id,
            user_id=uid,
            assigned_role='team',
            assigned_by=current_user.user_id
        )
        db.add(assignment)
    
    db.commit()
    
    log_event(
        db,
        event_type="UPDATE",
        category="PROJECT",
        description=f"Updated team for project ID {project_id}",
        user_id=current_user.user_id,
        metadata={"new_team_count": len(payload.user_ids)}
    )
    return {"message": "Project team updated successfully"}

@router.put("/tasks/assignments/", status_code=status.HTTP_200_OK)
def bulk_update_task_assignments(
    payload: BulkTaskAssignment, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """
    Bulk update responsible users for tasks.
    """
    count = 0
    for item in payload.assignments:
        task = db.query(Task).filter(Task.activity_id == item.task_id).first()
        if task:
            task.responsible_user_id = item.user_id
            db.add(task)
            count += 1
    
    db.commit()
    
    log_event(
        db,
        event_type="UPDATE",
        category="ACTIVITY",
        description=f"Bulk updated {count} task assignments",
        user_id=current_user.user_id
    )
    return {"message": f"Updated {count} tasks"}

@router.get("/audit/", status_code=status.HTTP_200_OK)
def get_audit_logs(
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """
    Fetch system audit logs.
    """
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return logs

@router.get("/backup/", status_code=status.HTTP_200_OK)
def create_backup(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """
    Generates a full system backup (Database + GCS Objects - placeholder).
    Returns a zip file.
    """
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        db_path = settings.DATABASE_URL.replace("sqlite:///", "")
        if os.path.exists(db_path):
            zip_file.write(db_path, arcname="database/pm_tool.db")
        zip_file.writestr("manifest.txt", f"Backup created at {datetime.now()} by Admin ID {current_user.user_id}\nIncludes Database.")

    zip_buffer.seek(0)
    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=backup_{datetime.now().strftime('%Y%m%d')}.zip"}
    )

@router.post("/restore/", status_code=status.HTTP_200_OK)
async def restore_backup(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """
    Restores the system from a backup zip.
    DANGEROUS: Overwrites the current database.
    """
    content = await file.read()
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as zip_ref:
            if "database/pm_tool.db" in zip_ref.namelist():
                db_data = zip_ref.read("database/pm_tool.db")
                db_path = settings.DATABASE_URL.replace("sqlite:///", "")
                with open(db_path, "wb") as f:
                    f.write(db_data)
                log_event(db, "RESTORE", "SYSTEM", "System database restored from backup", current_user.user_id)
                return {"message": "Database restored successfully. Please restart the server."}
            else:
                raise HTTPException(status_code=400, detail="Invalid backup format: No database file found.")
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid zip file.")


# --- Project plan import -----------------------------------------------------
# The two written plans ship with the portal as data/plan_*.json. This runs the
# SAME importer the CLI runs (backend/import_plan.py), so there is one code path
# and no second, drifting copy. Idempotent: re-running updates rather than
# duplicating. Dry run by default - nothing is written unless commit=true.

class ImportPlanRequest(BaseModel):
    plan: str            # "erp" | "mthashana"
    commit: bool = False


def _importer():
    """import_plan.py sits at the backend root, beside app/. Render starts uvicorn
    from there so it is usually importable already, but do not rely on cwd."""
    import sys
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if root not in sys.path:
        sys.path.insert(0, root)
    import import_plan
    return import_plan


@router.get("/plans/", status_code=status.HTTP_200_OK)
def list_bundled_plans(current_user: User = Depends(get_current_active_admin)):
    """What can be imported, and how big each one is."""
    import json as _json
    BUNDLED_PLANS = _importer().BUNDLED_PLANS

    out = []
    for key, path in BUNDLED_PLANS.items():
        if not os.path.exists(path):
            continue
        doc = _json.load(open(path, encoding="utf-8"))
        out.append({
            "key": key,
            "project_name": doc["project"]["project_name"],
            "project_number": doc["project"]["project_number"],
            "activities": len(doc["activities"]),
        })
    return {"plans": out}


@router.post("/plans/import/", status_code=status.HTTP_200_OK)
def import_bundled_plan(
    payload: ImportPlanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin),
):
    """Load a written project plan into the portal.

    Run it once with commit=false first: the result names every person on the
    plan who has no portal account, whose activities would import unassigned.
    """
    mod = _importer()
    BUNDLED_PLANS, apply_plan = mod.BUNDLED_PLANS, mod.apply_plan

    path = BUNDLED_PLANS.get(payload.plan)
    if not path or not os.path.exists(path):
        raise HTTPException(
            status_code=404,
            detail=f"Unknown plan '{payload.plan}'. Known: {sorted(BUNDLED_PLANS)}",
        )

    result = apply_plan(db, path, payload.commit)

    if payload.commit:
        log_event(
            db,
            event_type="IMPORT",
            category="PROJECT",
            description=f"Imported project plan {result['project_number']} "
                        f"({result['created']} new, {result['updated']} updated activities)",
            user_id=current_user.user_id,
            metadata={k: result[k] for k in
                      ("plan", "project_number", "created", "updated", "unassigned")},
        )
    return result
