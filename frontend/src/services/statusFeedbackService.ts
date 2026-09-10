import api from './api';

/**
 * Status feedback - the weekly write-up against a live activity.
 *
 * Every week is named by its Monday. The backend snaps whatever date it is
 * given to that Monday, but the UI sends Mondays anyway so what is on screen
 * and what is stored are never a day apart.
 */

export interface StatusFeedbackEntry {
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
  has_account?: boolean;
  expected_output?: string | null;
  kpi?: string | null;
  log?: StatusFeedbackEntry | null;
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

/** The executive + admin report over every log. Empty strings mean "all". */
export interface ReportFilters {
  project_id: string;
  person_id: string;
  progress_status: string;
  date_from: string;
  date_to: string;
}

export const NO_REPORT_FILTERS: ReportFilters = {
  project_id: '', person_id: '', progress_status: '', date_from: '', date_to: '',
};

export interface ReportEntry {
  log_id: number;
  week_start: string;
  week_end: string;
  project_id: number;
  project_name: string;
  project_number?: string | null;
  project_archived: boolean;
  activity_id: number;
  activity_name: string;
  activity_status?: string | null;
  responsible_user_id?: number | null;
  responsible_name?: string | null;
  logged_by?: number | null;
  author_name: string;
  author_role?: string | null;
  progress_status: string;
  percent_complete: number;
  work_done?: string | null;
  blockers?: string | null;
  next_steps?: string | null;
  updated_at?: string | null;
  days_ago?: number | null;
}

export interface StatusFeedbackReport {
  generated_at: string;
  quiet_after_days: number;
  filters: Record<keyof ReportFilters, string | number | null>;
  summary: {
    total: number;
    people_reporting: number;
    projects_reporting: number;
    blocked: number;
    delayed: number;
    not_worked_on: number;
    by_status: Record<string, number>;
    latest: {
      log_id: number; days_ago?: number | null; author_name: string;
      project_name: string; activity_name: string; progress_status: string;
    } | null;
    people: {
      user_id?: number | null; full_name?: string | null; role?: string | null;
      entries: number; blocked: number; projects: number; days_ago?: number | null;
    }[];
    projects: {
      project_id: number; project_name: string; project_number?: string | null; archived: boolean;
      entries: number; blocked: number; people: number; days_ago?: number | null;
    }[];
    quiet: {
      user_id: number; full_name: string; role?: string | null;
      open_activities: number; days_quiet?: number | null;
    }[];
  };
  entries: ReportEntry[];
  options: {
    projects: { project_id: number; project_name: string; project_number?: string | null; archived: boolean }[];
    people: { user_id: number; full_name: string; role?: string | null }[];
    statuses: string[];
  };
}

const reportParams = (f: ReportFilters) =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));

/** "today", "yesterday", "5 days ago" - counted by the server, so no timezone drift. */
export const daysAgoLabel = (days?: number | null): string =>
  days == null ? 'never' : days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;

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

const statusFeedbackService = {
  myWeek: async (weekStart: string): Promise<WeekBoard> =>
    (await api.get('/status-feedback/my-week/', { params: { week_start: weekStart } })).data,

  projectWeek: async (projectId: number, weekStart: string): Promise<WeekBoard> =>
    (await api.get(`/status-feedback/project/${projectId}/`, { params: { week_start: weekStart } })).data,

  history: async (activityId: number): Promise<StatusFeedbackEntry[]> =>
    (await api.get(`/status-feedback/activity/${activityId}/`)).data,

  compliance: async (weekStart: string) =>
    (await api.get('/status-feedback/compliance/', { params: { week_start: weekStart } })).data as {
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
  }): Promise<StatusFeedbackEntry> => (await api.post('/status-feedback/', payload)).data,

  report: async (filters: ReportFilters): Promise<StatusFeedbackReport> =>
    (await api.get('/status-feedback/report/', { params: reportParams(filters) })).data,

  /** The token rides in a header, so a plain <a href> cannot fetch it - pull the blob and save it. */
  downloadReport: async (format: 'csv' | 'pdf', filters: ReportFilters): Promise<void> => {
    const res = await api.get('/status-feedback/report/export/', {
      params: { ...reportParams(filters), format },
      responseType: 'blob',
    });
    const match = /filename="?([^";]+)"?/.exec(res.headers['content-disposition'] || '');
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', match?.[1] || `status-feedback-report.${format}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default statusFeedbackService;
