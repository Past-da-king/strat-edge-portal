from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..models.database import get_db, Expenditure, User
from ..schemas.expenditure import Expenditure as ExpenditureSchema, ExpenditureCreate
from .deps import get_current_user
from typing import List

router = APIRouter()

@router.get("/project/{project_id}/", response_model=List[ExpenditureSchema])
def list_project_expenditures(
    project_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Expenditure).filter(Expenditure.project_id == project_id).all()

@router.post("/", response_model=ExpenditureSchema, status_code=status.HTTP_201_CREATED)
def create_expenditure(
    exp_in: ExpenditureCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_exp = Expenditure(**exp_in.dict())
    db.add(db_exp)
    db.commit()
    db.refresh(db_exp)
    
    from ..core.audit import log_event
    log_event(
        db,
        event_type="CREATE",
        category="FINANCE",
        description=f"Logged spend: R {db_exp.amount} for ref {db_exp.reference_id}",
        user_id=current_user.user_id,
        metadata=exp_in.dict()
    )

    # Mirror the spend into Strat Edge Finance — the suite's ledger. Fire and
    # forget, and keyed on the Portal's own exp_id so a retry cannot double-post.
    from ..core.finance_client import notify_finance
    notify_finance(
        external_id=f"portal-exp-{db_exp.exp_id}",
        project_id=db_exp.project_id,
        activity_id=db_exp.activity_id,
        category=db_exp.category,
        description=db_exp.description,
        amount=db_exp.amount,
        spend_date=db_exp.spend_date,
    )

    return db_exp
