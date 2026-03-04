from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..models.database import get_db, TaskOutput, Project, User, RepositoryFile, RepositoryLink
from ..schemas.repository import FileRecord, RepositoryFile as RepoFileSchema, RepositoryFileCreate, SearchResult, RelatedFile
from .deps import get_current_user
from typing import List, Optional
from ..services.storage_service import StorageService

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
            o.activity_id,
            o.file_name,
            o.file_path,
            o.doc_type,
            o.uploaded_at as upload_date,
            t.activity_name as task_name,
            COALESCE(u.full_name, 'Unknown System User') as uploader_name
        FROM task_outputs o
        JOIN baseline_schedule t ON o.activity_id = t.activity_id
        LEFT JOIN users u ON o.uploaded_by = u.user_id
        WHERE t.project_id = :pid
        ORDER BY o.uploaded_at DESC
    """)
    
    results = db.execute(query, {"pid": project_id}).fetchall()
    return [dict(r._mapping) for r in results]

@router.get("/project/{project_id}/knowledge-base/", response_model=List[RepoFileSchema])
def list_knowledge_base(
    project_id: int,
    parent_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetch the custom folder/file structure for a project.
    """
    query = db.query(RepositoryFile).filter(RepositoryFile.project_id == project_id)
    if parent_id:
        query = query.filter(RepositoryFile.parent_id == parent_id)
    else:
        query = query.filter(RepositoryFile.parent_id.is_(None))
    
    return query.order_by(RepositoryFile.is_folder.desc(), RepositoryFile.name).all()

@router.post("/folders/", response_model=RepoFileSchema)
def create_folder(
    folder_in: RepositoryFileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_folder = RepositoryFile(
        project_id=folder_in.project_id,
        parent_id=folder_in.parent_id,
        name=folder_in.name,
        is_folder=1,
        uploaded_by=current_user.user_id
    )
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return db_folder

@router.post("/upload/", response_model=RepoFileSchema)
async def upload_personal_file(
    project_id: int = File(...),
    parent_id: Optional[int] = File(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Path: projects/{project_id}/personal/{filename}
    gcs_path = f"projects/{project_id}/personal/{file.filename}"
    
    content = await file.read()
    StorageService.upload_file(
        file_content=content,
        destination_path=gcs_path,
        content_type=file.content_type
    )
    
    db_file = RepositoryFile(
        project_id=project_id,
        parent_id=parent_id,
        name=file.filename,
        is_folder=0,
        file_path=gcs_path,
        uploaded_by=current_user.user_id
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    return db_file

@router.get("/search/", response_model=List[SearchResult])
def search_repository(
    project_id: int,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search across deliverables and personal files. Returns all if q is empty.
    """
    results = []
    search_term = f"%{q}%" if q else "%"
    
    # 1. Search Deliverables
    from sqlalchemy import text
    deliv_sql = text("""
        SELECT o.output_id as id, o.file_name as name, t.activity_name as context
        FROM task_outputs o
        JOIN baseline_schedule t ON o.activity_id = t.activity_id
        WHERE t.project_id = :pid AND o.file_name ILIKE :q
        LIMIT 50
    """)
    delivs = db.execute(deliv_sql, {"pid": project_id, "q": search_term}).fetchall()
    for d in delivs:
        results.append({"id": d.id, "name": d.name, "type": "deliverable", "context": d.context})
        
    # 2. Search Personal Files
    personal = db.query(RepositoryFile).filter(
        RepositoryFile.project_id == project_id,
        RepositoryFile.is_folder == 0,
        RepositoryFile.name.ilike(search_term)
    ).limit(50).all()
    
    for p in personal:
        results.append({"id": p.file_id, "name": p.name, "type": "personal", "context": "Knowledge Base"})
        
    return results

@router.post("/links/batch/", status_code=status.HTTP_201_CREATED)
def batch_link_files(
    payload: dict, # source {type, id}, targets [{type, id}]
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    source = payload.get("source")
    targets = payload.get("targets", [])
    
    if not source or not targets:
        raise HTTPException(status_code=400, detail="Missing source or targets")

    s_type = 'A' if source["type"] == 'deliverable' else 'R'
    s_id = source["id"]

    for target in targets:
        t_type = 'A' if target["type"] == 'deliverable' else 'R'
        t_id = target["id"]
        
        # Avoid self-linking
        if s_type == t_type and s_id == t_id:
            continue

        # Check for existing link
        exists = db.query(RepositoryLink).filter(
            ((RepositoryLink.source_type == s_type) & (RepositoryLink.source_id == s_id) & (RepositoryLink.target_type == t_type) & (RepositoryLink.target_id == t_id)) |
            ((RepositoryLink.source_type == t_type) & (RepositoryLink.source_id == t_id) & (RepositoryLink.target_type == s_type) & (RepositoryLink.target_id == s_id))
        ).first()

        if not exists:
            link = RepositoryLink(
                source_type=s_type,
                source_id=s_id,
                target_type=t_type,
                target_id=t_id,
                created_by=current_user.user_id
            )
            db.add(link)
    
    db.commit()
    return {"status": "batch linked"}

@router.post("/links/", status_code=status.HTTP_201_CREATED)
def link_files(
    link_in: dict, # source_type, source_id, target_type, target_id
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Mapping friendly types to single chars
    source_type = link_in.get("source_type")
    target_type = link_in.get("target_type")
    source_id = link_in.get("source_id")
    target_id = link_in.get("target_id")

    s_type = 'A' if source_type == 'deliverable' else 'R'
    t_type = 'A' if target_type == 'deliverable' else 'R'
    
    if s_type == t_type and source_id == target_id:
        raise HTTPException(status_code=400, detail="Cannot link file to itself")

    link = RepositoryLink(
        source_type=s_type,
        source_id=source_id,
        target_type=t_type,
        target_id=target_id,
        created_by=current_user.user_id
    )
    db.add(link)
    db.commit()
    return {"status": "linked"}

@router.get("/related/{file_type}/{file_id}/", response_model=List[RelatedFile])
def get_related_files(
    file_type: str, # 'deliverable' or 'personal'
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    type_char = 'A' if file_type == 'deliverable' else 'R'
    
    from sqlalchemy import text
    query = text("""
        SELECT 
            link_id,
            CASE 
                WHEN source_type = :char AND source_id = :fid THEN target_type
                ELSE source_type
            END as rel_type,
            CASE 
                WHEN source_type = :char AND source_id = :fid THEN target_id
                ELSE source_id
            END as rel_id
        FROM repository_links
        WHERE (source_type = :char AND source_id = :fid)
           OR (target_type = :char AND target_id = :fid)
    """)
    
    links = db.execute(query, {"char": type_char, "fid": file_id}).fetchall()
    
    related = []
    for l in links:
        name = "Unknown File"
        if l.rel_type == 'A':
            res = db.execute(text("SELECT file_name FROM task_outputs WHERE output_id = :id"), {"id": l.rel_id}).fetchone()
            if res: name = res[0]
        else:
            res = db.execute(text("SELECT name FROM repository_files WHERE file_id = :id"), {"id": l.rel_id}).fetchone()
            if res: name = res[0]
            
        related.append({
            "id": l.rel_id,
            "name": name,
            "type": "deliverable" if l.rel_type == 'A' else "personal",
            "link_id": l.link_id
        })
        
    return related

@router.delete("/files/{file_id}/", status_code=status.HTTP_204_NO_CONTENT)
def delete_repo_item(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    item = db.query(RepositoryFile).filter(RepositoryFile.file_id == file_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if item.is_folder == 0 and item.file_path:
        try:
            StorageService.delete_file(item.file_path)
        except: pass
        
    db.execute(text("DELETE FROM repository_links WHERE (source_type = 'R' AND source_id = :id) OR (target_type = 'R' AND target_id = :id)"), {"id": file_id})
    db.delete(item)
    db.commit()
    return None

@router.get("/files/{file_id}/blob/")
def get_personal_file_blob(
    file_id: int,
    inline: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    item = db.query(RepositoryFile).filter(RepositoryFile.file_id == file_id).first()
    if not item or item.is_folder == 1:
        raise HTTPException(status_code=404, detail="File not found")
    
    signed_url = StorageService.get_signed_url(item.file_path, inline=inline)
    return {"file_name": item.name, "signed_url": signed_url}

@router.get("/all/", response_model=List[FileRecord])
def list_all_files(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy import text
    query = text("""
        SELECT 
            o.output_id,
            o.activity_id,
            o.file_name,
            o.file_path,
            o.doc_type,
            o.uploaded_at as upload_date,
            t.activity_name as task_name,
            COALESCE(u.full_name, 'Unknown System User') as uploader_name
        FROM task_outputs o
        JOIN baseline_schedule t ON o.activity_id = t.activity_id
        LEFT JOIN users u ON o.uploaded_by = u.user_id
        ORDER BY o.uploaded_at DESC
        LIMIT 100
    """)
    results = db.execute(query).fetchall()
    return [dict(r._mapping) for r in results]
