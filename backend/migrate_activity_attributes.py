"""
One-off migration: add the activity planning columns (complexity, input type,
financial input) to baseline_schedule on an existing database.

The API also runs this on startup, so you only need this script if you want to
migrate a database by hand:

    cd backend && python migrate_activity_attributes.py
"""

from app.models.database import ensure_schema

if __name__ == "__main__":
    print("Syncing baseline_schedule schema...")
    ensure_schema()
    print("Done.")
