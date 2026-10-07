"""Where Portal files go in SharePoint, and how stored keys read. No network."""
import sys
from app.services import file_locations as L, sharepoint_files as sp

ok = bad = 0


def check(name, cond):
    global ok, bad
    if cond:
        ok += 1
    else:
        bad += 1
        print("FAIL", name)


MTH = "10 Projects/01 External/02 Projects - Mthashana and TVET"
INT = "10 Projects/02 Internal Operations and Meetings"
for pid in (1, 5):
    check(f"mth final {pid}", L.task_output_folder(pid, "x", "T", "Final Document") == f"{MTH}/02 Deliverables/T")
    check(f"mth draft {pid}", L.task_output_folder(pid, "x", "T", "Draft") == f"{MTH}/00 Project Plan/Task Drafts/T")
check("erp draft", L.task_output_folder(4, "x", "T", "Draft") == f"{INT}/01 ERP Sales& Market entry plan/00 Management/Task Drafts/T")
check("suite final", L.task_output_folder(7, "x", "T", "Final Submission") == f"{INT}/02 Strat Edge Suite-Modules and Build Order/02 Deliverables/T")
check("repo mth", L.repository_folder(1, "x", ["final documents", "a"]) == f"{MTH}/01 Mthashana Document Inventory/final documents/a")
check("repo internal", L.repository_folder(4, "x", []).endswith("01 ERP Sales& Market entry plan/00 Management/Repository"))
check("risk", L.risk_proof_folder(1, "x", 8) == f"{MTH}/00 Project Plan/Risk Register/Risk 8")
check("unknown project is parked under its own name", L.task_output_folder(99, "New: Proj", "T", "Draft").startswith(f"{INT}/Unfiled/New Proj/"))
check("plan import", L.plan_import_folder(5, "x") == f"{MTH}/00 Project Plan/Plan imports")
check("key parse", sp.parse_key(sp.make_key("01AB", "a:b.pdf")) == ("01AB", "a:b.pdf") and sp.is_key("sp:1:x") and not sp.is_key("projects/1/x"))
check("clean", sp.clean('a/b:c#d') == "a b c d")
print(f"{ok} passed, {bad} failed")
sys.exit(1 if bad else 0)
