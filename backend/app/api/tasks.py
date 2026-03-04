from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from ..models.database import get_db, Task, TaskOutput, User
from ..schemas.task import Task as TaskSchema, TaskCreate, TaskUpdate, TaskOutput as OutputSchema
from .deps import get_current_user, get_current_active_admin
from typing import List

router = APIRouter()

@router.get("/project/{project_id}/", response_model=List[TaskSchema])
def get_task_inventory(
    project_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    return tasks

@router.post("/", response_model=TaskSchema, status_code=status.HTTP_201_CREATED)
def create_task(
    task_in: TaskCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    db_task = Task(**task_in.dict())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    from ..core.audit import log_event
    log_event(
        db,
        event_type="CREATE",
        category="ACTIVITY",
        description=f"Created task: {db_task.activity_name}",
        user_id=current_user.user_id,
        metadata=task_in.dict()
    )
    return db_task

@router.put("/{task_id}/", response_model=TaskSchema)
def update_task(
    task_id: int, 
    task_in: TaskUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.activity_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Optional: Check if user is assigned to this task or is admin/pm
    
    update_data = task_in.dict(exclude_unset=True)
    for field in update_data:
        setattr(task, field, update_data[field])
    
    db.add(task)
    db.commit()
    db.refresh(task)
    
    from ..core.audit import log_event
    log_event(
        db,
        event_type="UPDATE",
        category="ACTIVITY",
        description=f"Updated task: {task.activity_name}",
        user_id=current_user.user_id,
        metadata=update_data
    )
    return task

@router.delete("/{task_id}/", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    task = db.query(Task).filter(Task.activity_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    name = task.activity_name
    db.delete(task)
    db.commit()
    
    from ..core.audit import log_event
    log_event(
        db,
        event_type="DELETE",
        category="ACTIVITY",
        description=f"Deleted task: {name}",
        user_id=current_user.user_id
    )
    return None

@router.get("/output/{output_id}/blob/")
def get_output_blob_info(
    output_id: int, 
    inline: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    output = db.query(TaskOutput).filter(TaskOutput.output_id == output_id).first()
    if not output:
        raise HTTPException(status_code=404, detail="Output not found")
    
    # Generate signed URL with correct disposition
    signed_url = StorageService.get_signed_url(output.file_path, inline=inline)
    
    from ..core.audit import log_event
    log_event(
        db,
        event_type="DOWNLOAD",
        category="FILE",
        description=f"Generated signed URL for: {output.file_name}",
        user_id=current_user.user_id
    )
    
    return {"file_name": output.file_name, "signed_url": signed_url}

@router.delete("/output/{output_id}/", status_code=status.HTTP_204_NO_CONTENT)
def delete_task_output(
    output_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    output = db.query(TaskOutput).filter(TaskOutput.output_id == output_id).first()
    if not output:
        raise HTTPException(status_code=404, detail="Output not found")
    
    # 1. Delete from GCS
    try:
        StorageService.delete_file(output.file_path)
    except Exception as e:
        print(f"Warning: Failed to delete file from storage: {str(e)}")
    
    # 2. Log Audit
    from ..core.audit import log_event
    log_event(
        db,
        event_type="DELETE",
        category="FILE",
        description=f"Permanently deleted file: {output.file_name}",
        user_id=current_user.user_id
    )
    
    # 3. Delete from DB
    db.delete(output)
    db.commit()
    return None

from ..services.storage_service import StorageService

@router.post("/{task_id}/upload/")
async def upload_task_output(
    task_id: int,
    doc_type: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.activity_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Path inside the bucket
    gcs_path = f"projects/{task.project_id}/tasks/{task_id}/{file.filename}"
    
    content = await file.read()
    StorageService.upload_file(
        file_content=content,
        destination_path=gcs_path,
        content_type=file.content_type
    )
    
    db_output = TaskOutput(
        activity_id=task_id,
        file_name=file.filename,
        file_path=gcs_path,
        doc_type=doc_type,
        uploaded_by=current_user.user_id
    )
    db.add(db_output)
    
    if doc_type == "First Draft" and task.status == "Not Started":
        task.status = "Active"
    elif doc_type == "Final Document":
        task.status = "Complete"
        
    db.commit()
    db.refresh(task)
    
    from ..core.audit import log_event
    log_event(
        db,
        event_type="UPLOAD",
        category="FILE",
        description=f"Uploaded {doc_type}: {file.filename}",
        user_id=current_user.user_id,
        metadata={"filename": file.filename, "doc_type": doc_type, "new_status": task.status}
    )
    
    return {"status": "success", "new_task_status": task.status}
