from ..services.storage_service import StorageService
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from ..models.database import get_db, Risk, RiskProof, User
from ..schemas.risk import Risk as RiskSchema, RiskCreate, RiskUpdate
from .deps import get_current_user
from typing import List

router = APIRouter()

@router.get("/", response_model=List[RiskSchema])
def list_risks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Logic to only show risks for projects the user has access to could go here
    return db.query(Risk).all()

@router.post("/", response_model=RiskSchema, status_code=status.HTTP_201_CREATED)
def create_risk(
    risk_in: RiskCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_risk = Risk(**risk_in.dict(), identified_by=current_user.user_id)
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
        metadata=risk_in.dict()
    )
    return db_risk

@router.put("/{risk_id}", response_model=RiskSchema)
def update_risk(
    risk_id: int, 
    risk_in: RiskUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    risk = db.query(Risk).filter(Risk.risk_id == risk_id).first()
    if not risk:
        raise HTTPException(status_code=404, detail="Risk not found")
    
    update_data = risk_in.dict(exclude_unset=True)
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
        metadata=update_data
    )
    return risk

@router.post("/{risk_id}/proof/")
async def upload_risk_proof(
    risk_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    risk = db.query(Risk).filter(Risk.risk_id == risk_id).first()
    if not risk:
        raise HTTPException(status_code=404, detail="Risk not found")
    
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
