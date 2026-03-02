from app.models.database import Base, engine, User
from app.core.security import get_password_hash
from app.models.database import SessionLocal

def init_db():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    # Create initial admin user if not exists
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        print("Creating admin user...")
        admin = User(
            username="admin",
            full_name="System Administrator",
            password_hash=get_password_hash("admin123"),
            role="admin",
            status="active"
        )
        db.add(admin)
        db.commit()
    db.close()
    print("Database initialized.")

if __name__ == "__main__":
    init_db()
