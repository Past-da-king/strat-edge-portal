"""
Who can see which project.

The rule Ayanda asked for: a project manager or a team member sees the projects
they are actually on, and nothing else; a director or an administrator sees the
whole portfolio.

This builds its own tiny portfolio in a throwaway database and asks the real
service the real question — no mocks, so the SQL itself is what is being tested.

    docker exec guavas-pg psql -U postgres -c "CREATE DATABASE portal_vis_test"
    DATABASE_URL=postgresql://postgres:postgres@localhost:5433/portal_vis_test \
      .venv-test/bin/python tests/test_project_visibility.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models import database as models          # noqa: E402
from app.services.project_service import ProjectService  # noqa: E402

passed, failed = 0, 0


def check(label, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {label}")
    else:
        failed += 1
        print(f"  FAIL  {label}   {detail}")


def visible(db, user):
    return {p["project_id"] for p in
            ProjectService.get_portfolio_metrics(db, viewer_id=ProjectService.viewer_id_for(user))}


def main():
    models.Base.metadata.drop_all(bind=models.engine)
    models.Base.metadata.create_all(bind=models.engine)
    db = models.SessionLocal()

    def user(uid, name, role):
        u = models.User(user_id=uid, username=name, full_name=name, role=role, status="approved")
        db.add(u)
        return u

    boss   = user(1, "director",  "executive")
    admin  = user(2, "admin",     "admin")
    lead_a = user(3, "pm_a",      "pm")
    lead_b = user(4, "pm_b",      "pm")
    member = user(5, "team",      "team")
    nobody = user(6, "outsider",  "team")
    db.commit()

    # Project A: pm_a leads it, `member` owns an activity on it.
    # Project B: pm_b leads it, and nobody else is near it.
    # Project C: nobody leads it; `member` is on the assignment list only.
    for pid, name, pm in ((1, "Project A", 3), (2, "Project B", 4), (3, "Project C", None)):
        db.add(models.Project(project_id=pid, project_name=name, pm_user_id=pm))
    db.commit()
    db.add(models.Task(project_id=1, activity_name="do a thing", responsible_user_id=5))
    db.add(models.ProjectAssignment(project_id=3, user_id=5, assigned_role="team", assigned_by=2))
    db.commit()

    print("\nWHAT EACH PERSON SEES")
    check("a director sees the whole portfolio", visible(db, boss) == {1, 2, 3}, visible(db, boss))
    check("an administrator sees the whole portfolio", visible(db, admin) == {1, 2, 3}, visible(db, admin))
    check("a PM sees the project they lead", visible(db, lead_a) == {1}, visible(db, lead_a))
    check("...and NOT the one they don't", 2 not in visible(db, lead_a))
    check("the other PM sees only theirs", visible(db, lead_b) == {2}, visible(db, lead_b))
    check("owning an activity counts as being on it", 1 in visible(db, member))
    check("being on the assignment list counts too", 3 in visible(db, member))
    check("a team member sees exactly their two", visible(db, member) == {1, 3}, visible(db, member))
    check("someone on nothing sees nothing", visible(db, nobody) == set(), visible(db, nobody))

    print("\nTHE SAME RULE ON A SINGLE PROJECT — the URL you can type")
    check("a PM may open their own project", ProjectService.can_see_project(db, lead_a, 1))
    check("a PM may NOT open someone else's", not ProjectService.can_see_project(db, lead_a, 2))
    check("a director may open any of them", ProjectService.can_see_project(db, boss, 2))
    check("an outsider may open none", not ProjectService.can_see_project(db, nobody, 1))

    print("\nARCHIVED PROJECTS")
    from datetime import datetime
    db.query(models.Project).filter(models.Project.project_id == 1).update({"archived_at": datetime.utcnow()})
    db.commit()
    check("an archived project drops out of the list", 1 not in visible(db, lead_a))
    check("...but is still there when asked for", 1 in {
        p["project_id"] for p in ProjectService.get_portfolio_metrics(
            db, viewer_id=ProjectService.viewer_id_for(lead_a), include_archived=True)})
    check("and archiving does not hand it to someone else",
          1 not in {p["project_id"] for p in ProjectService.get_portfolio_metrics(
              db, viewer_id=ProjectService.viewer_id_for(lead_b), include_archived=True)})

    db.close()
    print(f"\n{passed} passed, {failed} failed\n")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
