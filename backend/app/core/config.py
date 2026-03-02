
import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "Strat Edge Portal Pro"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-here")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///../../pmt_app/pm_tool.db")
    
    # CORS
    CORS_ORIGINS: List[str] = ["*"]  # In production, restrict this to your frontend domain
    
    # Azure
    AZURE_CONNECTION_STRING: str = os.getenv("AZURE_CONNECTION_STRING", "")
    AZURE_CONTAINER_NAME: str = os.getenv("AZURE_CONTAINER_NAME", "uploads")

    class Config:
        case_sensitive = True

settings = Settings()
