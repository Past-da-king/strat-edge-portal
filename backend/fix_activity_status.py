"""
Fix Activity Status Script

This script finds all tasks where users have submitted 'Final Submission' documents
but the task status was not updated to 'Complete' due to the doc_type mismatch bug.

It will:
1. Find all task_outputs with doc_type = 'Final Submission'
2. Update the corresponding task status to 'Complete'
3. Report the changes made
"""

from sqlalchemy import text
from app.models.database import SessionLocal, Task, TaskOutput
from app.core.config import settings

def fix_activity_status():
    db = SessionLocal()
    
    try:
        print("=" * 60)
        print("ACTIVITY STATUS FIX SCRIPT")
        print("=" * 60)
        print("\nSearching for tasks with 'Final Submission' or 'Final Document' documents...\n")
        
        # Find all task outputs with 'Final Submission' or 'Final Document' doc_type
        # Using ILIKE for case-insensitivity
        final_submissions = db.query(TaskOutput).filter(
            (TaskOutput.doc_type.ilike('Final Submission')) | 
            (TaskOutput.doc_type.ilike('Final Document'))
        ).all()
        
        if not final_submissions:
            print("✅ No matching documents found. No fixes needed.")
            return
        
        # Get unique activity IDs
        activity_ids = set(sub.activity_id for sub in final_submissions)
        print(f"📊 Found {len(final_submissions)} qualifying documents across {len(activity_ids)} activities\n")
        
        # Update tasks that are not already 'Complete'
        updated_count = 0
        skipped_count = 0
        
        for activity_id in activity_ids:
            task = db.query(Task).filter(Task.activity_id == activity_id).first()
            
            if not task:
                print(f"⚠️  Task ID {activity_id} not found - skipping")
                continue
            
            if task.status == 'Complete':
                print(f"✓ Task {activity_id} ('{task.activity_name[:50]}') is already Complete - skipping")
                skipped_count += 1
                continue
            
            old_status = task.status
            task.status = 'Complete'
            db.add(task)
            updated_count += 1
            
            print(f"✅ UPDATED: Task {activity_id} ('{task.activity_name[:50]}...') - Status: {old_status} → Complete")
        
        # Commit all changes
        db.commit()
        
        print("\n" + "=" * 60)
        print("SUMMARY")
        print("=" * 60)
        print(f"📊 Total 'Final Submission' documents found: {len(final_submissions)}")
        print(f"📊 Unique activities affected: {len(activity_ids)}")
        print(f"✅ Activities updated to 'Complete': {updated_count}")
        print(f"⏭️  Activities already 'Complete': {skipped_count}")
        print("\n✨ Activity status fix completed successfully!")
        print("=" * 60)
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ ERROR: {str(e)}")
        print("Database changes rolled back. Please fix the error and try again.")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    fix_activity_status()
