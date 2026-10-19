import api from './api';

/**
 * Tender briefs - filed by the tender watcher, read here.
 *
 * The watcher posts a batch to /tenders/ingest/ and the Portal is where a
 * person reads them, shortlists one or calls it a no-bid. Nothing on this page
 * writes: the status a brief carries is the watcher's, plus whatever a future
 * edit route allows.
 */

export interface TenderDocument {
  name: string;
  url?: string | null;
  local_path?: string | null;
  size_bytes?: number | null;
}

export interface TenderBrief {
  id: string;
  title: string;
  reference?: string | null;
  source?: string | null;
  source_url?: string | null;
  slack_url?: string | null;
  buyer?: string | null;
  category?: string | null;
  published?: string | null;
  closing?: string | null;
  days_to_close?: number | null;
  amount?: string | null;
  summary?: string | null;
  requirements?: string[] | null;
  documents?: TenderDocument[] | null;
  relevance_score?: number | null;
  relevance_reason?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/** The filters the API takes. Empty means "no filter". */
export interface TenderFilters {
  status: string;
  days: string;   // '' | '7' | '14' | '30'
  q: string;
}

export const NO_TENDER_FILTERS: TenderFilters = { status: '', days: '', q: '' };

export const TENDER_STATUSES = ['new', 'shortlisted', 'bid', 'no-bid'];

/** Whole days from today to an ISO date. Negative means the tender has closed. */
export const daysLeft = (closing?: string | null): number | null => {
  if (!closing) return null;
  const end = new Date(`${closing}T00:00:00`);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / 86400000);
};

/** 2026-10-23 as 23 Oct 2026. */
export const fmtDate = (iso?: string | null): string => {
  const d = daysLeft(iso) === null ? null : new Date(`${iso}T00:00:00`);
  if (!d) return '-';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const daysLeftLabel = (closing?: string | null): string => {
  const n = daysLeft(closing);
  if (n === null) return '-';
  if (n < 0) return 'closed';
  if (n === 0) return 'today';
  return `${n} day${n === 1 ? '' : 's'}`;
};

const toParams = (filters: Partial<TenderFilters>) => {
  const params: Record<string, string | number> = {};
  if (filters.status) params.status = filters.status;
  if (filters.days) params.max_days_to_close = Number(filters.days);
  if (filters.q && filters.q.trim()) params.q = filters.q.trim();
  return params;
};

const tenderService = {
  getTenders: async (filters: Partial<TenderFilters> = {}): Promise<TenderBrief[]> => {
    const res = await api.get('/tenders', { params: toParams(filters) });
    return res.data;
  },
  getTender: async (id: string): Promise<TenderBrief> => {
    const res = await api.get(`/tenders/${id}/`);
    return res.data;
  },
  /** The one thing a person owns on a brief. Everything else is the watcher's. */
  setStatus: async (id: string, status: string): Promise<TenderBrief> => {
    const res = await api.patch(`/tenders/${id}/status/`, { status });
    return res.data;
  },
};

export default tenderService;
