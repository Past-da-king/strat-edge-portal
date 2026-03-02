import pandas as pd
from sqlalchemy.orm import Session
from ..models import database as models
from .project_service import ProjectService
import io

class ImportService:
    @staticmethod
    def import_project_excel(db: Session, file_content: bytes, user_id: int):
        # Load Excel
        xl = pd.ExcelFile(io.BytesIO(file_content))
        
        # 1. Parse Project Info
        df_info = pd.read_excel(xl, "Project_Schedule", header=None)
        
        project_data = {
            'project_name': str(df_info.iloc[4, 1]),
            'project_number': str(df_info.iloc[5, 1]),
            'client': str(df_info.iloc[6, 1]),
            'total_budget': float(df_info.iloc[4, 5]) if pd.notna(df_info.iloc[4, 5]) else 0.0,
            'start_date': pd.to_datetime(df_info.iloc[5, 5]).date() if pd.notna(df_info.iloc[5, 5]) else None,
            'target_end_date': pd.to_datetime(df_info.iloc[6, 5]).date() if pd.notna(df_info.iloc[6, 5]) else None,
            'pm_user_id': user_id,
            'created_by': user_id
        }
        
        # Create Project
        db_project = ProjectService.create_project(db, project_data)
        project_id = db_project.project_id
        
        # 2. Parse Schedule
        df_schedule = pd.read_excel(xl, "Project_Schedule", skiprows=10)
        
        for _, row in df_schedule.iterrows():
            activity_name = row.iloc[1] if len(row) > 1 else None
            if pd.isna(activity_name): continue
            
            data = {
                'project_id': project_id,
                'activity_name': str(activity_name),
                'expected_output': str(row.iloc[2]) if len(row) > 2 and pd.notna(row.iloc[2]) else None,
                'planned_start': pd.to_datetime(row.iloc[3]).date() if len(row) > 3 and pd.notna(row.iloc[3]) else None,
                'planned_finish': pd.to_datetime(row.iloc[4]).date() if len(row) > 4 and pd.notna(row.iloc[4]) else None,
                'budgeted_cost': float(row.iloc[5]) if len(row) > 5 and pd.notna(row.iloc[5]) else 0.0,
                'status': 'Not Started'
            }
            
            db_task = models.Task(**data)
            db.add(db_task)
            
        db.commit()
        return db_project
