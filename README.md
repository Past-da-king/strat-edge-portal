# Strat Edge Portal Pro v2.0

Modernized, decoupled version of the Strat Edge Project Portal.

## Architecture
- **Backend**: FastAPI, SQLAlchemy, Pydantic, JWT Auth.
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Lucide Icons.
- **Database**: SQLite (Production-ready with SQLAlchemy).
- **Storage**: Azure Blob Storage Integration.

## Getting Started

### Backend Setup
1. Navigate to `backend/`
2. Create a virtual environment: `python -m venv venv`
3. Activate: `source venv/bin/activate` (or `venv\Scripts\activate` on Windows)
4. Install dependencies: `pip install -r requirements.txt`
5. Initialize Database: `python init_db.py`
6. Run Server: `uvicorn app.main:app --reload`

### Frontend Setup
1. Navigate to `frontend/`
2. Install dependencies: `npm install`
3. Run Development Server: `npm run dev`
4. Access at `http://localhost:3000`

## Features
- **JWT Authentication**: Secure stateless auth.
- **Project Portfolio**: Card-based view with performance metrics.
- **Baseline Schedule**: Task management and status tracking.
- **Risk Register**: Impact assessment and mitigation tracking.
- **Expenditures**: Project-level cost tracking.
- **Repository**: Centralized file management.
- **Audit Logs**: Comprehensive tracking of all system activity.

## Standards
- **SOLID**: Layered architecture (API -> Service -> Model).
- **DRY**: Reusable React components and backend services.
- **Security**: Password hashing, JWT, Input validation.
- **Performance**: Optimized SQL queries and React rendering.
