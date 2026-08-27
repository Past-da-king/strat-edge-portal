import api from './api';

/**
 * Weekly activity log.
 *
 * Every week is named by its Monday. The backend snaps whatever date it is
 * given to that Monday, but the UI sends Mondays anyway so what is on screen
 * and what is stored are never a day apart.
 */

export interface WeeklyLogEntry {
  log_id: number;
  project_id: number;
  activity_id: number;
  week_start: string;
  work_done?: string | null;
  blockers?: string | null;
  next_steps?: string | null;
  progress_status: string;
  percent_complete: number;
  logged_by?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  author?: { user_id: number; full_name?: string; username?: string } | null;
}

export interface ActivityWeek {
  activity_id: number;
  activity_name: string;
  project_id: number;
  project_name: string;
  project_number?: string | null;
  status?: string | null;
  planned_start?: string | null;
  planned_finish?: string | null;
  responsible_user_id?: number | null;
  responsible_name?: string | null;
  expected_output?: string | null;
  kpi?: string | null;
  log?: WeeklyLogEntry | null;
}

export interface WeekBoard {
  week_start: string;
  week_end: string;
  due: number;
  logged: number;
  activities: ActivityWeek[];
}

export interface ComplianceRow {
  project_id: number;
  project_name: string;
  project_number?: string | null;
  due: number;
  logged: number;
  blocked: number;
  not_worked_on: number;
  missing: { activity_id: number; activity_name: string }[];
}

export const PROGRESS_STATUSES = ['On Track', 'Delayed', 'Blocked', 'Not Worked On', 'Completed'];

/** The Monday of the week a date falls in, as YYYY-MM-DD. */
export const mondayOf = (d: Date): string => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export const shiftWeeks = (isoMonday: string, weeks: number): string => {
  const [y, m, d] = isoMonday.split('-').map(Number);
  const x = new Date(y, m - 1, d);
  x.setDate(x.getDate() + weeks * 7);
  return mondayOf(x);
};

/** "8 – 14 Sep 2026" */
export const weekLabel = (startIso: string, endIso: string): string => {
  const f = (iso: string, opts: Intl.DateTimeFormatOptions) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', opts);
  };
  return `${f(startIso, { day: 'numeric' })} – ${f(endIso, { day: 'numeric', month: 'short', year: 'numeric' })}`;
};

const weeklyLogService = {
  myWeek: async (weekStart: string): Promise<WeekBoard> =>
    (await api.get('/weekly-logs/my-week/', { params: { week_start: weekStart } })).data,

  projectWeek: async (projectId: number, weekStart: string): Promise<WeekBoard> =>
    (await api.get(`/weekly-logs/project/${projectId}/`, { params: { week_start: weekStart } })).data,

  history: async (activityId: number): Promise<WeeklyLogEntry[]> =>
    (await api.get(`/weekly-logs/activity/${activityId}/`)).data,

  compliance: async (weekStart: string) =>
    (await api.get('/weekly-logs/compliance/', { params: { week_start: weekStart } })).data as {
      week_start: string; week_end: string; due: number; logged: number; blocked: number;
      projects: ComplianceRow[];
    },

  submit: async (payload: {
    activity_id: number;
    week_start: string;
    work_done: string;
    blockers: string;
    next_steps: string;
    progress_status: string;
    percent_complete: number;
  }): Promise<WeeklyLogEntry> => (await api.post('/weekly-logs/', payload)).data,
};

export default weeklyLogService;
