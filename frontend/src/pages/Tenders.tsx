import React, { useEffect, useMemo, useState } from 'react';
import {
  Gavel, Loader2, Search, FilterX, ExternalLink, FileText, ChevronDown, ChevronUp, CalendarClock,
} from 'lucide-react';
import { CustomSelect } from '../components/CustomSelect';
import tenderService, {
  NO_TENDER_FILTERS, TENDER_STATUSES, TenderBrief, TenderFilters,
  daysLeft, daysLeftLabel, fmtDate,
} from '../services/tenderService';

const CLOSING_WINDOWS = [
  { value: '', label: 'Any closing date' },
  { value: '7', label: 'Closing in 7 days' },
  { value: '14', label: 'Closing in 14 days' },
  { value: '30', label: 'Closing in 30 days' },
];

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-accent-primary/10 text-accent-primary border-accent-primary/20',
  shortlisted: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  bid: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'no-bid': 'bg-slate-500/10 text-slate-500 border-slate-500/20',
};

const StatusBadge: React.FC<{ status?: string | null }> = ({ status }) => {
  const key = status || 'new';
  return (
    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${STATUS_STYLE[key] || STATUS_STYLE.new}`}>
      {key.replace('-', ' ')}
    </span>
  );
};

const ScoreBadge: React.FC<{ score?: number | null; reason?: string | null }> = ({ score, reason }) => {
  const n = score ?? 0;
  const tone = n >= 70 ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
    : n >= 40 ? 'text-amber-500 bg-amber-500/10 border-amber-500/20'
      : 'text-slate-500 bg-slate-500/10 border-slate-500/20';
  return (
    <span
      title={reason || 'Relevance score from the tender watcher'}
      className={`inline-flex items-center justify-center min-w-[36px] px-2 py-1 rounded-lg text-[11px] font-black border ${tone}`}
    >
      {n}
    </span>
  );
};

const DaysCell: React.FC<{ closing?: string | null }> = ({ closing }) => {
  const n = daysLeft(closing);
  const tone = n === null ? 'text-slate-400'
    : n < 0 ? 'text-slate-400'
      : n <= 3 ? 'text-rose-500'
        : n <= 7 ? 'text-amber-500'
          : 'text-slate-600 dark:text-slate-300';
  return <span className={`text-[11px] font-black uppercase tracking-widest ${tone}`}>{daysLeftLabel(closing)}</span>;
};

/** Document links for the row. Icons, because the names are on the detail panel. */
const DocLinks: React.FC<{ brief: TenderBrief }> = ({ brief }) => {
  const docs = brief.documents || [];
  if (!docs.length) return <span className="text-[11px] text-slate-400">-</span>;
  return (
    <div className="flex items-center justify-end gap-1.5">
      {docs.slice(0, 3).map((d, i) => (
        d.url ? (
          <a
            key={`${brief.id}-doc-${i}`}
            href={d.url}
            target="_blank"
            rel="noreferrer"
            title={d.name || 'document'}
            className="text-accent-primary hover:text-accent-secondary"
          >
            <FileText className="w-4 h-4" />
          </a>
        ) : (
          <span key={`${brief.id}-doc-${i}`} title={d.local_path || d.name || 'document'} className="text-slate-400">
            <FileText className="w-4 h-4" />
          </span>
        )
      ))}
      {docs.length > 3 && <span className="text-[10px] font-black text-slate-400">+{docs.length - 3}</span>}
    </div>
  );
};

const SourceLink: React.FC<{ brief: TenderBrief }> = ({ brief }) => (
  <div className="flex flex-col gap-1 min-w-0">
    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">{brief.source || '-'}</span>
    {brief.source_url && (
      <a
        href={brief.source_url}
        target="_blank"
        rel="noreferrer"
        className="text-[10px] font-black uppercase tracking-widest text-accent-primary hover:text-accent-secondary inline-flex items-center gap-1"
      >
        Open <ExternalLink className="w-3 h-3" />
      </a>
    )}
  </div>
);

/** Everything the row cannot show: who is asking, what they want, what is attached. */
const DetailPanel: React.FC<{ brief: TenderBrief }> = ({ brief }) => (
  <div className="px-5 pb-6 pt-2 border-t border-slate-200 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.02]">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 mb-2">Summary</p>
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-line">
          {brief.summary || 'The watcher filed no summary for this brief.'}
        </p>
        {brief.relevance_reason && (
          <p className="text-[11px] leading-relaxed text-slate-500 mt-4">
            <span className="font-black uppercase tracking-widest text-[9px] text-slate-400 mr-2">Why it scored {brief.relevance_score ?? 0}</span>
            {brief.relevance_reason}
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 min-w-0">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 mb-2">Requirements</p>
          {(brief.requirements && brief.requirements.length) ? (
            <ul className="space-y-1.5">
              {brief.requirements.map((r, i) => (
                <li key={`${brief.id}-req-${i}`} className="text-[11px] leading-snug text-slate-600 dark:text-slate-300 flex gap-2">
                  <span className="text-accent-primary mt-0.5">&#8226;</span>
                  <span className="min-w-0">{r}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-slate-400 italic">Not captured.</p>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 mb-2">Documents</p>
          {(brief.documents && brief.documents.length) ? (
            <ul className="space-y-1.5">
              {brief.documents.map((d, i) => (
                <li key={`${brief.id}-panel-doc-${i}`} className="text-[11px] leading-snug">
                  {d.url ? (
                    <a href={d.url} target="_blank" rel="noreferrer" className="text-accent-primary hover:text-accent-secondary font-bold inline-flex items-center gap-1">
                      <FileText className="w-3 h-3 shrink-0" /> {d.name || 'document'}
                    </a>
                  ) : (
                    <span className="text-slate-500 font-bold"><FileText className="w-3 h-3 inline mr-1" />{d.name || 'document'}</span>
                  )}
                  <span className="block text-[10px] text-slate-400 break-all">
                    {d.local_path || ''}
                    {d.local_path && d.size_bytes ? ' · ' : ''}
                    {d.size_bytes ? `${Math.round(d.size_bytes / 1024)} KB` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-slate-400 italic">No documents filed.</p>
          )}
        </div>
      </div>
    </div>
    <div className="flex flex-wrap gap-x-8 gap-y-2 mt-6 pt-4 border-t border-slate-200 dark:border-white/5">
      {[
        ['Category', brief.category || '-'],
        ['Published', fmtDate(brief.published)],
        ['Closing', fmtDate(brief.closing)],
        ['Reference', brief.reference || '-'],
      ].map(([label, value]) => (
        <div key={label}>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
          <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{value}</p>
        </div>
      ))}
    </div>
  </div>
);

export const Tenders: React.FC = () => {
  const [briefs, setBriefs] = useState<TenderBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<TenderFilters>(NO_TENDER_FILTERS);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  // Typing should not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === search ? f : { ...f, q: search })), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    tenderService
      .getTenders(filters)
      .then((data) => live && setBriefs(data))
      .catch((e) => {
        if (!live) return;
        setBriefs([]);
        setError(
          e?.response?.data?.detail && typeof e.response.data.detail === 'string'
            ? e.response.data.detail
            : 'Could not load the tender briefs. Try again.'
        );
      })
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [filters]);

  const set = (patch: Partial<TenderFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const filtered = !!(filters.status || filters.days || filters.q);

  const stats = useMemo(() => {
    const soon = briefs.filter((b) => {
      const n = daysLeft(b.closing);
      return n !== null && n >= 0 && n <= 7;
    }).length;
    return {
      total: briefs.length,
      soon,
      shortlisted: briefs.filter((b) => b.status === 'shortlisted').length,
      bids: briefs.filter((b) => b.status === 'bid').length,
    };
  }, [briefs]);

  return (
    <div className="p-4 lg:p-8">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8 lg:mb-10">
        <div>
          <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter flex items-center gap-3 lg:gap-4">
            <div className="w-11 h-11 lg:w-12 lg:h-12 bg-accent-primary/10 rounded-2xl flex items-center justify-center border border-accent-primary/20 shrink-0">
              <Gavel className="w-6 h-6 lg:w-7 lg:h-7 text-accent-primary" />
            </div>
            TENDERS
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] lg:ml-16">
            Briefs filed by the tender watcher, scored for Strat Edge fit
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        <StatCard label="Briefs" value={stats.total} color="text-slate-800 dark:text-white" />
        <StatCard label="Closing in 7 days" value={stats.soon} color="text-rose-500" />
        <StatCard label="Shortlisted" value={stats.shortlisted} color="text-amber-500" />
        <StatCard label="Bids in progress" value={stats.bids} color="text-emerald-500" />
      </div>

      <div className="glass rounded-[2rem] p-5 lg:p-6 border border-slate-200 dark:border-white/5 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-end">
          <CustomSelect
            label="Status"
            value={filters.status}
            onChange={(v) => set({ status: String(v) })}
            options={[{ value: '', label: 'All statuses' }, ...TENDER_STATUSES.map((s) => ({ value: s, label: s.replace('-', ' ') }))]}
          />
          <CustomSelect
            label="Closing"
            value={filters.days}
            onChange={(v) => set({ days: String(v) })}
            options={CLOSING_WINDOWS}
          />
          <div className="xl:col-span-2">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 px-1">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Title, reference or buyer"
                className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl pl-11 pr-4 py-4 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all font-bold text-sm"
              />
            </div>
          </div>
        </div>
        {filtered && (
          <div className="flex items-center justify-between gap-4 mt-5 flex-wrap">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              {loading ? 'Filtering' : `${briefs.length} brief${briefs.length === 1 ? '' : 's'} match`}
            </p>
            <button
              onClick={() => { setFilters(NO_TENDER_FILTERS); setSearch(''); }}
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

      {loading && !briefs.length ? (
        <div className="flex justify-center py-40">
          <Loader2 className="w-16 h-16 text-accent-primary animate-spin opacity-20" />
        </div>
      ) : !briefs.length ? (
        <div className="glass rounded-[2rem] p-10 lg:p-16 border border-slate-200 dark:border-white/5 text-center">
          <CalendarClock className="w-12 h-12 text-slate-300 dark:text-white/10 mx-auto mb-5" />
          <p className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-2">
            {filtered ? 'Nothing matches these filters' : 'No tender briefs yet'}
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {filtered
              ? 'Widen the closing window or clear the search.'
              : 'The tender watcher files briefs here as it finds them. Nothing has come in yet.'}
          </p>
        </div>
      ) : (
        <div className={`glass rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-2xl overflow-hidden transition-opacity ${loading ? 'opacity-50' : ''}`}>
          {/* Table, wide screens. Phone and tablet get the cards below. */}
          <div className="hidden lg:block overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_92px_72px_82px_50px_82px_42px_78px_46px] gap-2 px-4 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.02]">
                {['Tender', 'Buyer', 'Reference', 'Source', 'Closing', 'Days', 'Amount', 'Fit', 'Status', 'Docs'].map((h, i) => (
                  <div
                    key={h}
                    className={`text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ${i === 5 || i === 7 ? 'text-center' : i === 9 ? 'text-right' : ''}`}
                  >
                    {h}
                  </div>
                ))}
              </div>
              {briefs.map((b) => (
                <div key={b.id} className="border-b border-slate-200 dark:border-white/5 last:border-0">
                  <div
                    onClick={() => setOpenId(openId === b.id ? null : b.id)}
                    className="grid grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_92px_72px_82px_50px_82px_42px_78px_46px] gap-2 px-4 py-4 items-center hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      {openId === b.id ? <ChevronUp className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight leading-snug line-clamp-2">{b.title}</p>
                        {b.category && (
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-1">{b.category}</p>
                        )}
                      </div>
                    </div>
                    <p className="text-[12px] font-bold text-slate-600 dark:text-slate-300 leading-snug line-clamp-2">{b.buyer || '-'}</p>
                    <p className="text-[11px] font-bold text-slate-500 break-words">{b.reference || '-'}</p>
                    <SourceLink brief={b} />
                    <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{fmtDate(b.closing)}</p>
                    <div className="text-center"><DaysCell closing={b.closing} /></div>
                    <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 break-words">{b.amount || '-'}</p>
                    <div className="text-center"><ScoreBadge score={b.relevance_score} reason={b.relevance_reason} /></div>
                    <div><StatusBadge status={b.status} /></div>
                    <div className="text-right"><DocLinks brief={b} /></div>
                  </div>
                  {openId === b.id && <DetailPanel brief={b} />}
                </div>
              ))}
            </div>
          </div>

          {/* Cards, phone and tablet */}
          <div className="lg:hidden divide-y divide-slate-200 dark:divide-white/5">
            {briefs.map((b) => (
              <div key={b.id} className="p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight leading-snug flex-1">{b.title}</p>
                  <ScoreBadge score={b.relevance_score} reason={b.relevance_reason} />
                </div>
                <p className="text-[11px] font-bold text-slate-500 mb-3">{b.buyer || 'Buyer not listed'}</p>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <StatusBadge status={b.status} />
                  {daysLeft(b.closing) !== null && (
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                      <DaysCell closing={b.closing} />
                    </span>
                  )}
                  {b.amount && <span className="text-[11px] font-black text-slate-600 dark:text-slate-300">{b.amount}</span>}
                </div>
                <div className="grid grid-cols-2 gap-3 text-[11px] mb-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Closing</p>
                    <p className="font-bold text-slate-600 dark:text-slate-300">{fmtDate(b.closing)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Reference</p>
                    <p className="font-bold text-slate-600 dark:text-slate-300 break-words">{b.reference || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <SourceLink brief={b} />
                  <button
                    onClick={() => setOpenId(openId === b.id ? null : b.id)}
                    className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-accent-primary bg-accent-primary/10 border border-accent-primary/20 hover:bg-accent-primary/20 transition-all flex items-center gap-2 shrink-0"
                  >
                    {openId === b.id ? 'Hide' : 'Details'}
                    {openId === b.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
                {openId === b.id && <div className="mt-4 -mx-5"><DetailPanel brief={b} /></div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-400 mt-6 leading-relaxed">
        Briefs come in from the tender watcher. Tap a row for the summary, requirements and documents.
      </p>
    </div>
  );
};

const StatCard = ({ label, value, color }: { label: string; value: React.ReactNode; color: string }) => (
  <div className="glass p-5 lg:p-8 rounded-[1.5rem] lg:rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-xl group hover:border-slate-300 dark:hover:border-white/10 transition-all">
    <p className="text-[9px] lg:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 lg:mb-3">{label}</p>
    <p className={`text-3xl lg:text-5xl font-black ${color} tracking-tighter`}>{value}</p>
  </div>
);

export default Tenders;
