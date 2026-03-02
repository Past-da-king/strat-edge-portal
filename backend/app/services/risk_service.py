
from sqlalchemy.orm import Session
from ..models import risk as risk_models
from typing import List

class RiskService:
    @staticmethod
    def get_project_risks(db: Session, project_id: int):
        return db.query(risk_models.Risk).filter(risk_models.Risk.project_id == project_id).all()

    @staticmethod
    def log_risk(db: Session, risk_data: dict, user_id: int):
        new_risk = risk_models.Risk(**risk_data)
        db.add(new_risk)
        db.commit()
        db.refresh(new_risk)
        return new_risk

    @staticmethod
    def resolve_risk(db: Session, risk_id: int, proof_data: dict, user_id: int):
        risk = db.query(risk_models.Risk).filter(risk_models.Risk.id == risk_id).first()
        if not risk: return None
        
        risk.status = "Resolved"
        # Logic to add proof file record would go here
        
        db.commit()
        return risk
