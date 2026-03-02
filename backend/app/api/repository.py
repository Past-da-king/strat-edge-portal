from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..models.database import get_db, TaskOutput, Project, User
from ..schemas.repository import FileRecord
from .deps import get_current_user
from typing import List

router = APIRouter()

@router.get("/project/{project_id}/", response_model=List[FileRecord])
def list_project_files(
    project_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Consolidated Project Repository.
    Shows all deliverables across all tasks for a specific project.
    """
    # Verify project exists
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    from sqlalchemy import text
    query = text("""
        SELECT 
            o.output_id,
            o.file_name,
            o.file_path,
            o.doc_type,
            o.uploaded_at as upload_date,
            t.activity_name as task_name,
            u.full_name as uploader_name
        FROM task_outputs o
        JOIN baseline_schedule t ON o.activity_id = t.activity_id
        JOIN users u ON o.uploaded_by = u.user_id
        WHERE t.project_id = :pid
        ORDER BY o.uploaded_at DESC
    """)
    
    results = db.execute(query, {"pid": project_id}).fetchall()
    return [dict(r._mapping) for r in results]

@router.get("/all/", response_model=List[FileRecord])
def list_all_files(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Global Repository (Restricted based on role in production).
    """
    from sqlalchemy import text
    query = text("""
        SELECT 
            o.output_id,
            o.file_name,
            o.file_path,
            o.doc_type,
            o.uploaded_at as upload_date,
            t.activity_name as task_name,
            u.full_name as uploader_name
        FROM task_outputs o
        JOIN baseline_schedule t ON o.activity_id = t.activity_id
        JOIN users u ON o.uploaded_by = u.user_id
        ORDER BY o.uploaded_at DESC
        LIMIT 100
        """)
    
    results = db.execute(query).fetchall()
    return [dict(r._mapping) for r in results]
