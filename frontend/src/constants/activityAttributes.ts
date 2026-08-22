import api from '../services/api';

/**
 * Drop-down vocabularies for the activity plan.
 * The backend owns these (backend/app/core/rating.py) and serves them from
 * GET /tasks/attribute-options/ - the lists below are only a fallback so the
 * plan editor still works if that call fails.
 */
export interface AttributeOptions {
  complexity: string[];
  input_type: string[];
  financial_input: string[];
}

export const DEFAULT_ATTRIBUTE_OPTIONS: AttributeOptions = {
  complexity: ['Low', 'Medium', 'High', 'Very High'],
  input_type: ['Manual', 'Hybrid', 'Automated', 'External'],
  financial_input: ['No', 'Yes'],
};

export const ACTIVITY_DEFAULTS = {
  complexity: 'Medium',
  input_type: 'Manual',
  financial_input: 'No',
};

export const fetchAttributeOptions = async (): Promise<AttributeOptions> => {
  try {
    const res = await api.get('tasks/attribute-options/');
    return {
      complexity: res.data.complexity || DEFAULT_ATTRIBUTE_OPTIONS.complexity,
      input_type: res.data.input_type || DEFAULT_ATTRIBUTE_OPTIONS.input_type,
      financial_input: res.data.financial_input || DEFAULT_ATTRIBUTE_OPTIONS.financial_input,
    };
  } catch {
    return DEFAULT_ATTRIBUTE_OPTIONS;
  }
};

/** Colour treatment for the derived rating badge. */
export const ratingStyle = (band?: string) => {
  switch (band) {
    case 'Critical':
      return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
    case 'High':
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    case 'Moderate':
      return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
    default:
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
  }
};

/**
 * Live preview of the rating while a row is being edited.
 * MIRRORS backend/app/core/rating.py - the server value (rating_score /
 * rating_band on the task) is authoritative once the plan is saved. If you tune
 * the weights on the backend, tune them here too.
 */
const COMPLEXITY_POINTS: Record<string, number> = { Low: 1, Medium: 2, High: 3, 'Very High': 4 };
const INPUT_TYPE_POINTS: Record<string, number> = { Automated: 1, Hybrid: 2, External: 3, Manual: 4 };
const FINANCIAL_POINTS: Record<string, number> = { No: 0, Yes: 2 };
const W = { complexity: 1.5, input: 1.0, financial: 1.5, duration: 1.0 };
const RAW_MIN = W.complexity + W.input;
const RAW_MAX = 4 * W.complexity + 4 * W.input + 2 * W.financial + 3 * W.duration;

const durationPoints = (start?: string, finish?: string) => {
  if (!start || !finish) return 0;
  const days = (new Date(finish).getTime() - new Date(start).getTime()) / 86400000;
  if (isNaN(days) || days < 0) return 0;
  if (days <= 5) return 0;
  if (days <= 14) return 1;
  if (days <= 30) return 2;
  return 3;
};

export const computeRating = (task: any): { score: number; band: string } => {
  const raw =
    (COMPLEXITY_POINTS[task.complexity] ?? 2) * W.complexity +
    (INPUT_TYPE_POINTS[task.input_type] ?? 4) * W.input +
    (FINANCIAL_POINTS[task.financial_input] ?? 0) * W.financial +
    durationPoints(task.planned_start, task.planned_finish) * W.duration;

  const score = Math.round(Math.min(5, Math.max(1, 1 + (4 * (raw - RAW_MIN)) / (RAW_MAX - RAW_MIN))) * 10) / 10;
  const band = score >= 4 ? 'Critical' : score >= 3 ? 'High' : score >= 2 ? 'Moderate' : 'Low';
  return { score, band };
};
