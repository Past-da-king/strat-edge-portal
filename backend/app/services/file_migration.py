"""One-off: move the files still in the old Google bucket into SharePoint.

Idempotent: only rows whose file_path is not already an "sp:" key are touched, and
a row is only repointed after the file has been saved and read back identical.
The bucket copy is NOT deleted (Ayanda decides when the old bucket goes).
"""
from sqlalchemy.orm import Session

from ..models.database import Project, RepositoryFile, Risk, RiskProof, Task, TaskOutput
from . import file_locations as loc
from . import sharepoint_files as sp
from .storage_service import StorageService, is_sp


def _move(path: str, name: str, folder: str, apply: bool):
    """-> (status, new_key)"""
    candidates = [path, path.replace("\\", "/")]
    data = None
    for c in dict.fromkeys(candidates):
        try:
            data = StorageService.read_legacy(c)
        except Exception as e:                      # bucket unreachable
            return f"bucket error: {str(e)[:80]}", None
        if data is not None:
            break
    if data is None:
        return "missing in the old bucket", None
    if not apply:
        return f"would copy {len(data)} B -> {folder}/{name}", None
    item = sp.put(folder, name, data)
    key = sp.make_key(item["id"], item["name"])
    if sp.read(key) != data:
        return "read-back differs, not switched", None
    return f"copied {len(data)} B -> {folder}/{item['name']}", key


def run(db: Session, apply: bool = False) -> list:
    report = []
    projects = {p.project_id: p.project_name for p in db.query(Project).all()}

    for o in db.query(TaskOutput).all():
        if not o.file_path or is_sp(o.file_path):
            continue
        t = db.query(Task).filter(Task.activity_id == o.activity_id).first()
        pid = t.project_id if t else None
        folder = loc.task_output_folder(pid, projects.get(pid), t.activity_name if t else "Task", o.doc_type)
        st, key = _move(o.file_path, o.file_name, folder, apply)
        if key:
            o.file_path = key
            db.commit()
        report.append(("task_output", o.output_id, o.file_name, st))

    for f in db.query(RepositoryFile).filter(RepositoryFile.is_folder == 0).all():
        if not f.file_path or is_sp(f.file_path):
            continue
        names, cur, guard = [], (db.get(RepositoryFile, f.parent_id) if f.parent_id else None), 0
        while cur is not None and guard < 20:
            names.insert(0, cur.name)
            cur, guard = (db.get(RepositoryFile, cur.parent_id) if cur.parent_id else None), guard + 1
        folder = loc.repository_folder(f.project_id, projects.get(f.project_id), names)
        st, key = _move(f.file_path, f.name, folder, apply)
        if key:
            f.file_path = key
            db.commit()
        report.append(("repository_file", f.file_id, f.name, st))

    for p in db.query(RiskProof).all():
        if not p.file_path or is_sp(p.file_path):
            continue
        r = db.get(Risk, p.risk_id)
        folder = loc.risk_proof_folder(r.project_id if r else None, projects.get(r.project_id) if r else None, p.risk_id)
        st, key = _move(p.file_path, p.file_name, folder, apply)
        if key:
            p.file_path = key
            db.commit()
        report.append(("risk_proof", p.proof_id, p.file_name, st))
    return report
