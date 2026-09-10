from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from ..models.database import get_db, Project, Risk, RiskProof, User
from ..schemas.risk import Risk as RiskSchema, RiskCreate, RiskUpdate
from ..services.project_service import ProjectService
from .deps import get_current_user
from .projects import guard_project_access
from typing import List, Optional

router = APIRouter()


def _risk_you_may_touch(db: Session, current_user: User, risk_id: int) -> Risk:
    risk = db.query(Risk).filter(Risk.risk_id == risk_id).first()
    if not risk:
        raise HTTPException(status_code=404, detail="Risk not found")
    guard_project_access(db, current_user, risk.project_id)
    return risk


@router.get("/", response_model=List[RiskSchema])
def list_risks(
    project_id: Optional[int] = None,
    include_archived: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Risks on the projects this person may see, and only live projects unless asked.

    The register used to return every risk in the database, so archiving a
    project left its risks on the board, and anyone could read the risks of a
    project they are not on.
    """
    if project_id is not None:
        guard_project_access(db, current_user, project_id)
    visible = ProjectService.visible_project_ids(db, current_user, include_archived=include_archived)
    query = db.query(Risk).filter(Risk.project_id.in_(visible))
    if project_id is not None:
        query = query.filter(Risk.project_id == project_id)
    return query.order_by(Risk.risk_id.desc()).all()

@router.post("/", response_model=RiskSchema, status_code=status.HTTP_201_CREATED)
def create_risk(
    risk_in: RiskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    guard_project_access(db, current_user, risk_in.project_id)
    project = db.query(Project).filter(Project.project_id == risk_in.project_id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.archived_at is not None:
        raise HTTPException(status_code=409, detail="This project is archived - restore it before logging new risks")

    db_risk = Risk(**risk_in.dict(), recorded_by=current_user.user_id)
    db.add(db_risk)
    db.commit()
    db.refresh(db_risk)

    from ..core.audit import log_event
    log_event(
        db,
        event_type="CREATE",
        category="RISK",
        description=f"Logged risk: {db_risk.description[:50]}...",
        user_id=current_user.user_id,
        metadata={k: str(v) if v is not None else None for k, v in risk_in.dict().items()}
    )
    return db_risk

@router.put("/{risk_id}", response_model=RiskSchema)
def update_risk(
    risk_id: int,
    risk_in: RiskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    risk = _risk_you_may_touch(db, current_user, risk_id)

    update_data = risk_in.dict(exclude_unset=True)
    if "project_id" in update_data and update_data["project_id"] != risk.project_id:
        guard_project_access(db, current_user, update_data["project_id"])
    for field in update_data:
        setattr(risk, field, update_data[field])

    db.add(risk)
    db.commit()
    db.refresh(risk)

    from ..core.audit import log_event
    log_event(
        db,
        event_type="UPDATE",
        category="RISK",
        description=f"Updated risk ID {risk_id}",
        user_id=current_user.user_id,
        metadata={k: str(v) if v is not None else None for k, v in update_data.items()}
    )
    return risk

@router.post("/{risk_id}/proof/")
async def upload_risk_proof(
    risk_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    risk = _risk_you_may_touch(db, current_user, risk_id)

    # Imported here so the rest of the risk routes load without the GCP client.
    from ..services.storage_service import StorageService

    gcs_path = f"projects/{risk.project_id}/risks/{risk_id}/{file.filename}"

    content = await file.read()
    StorageService.upload_file(
        file_content=content,
        destination_path=gcs_path,
        content_type=file.content_type
    )

    db_proof = RiskProof(
        risk_id=risk_id,
        file_name=file.filename,
        file_path=gcs_path,
        uploaded_by=current_user.user_id
    )
    db.add(db_proof)

    # Update risk status if needed
    risk.status = "Mitigated"
    db.commit()

    from ..core.audit import log_event
    log_event(
        db,
        event_type="UPLOAD",
        category="RISK",
        description=f"Uploaded proof for risk: {risk.description[:30]}",
        user_id=current_user.user_id,
        metadata={"filename": file.filename}
    )

    return {"status": "success"}
