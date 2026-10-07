"""Which SharePoint folder a Portal file belongs in.

Each Portal project has a matching project folder in the Company Docs library
(Library root: 10 Projects/...). Everything a project stores goes inside its own
folder, never anywhere else:

  Mthashana (Portal projects 1 and 5)  ->  10 Projects/01 External/02 Projects - Mthashana and TVET
  ERP Sales & Market Entry Plan (4)    ->  10 Projects/02 Internal Operations and Meetings/01 ERP Sales& Market entry plan
  Strat Edge Suite build (7)           ->  10 Projects/02 Internal Operations and Meetings/02 Strat Edge Suite-Modules and Build Order

Inside the project folder:
  task output, Final Document / Final Submission  ->  02 Deliverables/<task name>
  task output, anything else (drafts, evidence)    ->  <00 Project Plan | 00 Management>/Task Drafts/<task name>
  repository file                                  ->  <01 Mthashana Document Inventory | 00 Management/Repository>/<repository folders>
  risk proof                                       ->  <00 Project Plan | 00 Management>/Risk Register/Risk <id>
  imported plan workbook                           ->  <00 Project Plan | 00 Management>/Plan imports

Mthashana keeps its plan files in "00 Project Plan"; the internal projects use
"00 Management". The names are the real folder names: do not "tidy" them.
"""
from typing import Optional

from .sharepoint_files import clean

MTH = "10 Projects/01 External/02 Projects - Mthashana and TVET"
INT = "10 Projects/02 Internal Operations and Meetings"

PROJECT_BASE = {
    1: MTH,
    5: MTH,
    4: f"{INT}/01 ERP Sales& Market entry plan",
    7: f"{INT}/02 Strat Edge Suite-Modules and Build Order",
}
UNFILED = f"{INT}/Unfiled"

FINAL_TYPES = {"final document", "final submission"}


def _is_mth(project_id) -> bool:
    return PROJECT_BASE.get(project_id) == MTH


def _base(project_id, project_name: Optional[str]) -> str:
    base = PROJECT_BASE.get(project_id)
    if base:
        return base
    # A project with no matching folder yet: park it under its own name, visibly,
    # rather than guessing a wrong project's folder.
    return f"{UNFILED}/{clean(project_name or f'Project {project_id}', 'Project')}"


def _mgmt(project_id) -> str:
    return "00 Project Plan" if _is_mth(project_id) else "00 Management"


def task_output_folder(project_id, project_name, task_name, doc_type) -> str:
    task = clean(task_name or "Task", "Task")
    if (doc_type or "").strip().lower() in FINAL_TYPES:
        return f"{_base(project_id, project_name)}/02 Deliverables/{task}"
    return f"{_base(project_id, project_name)}/{_mgmt(project_id)}/Task Drafts/{task}"


def repository_folder(project_id, project_name, folder_names) -> str:
    root = ("01 Mthashana Document Inventory" if _is_mth(project_id) else "00 Management/Repository")
    parts = "/".join(clean(n, "Folder") for n in (folder_names or []))
    return f"{_base(project_id, project_name)}/{root}" + (f"/{parts}" if parts else "")


def risk_proof_folder(project_id, project_name, risk_id) -> str:
    return f"{_base(project_id, project_name)}/{_mgmt(project_id)}/Risk Register/Risk {risk_id}"


def plan_import_folder(project_id, project_name) -> str:
    """The workbook a project was created from, filed with its plan."""
    return f"{_base(project_id, project_name)}/{_mgmt(project_id)}/Plan imports"
