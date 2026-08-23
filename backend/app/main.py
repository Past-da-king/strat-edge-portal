
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .models.database import ensure_schema
from .api import projects, auth, tasks, risks, expenditures, repository, reports, admin, sso

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="2.0.0",
    description="Enterprise Project Management Portal - Decoupled Architecture"
)

@app.on_event("startup")
def sync_schema():
    """Keep the live database in step with the model (adds new columns only)."""
    try:
        ensure_schema()
    except Exception as e:  # never let a schema check take the API down
        print(f"WARNING: schema sync skipped: {e}")


@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"DEBUG: Incoming {request.method} {request.url.path}")
    response = await call_next(request)
    print(f"DEBUG: Response {response.status_code}")
    return response

# Set up CORS for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(sso.router, prefix="/auth/sso", tags=["Single Sign-On"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])
app.include_router(projects.router, prefix="/projects", tags=["Projects"])
app.include_router(tasks.router, prefix="/tasks", tags=["Tasks"])
app.include_router(risks.router, prefix="/risks", tags=["Risks"])
app.include_router(expenditures.router, prefix="/expenditures", tags=["Expenditures"])
app.include_router(repository.router, prefix="/repository", tags=["Repository"])
app.include_router(reports.router, prefix="/reports", tags=["Reports"])

@app.get("/health")
def health_check():
    return {"status": "operational", "version": "2.0.0"}
