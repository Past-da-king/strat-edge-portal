from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List
from .user import User

class RepositoryFileBase(BaseModel):
    name: str
    is_folder: int = 0
    file_path: Optional[str] = None
    parent_id: Optional[int] = None

class RepositoryFileCreate(RepositoryFileBase):
    project_id: int

class RepositoryFile(RepositoryFileBase):
    file_id: int
    project_id: int
    uploaded_by: Optional[int] = None
    created_at: datetime
    
    uploader: Optional[User] = None

    model_config = ConfigDict(from_attributes=True)

class TaskOutputBase(BaseModel):
    file_name: str
    file_path: str
    doc_type: str = "Draft"

class TaskOutput(TaskOutputBase):
    output_id: int
    activity_id: int
    uploaded_by: int
    uploaded_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class RepositoryLinkBase(BaseModel):
    source_type: str
    source_id: int
    target_type: str
    target_id: int

class RepositoryLink(RepositoryLinkBase):
    link_id: int
    created_by: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class FileRecord(BaseModel):
    output_id: int
    activity_id: int
    file_name: str
    file_path: str
    doc_type: str
    upload_date: datetime
    task_name: str
    uploader_name: str

    model_config = ConfigDict(from_attributes=True)

class SearchResult(BaseModel):
    id: int
    name: str
    type: str # 'deliverable' or 'personal'
    context: str # task name or folder path

class RelatedFile(BaseModel):
    id: int
    name: str
    type: str
    link_id: int

class RiskProofBase(BaseModel):
    file_name: str
    file_path: str

class RiskProof(RiskProofBase):
    proof_id: int
    risk_id: int
    uploaded_by: Optional[int] = None
    uploaded_at: datetime
    
    uploader: Optional[User] = None

    model_config = ConfigDict(from_attributes=True)
