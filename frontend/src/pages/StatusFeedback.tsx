import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarRange, ChevronLeft, ChevronRight, Loader2, CheckCircle2, CircleAlert,
  Ban, PauseCircle, Save, History, Users, FolderOpen, X,
} from 'lucide-react';
import api from '../services/api';
import { CustomSelect } from '../components/CustomSelect';
import { Modal } from '../components/Modal';
import statusFeedbackService, {
  ActivityWeek, ComplianceRow, PROGRESS_STATUSES, WeekBoard, StatusFeedbackEntry,
  mondayOf, shiftWeeks, weekLabel,
} from '../services/statusFeedbackService';

const MANAGER_ROLES = ['admin', 'pm', 'executive'];

const STATUS_STYLE: Record<string, string> = {
  'On Track': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'Delayed': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  'Blocked': 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  'Not Worked On': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  'Completed': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
};

const STATUS_ICON: Record<string, any> = {
  'On Track': CheckCircle2,
  'Delayed': CircleAlert,
  'Blocked': Ban,
  'Not Worked On': PauseCircle,
  'Completed': CheckCircle2,
};

const fmtDay = (iso?: string | null) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
};

/** One activity's status for the week. Collapsed until it is being filled in. */
const LogCard: React.FC<{
  item: ActivityWeek;
  weekStart: string;
  onSaved: () => void;
  onHistory: (item: ActivityWeek) => void;
}> = ({ item, weekStart, onSaved, onHistory }) => {
  const existing = item.log;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    work_done: existing?.work_done || '',
    blockers: existing?.blockers || '',
    next_steps: existing?.next_steps || '',
    progress_status: existing?.progress_status || 'On Track',
    percent_complete: existing?.percent_complete ?? 0,
  });

  useEffect(() => {
    setForm({
      work_done: item.log?.work_done || '',
      blockers: item.log?.blockers || '',
      next_steps: item.log?.next_steps || '',
      progress_status: item.log?.progress_status || 'On Track',
      percent_complete: item.log?.percent_complete ?? 0,
    });
    setOpen(false);
    setError('');
  }, [item.activity_id, weekStart, item.log?.log_id, item.log?.updated_at]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await statusFeedbackService.submit({ activity_id: item.activity_id, week_start: weekStart, ...form });
      setOpen(false);
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not save this week. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const Icon = STATUS_ICON[existing?.progress_status || ''] || CalendarRange;

  return (
    <div
      className={`rounded-[1.5rem] border transition-all overflow-hidden ${
        existing
          ? 'border-slate-200 dark:border-white/5 bg-white/60 dark:bg-white/[0.02]'
          : 'border-amber-500/30 bg-amber-500/[0.04]'
      }`}
    >
      <div className="p-6 flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-accent-secondary">
              {item.project_number || item.project_name}
            </span>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
              {fmtDay(item.planned_start)} → {fmtDay(item.planned_finish)}
            </span>
            {item.responsible_name && (
              <span
                className={`text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-1 ${
                  item.has_account === false ? 'text-rose-400' : 'text-slate-400'
                }`}
                title={item.has_account === false
                  ? 'Named on the project plan but has no portal account yet - a manager has to answer for this one'
                  : undefined}
              >
                <Users className="w-3 h-3" /> {item.responsible_name}
                {item.has_account === false && ' · no account yet'}
              </span>
            )}
          </div>
          <h3 className="font-black text-slate-800 dark:text-slate-100 tracking-tight leading-snug">
            {item.activity_name}
          </h3>
          {existing ? (
            <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
              {existing.work_done || <em>Marked as not worked on.</em>}
            </p>
          ) : (
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 mt-2">
              No status given for this week yet
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {existing && (
            <span
              className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border flex items-center gap-1.5 ${
                STATUS_STYLE[existing.progress_status] || STATUS_STYLE['On Track']
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {existing.progress_status} · {existing.percent_complete}%
            </span>
          )}
          <button
            onClick={() => onHistory(item)}
            title="Week-by-week history"
            className="p-3 rounded-xl text-slate-400 hover:text-accent-primary hover:bg-accent-primary/10 transition-all"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            onClick={() => setOpen(!open)}
            className={`px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${
              existing
                ? 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-accent-primary/10 hover:text-accent-primary'
                : 'bg-accent-primary text-white hover:opacity-90'
            }`}
          >
            {open ? 'Close' : existing ? 'Edit' : 'Give Status'}
          </button>
        </div>
      </div>

      {open && (
        <div className="px-6 pb-6 pt-2 border-t border-slate-200 dark:border-white/5 space-y-5">
          {item.kpi && (
            <p className="text-[11px] text-slate-500 italic leading-relaxed">
              <span className="font-black uppercase tracking-[0.2em] text-[9px] not-italic text-slate-400">
                Measured by ·{' '}
              </span>
              {item.kpi}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <CustomSelect
              label="How is it going?"
              value={form.progress_status}
              onChange={(v) => setForm({ ...form, progress_status: v })}
              options={PROGRESS_STATUSES.map((s) => ({ value: s, label: s }))}
            />
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 px-1">
                Percent complete · {form.percent_complete}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={form.percent_complete}
                onChange={(e) => setForm({ ...form, percent_complete: Number(e.target.value) })}
                className="w-full accent-accent-primary mt-4"
              />
            </div>
          </div>

          <Field
            label="What was done this week?"
            hint="Plain words. What actually moved."
            value={form.work_done}
            onChange={(v) => setForm({ ...form, work_done: v })}
          />
          <Field
            label="What is in the way?"
            hint="Blockers, waiting-ons, anything that stopped it. Leave empty if nothing."
            value={form.blockers}
            onChange={(v) => setForm({ ...form, blockers: v })}
          />
          <Field
            label="Next week"
            hint="What happens next on this activity."
            value={form.next_steps}
            onChange={(v) => setForm({ ...form, next_steps: v })}
          />

          {error && (
            <p className="text-xs text-rose-500 font-bold bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="bg-accent-primary text-white px-8 py-4 rounded-[1.25rem] font-black uppercase tracking-widest text-[10px] flex items-center gap-3 hover:opacity-90 disabled:opacity-40 transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Status
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; hint: string; value: string; onChange: (v: string) => void }> = ({
  label, hint, value, onChange,
}) => (
  <div>
    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 px-1">
      {label}
    </label>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      placeholder={hint}
      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-accent-primary transition-colors resize-y"
    />
  </div>
);

const Stat: React.FC<{ label: string; value: React.ReactNode; color?: string }> = ({ label, value, color }) => (
  <div className="glass rounded-[1.5rem] p-6 border border-slate-200 dark:border-white/5">
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2">{label}</p>
    <p className={`text-4xl font-black tracking-tighter ${color || 'text-slate-800 dark:text-white'}`}>{value}</p>
  </div>
);

export const StatusFeedback: React.FC = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isManager = MANAGER_ROLES.includes(user.role);

  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [scope, setScope] = useState<'mine' | number>('mine');
  const [projects, setProjects] = useState<any[]>([]);
  const [board, setBoard] = useState<WeekBoard | null>(null);
  const [compliance, setCompliance] = useState<{ due: number; logged: number; blocked: number; projects: ComplianceRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<{ item: ActivityWeek; entries: StatusFeedbackEntry[] } | null>(null);

  const thisWeek = mondayOf(new Date());

  useEffect(() => {
    api.get('/projects/').then((r) => setProjects(r.data)).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [b, c] = await Promise.all([
        scope === 'mine'
          ? statusFeedbackService.myWeek(weekStart)
          : statusFeedbackService.projectWeek(scope as number, weekStart),
        statusFeedbackService.compliance(weekStart).catch(() => null),
      ]);
      setBoard(b);
      setCompliance(c as any);
    } catch (e) {
      console.error(e);
      setBoard(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [weekStart, scope]);

  const openHistory = async (item: ActivityWeek) => {
    const entries = await statusFeedbackService.history(item.activity_id);
    setHistory({ item, entries });
  };

  const outstanding = useMemo(
    () => (board ? board.activities.filter((a) => !a.log) : []),
    [board]
  );

  const scopeOptions = [
    { value: 'mine', label: 'My active activities' },
    ...projects.map((p: any) => ({ value: String(p.project_id), label: p.project_name })),
  ];

  return (
    <div className="p-8">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter flex items-center gap-4">
            <div className="w-12 h-12 bg-accent-primary/10 rounded-2xl flex items-center justify-center border border-accent-primary/20">
              <CalendarRange className="w-7 h-7 text-accent-primary" />
            </div>
            STATUS FEEDBACK
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] ml-16">
            Every week, on every activity you are assigned: what happened, what is in the way
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <CustomSelect
            value={String(scope)}
            onChange={(v) => setScope(v === 'mine' ? 'mine' : Number(v))}
            options={scopeOptions}
            className="w-56"
          />
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 rounded-2xl p-1.5 border border-slate-200 dark:border-white/10">
            <button
              onClick={() => setWeekStart(shiftWeeks(weekStart, -1))}
              className="p-3 rounded-xl hover:bg-white dark:hover:bg-white/10 text-slate-500 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-4 text-center min-w-[168px]">
              <p className="text-xs font-black text-slate-700 dark:text-slate-200 tracking-tight">
                {board ? weekLabel(board.week_start, board.week_end) : '—'}
              </p>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                {weekStart === thisWeek ? 'This week' : weekStart > thisWeek ? 'Upcoming' : 'Past week'}
              </p>
            </div>
            <button
              onClick={() => setWeekStart(shiftWeeks(weekStart, 1))}
              className="p-3 rounded-xl hover:bg-white dark:hover:bg-white/10 text-slate-500 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {weekStart !== thisWeek && (
            <button
              onClick={() => setWeekStart(thisWeek)}
              className="px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-accent-primary bg-accent-primary/10 border border-accent-primary/20 hover:bg-accent-primary/20 transition-all"
            >
              Today
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <Stat label="Due this week" value={board?.due ?? '—'} />
        <Stat label="Status given" value={board?.logged ?? '—'} color="text-emerald-500" />
        <Stat label="Outstanding" value={outstanding.length} color={outstanding.length ? 'text-amber-500' : undefined} />
        <Stat
          label={isManager ? 'Blocked (portfolio)' : 'Blocked'}
          value={compliance?.blocked ?? 0}
          color={compliance?.blocked ? 'text-rose-500' : undefined}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-40">
          <Loader2 className="w-16 h-16 text-accent-primary animate-spin opacity-20" />
        </div>
      ) : !board || board.activities.length === 0 ? (
        <div className="glass rounded-[2rem] p-16 border border-slate-200 dark:border-white/5 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500/40 mx-auto mb-5" />
          <p className="font-black uppercase tracking-widest text-sm text-slate-500">
            No active activities this week
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Nothing {scope === 'mine' ? 'assigned to you' : 'on this project'} is scheduled across these dates.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {board.activities.map((a) => (
            <LogCard
              key={a.activity_id}
              item={a}
              weekStart={board.week_start}
              onSaved={load}
              onHistory={openHistory}
            />
          ))}
        </div>
      )}

      {isManager && compliance && compliance.projects.length > 0 && (
        <div className="mt-14">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-5 flex items-center gap-2">
            <FolderOpen className="w-4 h-4" /> Coverage across the portfolio
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {compliance.projects.map((p) => {
              const pct = p.due ? Math.round((p.logged / p.due) * 100) : 100;
              return (
                <div key={p.project_id} className="glass rounded-[1.5rem] p-6 border border-slate-200 dark:border-white/5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-accent-secondary">
                        {p.project_number}
                      </p>
                      <h3 className="font-black text-slate-800 dark:text-slate-100 tracking-tight truncate">
                        {p.project_name}
                      </h3>
                    </div>
                    <span className={`text-2xl font-black tracking-tighter ${pct === 100 ? 'text-emerald-500' : pct >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                      {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden mb-4">
                    <div
                      className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    {p.logged} of {p.due} logged
                    {p.blocked > 0 && <span className="text-rose-500"> · {p.blocked} blocked</span>}
                    {p.not_worked_on > 0 && <span className="text-slate-400"> · {p.not_worked_on} not worked on</span>}
                  </p>
                  {p.missing.length > 0 && (
                    <ul className="mt-4 space-y-1.5">
                      {p.missing.slice(0, 4).map((m) => (
                        <li key={m.activity_id} className="text-xs text-slate-500 flex items-start gap-2 leading-snug">
                          <X className="w-3 h-3 text-rose-500/60 mt-0.5 shrink-0" />
                          {m.activity_name}
                        </li>
                      ))}
                      {p.missing.length > 4 && (
                        <li className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-5">
                          + {p.missing.length - 4} more
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal
        isOpen={!!history}
        onClose={() => setHistory(null)}
        title={history?.item.activity_name || ''}
        size="lg"
      >
        <div className="space-y-4">
          {history?.entries.length === 0 && (
            <p className="text-sm text-slate-500 italic">No weeks have been logged against this activity yet.</p>
          )}
          {history?.entries.slice().reverse().map((e) => (
            <div key={e.log_id} className="rounded-2xl border border-slate-200 dark:border-white/5 p-5">
              <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Week of {fmtDay(e.week_start)} · {e.author?.full_name || 'Unknown'}
                </p>
                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${STATUS_STYLE[e.progress_status]}`}>
                  {e.progress_status} · {e.percent_complete}%
                </span>
              </div>
              {e.work_done && <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{e.work_done}</p>}
              {e.blockers && (
                <p className="text-xs text-rose-500 mt-3 leading-relaxed">
                  <span className="font-black uppercase tracking-[0.2em] text-[9px]">Blocked by · </span>
                  {e.blockers}
                </p>
              )}
              {e.next_steps && (
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  <span className="font-black uppercase tracking-[0.2em] text-[9px] text-slate-400">Next · </span>
                  {e.next_steps}
                </p>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default StatusFeedback;
