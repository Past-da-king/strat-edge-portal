import React, { useEffect, useState } from 'react';
import {
  ClipboardList, Loader2, Users, FolderOpen, BellOff, CheckCircle2, FileSpreadsheet, FileText,
  FilterX, CalendarRange, Archive,
} from 'lucide-react';
import { CustomSelect } from '../components/CustomSelect';
import { StatusFeedbackTabs } from '../components/StatusFeedbackTabs';
import statusFeedbackService, {
  NO_REPORT_FILTERS, ReportEntry, ReportFilters, StatusFeedbackReport as Report, daysAgoLabel,
} from '../services/statusFeedbackService';
import { STATUS_ICON, STATUS_STYLE, fmtDay } from './StatusFeedback';

const Stat: React.FC<{ label: string; value: React.ReactNode; sub?: React.ReactNode; color?: string }> = ({
  label, value, sub, color,
}) => (
  <div className="glass rounded-[1.5rem] p-6 border border-slate-200 dark:border-white/5 min-w-0">
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2">{label}</p>
    <p className={`text-4xl font-black tracking-tighter truncate ${color || 'text-slate-800 dark:text-white'}`}>{value}</p>
    {sub && <p className="text-[11px] text-slate-500 mt-2 leading-snug line-clamp-2">{sub}</p>}
  </div>
);

const Panel: React.FC<{ title: string; icon: any; children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
  <div className="glass rounded-[2rem] p-6 border border-slate-200 dark:border-white/5 min-w-0">
    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-5 flex items-center gap-2">
      <Icon className="w-4 h-4" /> {title}
    </h2>
    {children}
  </div>
);

const Quiet: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs text-slate-400 italic leading-relaxed">{children}</p>
);

const DateField: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div>
    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 px-1">{label}</label>
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-3 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-accent-primary transition-colors [color-scheme:light] dark:[color-scheme:dark]"
    />
  </div>
);

/** One log. The write-up is clamped until it is clicked open. */
const EntryRow: React.FC<{ e: ReportEntry }> = ({ e }) => {
  const [open, setOpen] = useState(false);
  const Icon = STATUS_ICON[e.progress_status] || CalendarRange;
  const long = (e.work_done || '').length + (e.blockers || '').length + (e.next_steps || '').length > 220;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[96px_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)_176px_minmax(0,2.2fr)] gap-2 lg:gap-4 px-5 py-5 border-b border-slate-200 dark:border-white/5 last:border-0 items-start">
      <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 lg:pt-0.5">
        {fmtDay(e.week_start)}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-accent-secondary truncate">
          {e.project_number || '—'}
        </p>
        <p className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-snug">
          {e.project_name}
          {e.project_archived && (
            <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-slate-400">· archived</span>
          )}
        </p>
      </div>
      <p className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight leading-snug min-w-0">
        {e.activity_name}
      </p>
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{e.author_name}</p>
        {e.responsible_name && e.responsible_name !== e.author_name && (
          <p className="text-[10px] text-slate-400 leading-snug">for {e.responsible_name}</p>
        )}
        <p className="text-[10px] text-slate-400">updated {daysAgoLabel(e.days_ago)}</p>
      </div>
      <div>
        <span
          className={`inline-flex px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border items-center gap-1.5 whitespace-nowrap ${
            STATUS_STYLE[e.progress_status] || STATUS_STYLE['On Track']
          }`}
        >
          <Icon className="w-3.5 h-3.5" /> {e.progress_status} · {e.percent_complete}%
        </span>
      </div>
      <div
        className={`min-w-0 text-xs leading-relaxed space-y-1.5 ${long ? 'cursor-pointer' : ''}`}
        onClick={() => long && setOpen(!open)}
        title={long ? (open ? 'Click to collapse' : 'Click to read it all') : undefined}
      >
        <p className={`text-slate-600 dark:text-slate-300 whitespace-pre-line break-words ${open ? '' : 'line-clamp-3'}`}>
          {e.work_done || <em className="text-slate-400">Nothing written for work done.</em>}
        </p>
        {e.blockers && (
          <p className={`text-rose-500 whitespace-pre-line break-words ${open ? '' : 'line-clamp-2'}`}>
            <span className="font-black uppercase tracking-[0.2em] text-[9px]">Blocked by · </span>
            {e.blockers}
          </p>
        )}
        {e.next_steps && (
          <p className={`text-slate-500 whitespace-pre-line break-words ${open ? '' : 'line-clamp-2'}`}>
            <span className="font-black uppercase tracking-[0.2em] text-[9px] text-slate-400">Next · </span>
            {e.next_steps}
          </p>
        )}
        {long && (
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-accent-primary">
            {open ? 'Show less' : 'Read all'}
          </p>
        )}
      </div>
    </div>
  );
};

export const StatusFeedbackReport: React.FC = () => {
  const [filters, setFilters] = useState<ReportFilters>(NO_REPORT_FILTERS);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<'csv' | 'pdf' | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    statusFeedbackService
      .report(filters)
      .then((r) => live && setReport(r))
      .catch((e) => {
        if (!live) return;
        setError(
          e?.response?.status === 403
            ? 'This report is for executives and admins only.'
            : e?.response?.data?.detail && typeof e.response.data.detail === 'string'
              ? e.response.data.detail
              : 'Could not load the report. Try again.'
        );
      })
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [filters]);

  const set = (patch: Partial<ReportFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const filtered = Object.values(filters).some((v) => v !== '');

  const download = async (format: 'csv' | 'pdf') => {
    setDownloading(format);
    try {
      await statusFeedbackService.downloadReport(format, filters);
    } catch {
      setError(`Could not build the ${format.toUpperCase()}. Try again.`);
    } finally {
      setDownloading(null);
    }
  };

  const s = report?.summary;
  const opts = report?.options;

  return (
    <div className="p-8">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter flex items-center gap-4">
            <div className="w-12 h-12 bg-accent-primary/10 rounded-2xl flex items-center justify-center border border-accent-primary/20">
              <ClipboardList className="w-7 h-7 text-accent-primary" />
            </div>
            STATUS FEEDBACK REPORT
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] ml-16">
            Every status log, by everyone, on every project · executives and admins
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {(['csv', 'pdf'] as const).map((fmt) => {
            const Icon = fmt === 'csv' ? FileSpreadsheet : FileText;
            return (
              <button
                key={fmt}
                onClick={() => download(fmt)}
                disabled={!!downloading || !report}
                className="px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-accent-primary/10 hover:text-accent-primary disabled:opacity-40 transition-all"
              >
                {downloading === fmt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                Export {fmt}
              </button>
            );
          })}
        </div>
      </div>

      <StatusFeedbackTabs />

      <div className="glass rounded-[2rem] p-6 border border-slate-200 dark:border-white/5 mb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 items-end">
          <CustomSelect
            label="Project"
            value={filters.project_id}
            onChange={(v) => set({ project_id: String(v) })}
            options={[
              { value: '', label: 'All projects' },
              ...(opts?.projects || []).map((p) => ({
                value: String(p.project_id),
                label: p.project_name + (p.archived ? ' (archived)' : ''),
              })),
            ]}
          />
          <CustomSelect
            label="Person"
            value={filters.person_id}
            onChange={(v) => set({ person_id: String(v) })}
            options={[
              { value: '', label: 'Everyone' },
              ...(opts?.people || []).map((u) => ({ value: String(u.user_id), label: u.full_name })),
            ]}
          />
          <CustomSelect
            label="Status"
            value={filters.progress_status}
            onChange={(v) => set({ progress_status: String(v) })}
            options={[
              { value: '', label: 'All statuses' },
              ...(opts?.statuses || []).map((st) => ({ value: st, label: st })),
            ]}
          />
          <DateField label="From" value={filters.date_from} onChange={(v) => set({ date_from: v })} />
          <DateField label="To" value={filters.date_to} onChange={(v) => set({ date_to: v })} />
        </div>
        {filtered && (
          <div className="flex items-center justify-between gap-4 mt-5 flex-wrap">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              {s ? `${s.total} log${s.total === 1 ? '' : 's'} match` : 'Filtering'}
            </p>
            <button
              onClick={() => setFilters(NO_REPORT_FILTERS)}
              className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-accent-primary bg-accent-primary/10 border border-accent-primary/20 hover:bg-accent-primary/20 transition-all flex items-center gap-2"
            >
              <FilterX className="w-4 h-4" /> Clear filters
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-rose-500 font-bold bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 mb-8">
          {error}
        </p>
      )}

      {!report ? (
        loading ? (
          <div className="flex justify-center py-40">
            <Loader2 className="w-16 h-16 text-accent-primary animate-spin opacity-20" />
          </div>
        ) : null
      ) : (
        <div className={`transition-opacity ${loading ? 'opacity-50' : ''}`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <Stat label="Status logs" value={s!.total} sub={`${s!.projects_reporting} project${s!.projects_reporting === 1 ? '' : 's'}`} />
            <Stat label="People reporting" value={s!.people_reporting} color="text-emerald-500" />
            <Stat
              label="Blocked · Delayed"
              value={`${s!.blocked} · ${s!.delayed}`}
              color={s!.blocked ? 'text-rose-500' : s!.delayed ? 'text-amber-500' : undefined}
              sub={s!.not_worked_on ? `${s!.not_worked_on} week${s!.not_worked_on === 1 ? '' : 's'} not worked on` : undefined}
            />
            <Stat
              label="Latest update"
              value={s!.latest ? daysAgoLabel(s!.latest.days_ago) : '—'}
              sub={s!.latest ? `${s!.latest.author_name} · ${s!.latest.activity_name}` : 'Nobody has given status yet'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            <Panel title="By person" icon={Users}>
              {s!.people.length === 0 ? (
                <Quiet>Nobody has logged anything in this view.</Quiet>
              ) : (
                <ul className="space-y-1">
                  {s!.people.map((p) => (
                    <li key={String(p.user_id)}>
                      <button
                        onClick={() => p.user_id != null && set({ person_id: String(p.user_id) })}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-accent-primary/5 text-left transition-all"
                        title="Show only this person"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{p.full_name}</span>
                          <span className="block text-[10px] text-slate-400">
                            last {daysAgoLabel(p.days_ago)} · {p.projects} project{p.projects === 1 ? '' : 's'}
                            {p.blocked > 0 && <span className="text-rose-500"> · {p.blocked} blocked</span>}
                          </span>
                        </span>
                        <span className="text-xl font-black tracking-tighter text-slate-800 dark:text-white shrink-0">{p.entries}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="By project" icon={FolderOpen}>
              {s!.projects.length === 0 ? (
                <Quiet>No project has a log in this view.</Quiet>
              ) : (
                <ul className="space-y-1">
                  {s!.projects.map((p) => (
                    <li key={p.project_id}>
                      <button
                        onClick={() => set({ project_id: String(p.project_id) })}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-accent-primary/5 text-left transition-all"
                        title="Show only this project"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
                            {p.project_name}
                            {p.archived && <Archive className="inline w-3 h-3 ml-1.5 text-slate-400" />}
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            last {daysAgoLabel(p.days_ago)} · {p.people} {p.people === 1 ? 'person' : 'people'}
                            {p.blocked > 0 && <span className="text-rose-500"> · {p.blocked} blocked</span>}
                          </span>
                        </span>
                        <span className="text-xl font-black tracking-tighter text-slate-800 dark:text-white shrink-0">{p.entries}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title={`Gone quiet · ${report.quiet_after_days}+ days`} icon={BellOff}>
              {s!.quiet.length === 0 ? (
                <p className="text-xs text-emerald-500 font-bold flex items-start gap-2 leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Everyone with open work has logged in the last {report.quiet_after_days} days.
                </p>
              ) : (
                <ul className="space-y-1">
                  {s!.quiet.map((q) => (
                    <li key={q.user_id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{q.full_name}</span>
                        <span className="block text-[10px] text-slate-400">
                          {q.open_activities} open activit{q.open_activities === 1 ? 'y' : 'ies'}
                          {q.role && ` · ${q.role}`}
                        </span>
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-rose-500 text-right shrink-0">
                        {q.days_quiet == null ? 'Never logged' : `${q.days_quiet} days`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-5 flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> All logs · {s!.total}
          </h2>

          {report.entries.length === 0 ? (
            <div className="glass rounded-[2rem] p-16 border border-slate-200 dark:border-white/5 text-center">
              <ClipboardList className="w-12 h-12 text-slate-400/40 mx-auto mb-5" />
              <p className="font-black uppercase tracking-widest text-sm text-slate-500">
                {filtered ? 'Nothing matches these filters' : 'No status logs yet'}
              </p>
              <p className="text-xs text-slate-400 mt-2">
                {filtered
                  ? 'Widen the dates or clear a filter.'
                  : 'When people give status on their activities, every entry lands here.'}
              </p>
            </div>
          ) : (
            <div className="glass rounded-[2rem] border border-slate-200 dark:border-white/5 overflow-hidden">
              <div className="hidden lg:grid grid-cols-[96px_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)_176px_minmax(0,2.2fr)] gap-4 px-5 py-4 border-b border-slate-200 dark:border-white/10">
                {['Week', 'Project', 'Activity', 'Who', 'Status', 'Comment'].map((h) => (
                  <div key={h} className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{h}</div>
                ))}
              </div>
              {report.entries.map((e) => <EntryRow key={e.log_id} e={e} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StatusFeedbackReport;
