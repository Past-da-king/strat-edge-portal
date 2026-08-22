"""
Activity rating engine for the baseline schedule.

Every activity carries three planning attributes the PM picks from a drop-down
(complexity, input type, financial input) plus a duration taken from the planned
dates. This folds all of them into one 1.0 - 5.0 number so a plan can be read by
how heavy each activity actually is - which is what feeds capacity planning and
the financial plan behind it.

TUNE THE WEIGHTS HERE. Nothing else in the codebase needs to change.
"""

from datetime import date
from typing import Optional, Tuple

# --- Drop-down vocabularies (the API and the UI both read these) ---
COMPLEXITY_OPTIONS = ["Low", "Medium", "High", "Very High"]
INPUT_TYPE_OPTIONS = ["Manual", "Hybrid", "Automated", "External"]
FINANCIAL_INPUT_OPTIONS = ["No", "Yes"]

DEFAULTS = {
    "complexity": "Medium",
    "input_type": "Manual",
    "financial_input": "No",
}

# --- Points per option ---
COMPLEXITY_POINTS = {"Low": 1, "Medium": 2, "High": 3, "Very High": 4}
# Manual work carries the most effort and the most risk of slipping.
INPUT_TYPE_POINTS = {"Automated": 1, "Hybrid": 2, "External": 3, "Manual": 4}
FINANCIAL_POINTS = {"No": 0, "Yes": 2}

# Duration in calendar days -> points
DURATION_BANDS = [(5, 0), (14, 1), (30, 2)]
DURATION_MAX_POINTS = 3

# --- How much each dimension counts toward the rating ---
WEIGHTS = {
    "complexity": 1.5,
    "input_type": 1.0,
    "financial": 1.5,
    "duration": 1.0,
}

_RAW_MIN = 1 * WEIGHTS["complexity"] + 1 * WEIGHTS["input_type"]
_RAW_MAX = (
    4 * WEIGHTS["complexity"]
    + 4 * WEIGHTS["input_type"]
    + 2 * WEIGHTS["financial"]
    + DURATION_MAX_POINTS * WEIGHTS["duration"]
)


def _duration_points(start: Optional[date], finish: Optional[date]) -> int:
    if not start or not finish:
        return 0
    days = (finish - start).days
    if days < 0:
        return 0
    for threshold, points in DURATION_BANDS:
        if days <= threshold:
            return points
    return DURATION_MAX_POINTS


def compute_rating(
    complexity: Optional[str],
    input_type: Optional[str],
    financial_input: Optional[str],
    planned_start: Optional[date] = None,
    planned_finish: Optional[date] = None,
) -> Tuple[float, str]:
    """Return (score, band) where score is 1.0 - 5.0."""
    raw = (
        COMPLEXITY_POINTS.get(complexity or DEFAULTS["complexity"], 2) * WEIGHTS["complexity"]
        + INPUT_TYPE_POINTS.get(input_type or DEFAULTS["input_type"], 4) * WEIGHTS["input_type"]
        + FINANCIAL_POINTS.get(financial_input or DEFAULTS["financial_input"], 0) * WEIGHTS["financial"]
        + _duration_points(planned_start, planned_finish) * WEIGHTS["duration"]
    )
    score = 1 + 4 * (raw - _RAW_MIN) / (_RAW_MAX - _RAW_MIN)
    score = round(min(5.0, max(1.0, score)), 1)
    return score, band_for(score)


def band_for(score: float) -> str:
    if score >= 4.0:
        return "Critical"
    if score >= 3.0:
        return "High"
    if score >= 2.0:
        return "Moderate"
    return "Low"
