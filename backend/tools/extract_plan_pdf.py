"""Pull the two Strat Edge project-plan PDFs into data/plan_*.json.

Run this only when a plan PDF changes; the JSON it writes is what the portal
imports (see ../import_plan.py). Needs pdfplumber, which is NOT a runtime
dependency of the API - install it into a throwaway venv:

    python3 -m venv /tmp/pdfenv && /tmp/pdfenv/bin/pip install pdfplumber
    /tmp/pdfenv/bin/python tools/extract_plan_pdf.py

WHY IT IS NOT A CLEAN TABLE READ. Both PDFs were laid out so that some cells
overflow their own borders - "Phone / Email / Meetings" physically starts inside
the KPI column. No position-based extractor can split that, and pdfplumber's own
extract_tables interleaves the characters of the two runs ("completePdh; o").
So: words are assigned to the column they OVERLAP MOST (which fixes most rows),
and the eleven rows that still come out wrong are corrected by hand in FIX
below, read off the rendered PDF by eye. If you re-run this after the PDF
changes, re-check FIX against the new file.
"""

import pdfplumber, json, re, os

# The PDFs as Ayanda sent them. Point SRC at wherever they live.
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
SRC = os.environ.get('PLAN_PDF_DIR', '/mnt/c/Users/past9/Downloads/dc/.aos/pastes')

def grid(path):
    with pdfplumber.open(path) as pdf:
        pg = pdf.pages[0]
        tb = pg.find_tables()[0]
        best = max(tb.rows, key=lambda r: sum(1 for c in r.cells if c))
        bounds = [(c[0], c[2]) for c in best.cells if c]
        words = pg.extract_words(use_text_flow=True, keep_blank_chars=False)
        rows = []
        for r in tb.rows:
            top, bot = r.bbox[1], r.bbox[3]
            cells = [[] for _ in bounds]
            for w in words:
                cy = (w['top'] + w['bottom']) / 2
                if not (top - 0.5 <= cy <= bot + 0.5):
                    continue
                bi, bo = None, 0
                for i, (a, b) in enumerate(bounds):
                    ov = min(w['x1'], b) - max(w['x0'], a)
                    if ov > bo: bi, bo = i, ov
                if bi is not None: cells[bi].append(w)
            rows.append([' '.join(w['text'] for w in sorted(bk, key=lambda w: (round(w['top']*2), w['x0']))).strip()
                         for bk in cells])
        return rows

# ---------------------------------------------------------------- ERP
erp = grid(f'{SRC}/6a5fb753-ERP-_Project_PLan.pdf')[1:]
ERP = []
for r in erp:
    # Two activity names are wider than their cell, so their trailing "1)" / "2)"
    # lands in the Person Responsible column. Put it back where it belongs.
    m = re.match(r'^(\d\))(.*)$', r[2])
    if m:
        r[1] = (r[1] + ' ' + m.group(1)).strip()
        r[2] = m.group(2).strip()
    ERP.append(dict(seq=int(r[0]), activity=r[1], responsible=r[2], start=r[3], finish=r[4],
                    depends_on=r[5], critical_path=r[6], kpi=r[7], implementing_agent=r[8],
                    status=r[9], financial_input=r[10], financial_input_type=r[11],
                    output=r[12], complexity=r[13], complexity_rank=r[14]))

# ---------------------------------------------------------------- MTHASHANA
mth = grid(f'{SRC}/b34aebc9-Project_Plan-_Mthashana_P_L.pdf')[1:]
MTH = []
for r in mth:
    MTH.append(dict(seq=int(re.match(r'\d+', r[0]).group()), activity=r[1], responsible=r[2],
                    start=r[3], finish=r[4], depends_on=r[5], critical_path=r[6], kpi=r[7],
                    implementing_agent=r[8], status=r[9], financial_input=r[10],
                    financial_input_type=r[11], output=r[12], complexity=r[13]))

# Where a cell's text physically overflows its border in the source PDF, no
# position-based extraction can split it. These eleven rows were read off the
# rendered PDF by eye and are corrected here by hand.
FIX = {
 5:  dict(kpi="Priority engagements initiated/completed; opportunities and actions recorded",
          implementing_agent="Phone / Email / Meetings", status="Planned",
          financial_input="Y", financial_input_type="Meetings/travel where required",
          output="Partner Engagement Tracker"),
 6:  dict(financial_input="Y", financial_input_type="Legal/approval support if required",
          output="MOU Approval Pack"),
 7:  dict(financial_input="Y", financial_input_type="Engagement/travel if required",
          output="Signed MOUs / MOU Status Register"),
 9:  dict(finish="21-Sept-2026", depends_on="1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12",
          critical_path="Y"),
 11: dict(financial_input="Y", financial_input_type="Travel / accommodation planning",
          output="Locked Campus Master Schedule"),
 13: dict(implementing_agent="Manual / Site / Interview", status="Planned", financial_input="Y",
          financial_input_type="Travel / accommodation / local transport",
          output="Campus 1 Status Quo Pack"),
 14: dict(implementing_agent="Manual / Site / Interview", status="Planned", financial_input="Y",
          financial_input_type="Travel / accommodation / local transport",
          output="Campus 2 Status Quo Pack"),
 15: dict(implementing_agent="Manual / Site / Interview", status="Planned", financial_input="Y",
          financial_input_type="Travel / accommodation / local transport",
          output="Campus 3 Status Quo Pack"),
 16: dict(implementing_agent="Manual / Site / Interview", status="Planned", financial_input="Y",
          financial_input_type="Travel / accommodation / local transport",
          output="Campus 4 Status Quo Pack"),
 17: dict(implementing_agent="Manual / Site / Interview", status="TBC", financial_input="Y",
          financial_input_type="Travel / accommodation / local transport",
          output="Additional Campus Status Quo Pack(s)"),
 24: dict(financial_input="Y", financial_input_type="Meeting/workshop costs if required",
          output="Validated Findings & Feedback Register"),
}
for row in MTH:
    row.update(FIX.get(row['seq'], {}))

json.dump({
  "project": {"project_name": "ERP Sales & Market Entry Plan",
              "project_number": "SE-ERP-2026",
              "client": "Strat Edge Solutions",
              "stream": "AI & Digitisation",
              "source_document": "ERP - Project PLan.pdf"},
  "activities": ERP}, open(os.path.join(OUT, 'plan_erp.json'), 'w'), indent=1)

json.dump({
  "project": {"project_name": "Mthashana TVET College - Strategic Partnerships & Linkages",
              "project_number": "MTH-02-PL-2026",
              "client": "Mthashana TVET College",
              "stream": "Business Consulting",
              "source_document": "Project Plan- Mthashana P&L.pdf"},
  "activities": MTH}, open(os.path.join(OUT, 'plan_mthashana.json'), 'w'), indent=1)

print("ERP", len(ERP), "MTH", len(MTH))
for row in MTH:
    if row['seq'] in FIX or row['seq'] in (1,27):
        print(row['seq'], '|', row['implementing_agent'], '|', row['status'], '|',
              row['financial_input'], '|', row['financial_input_type'], '|', row['output'], '|', row['finish'], '|', row['depends_on'], '|', row['critical_path'])
