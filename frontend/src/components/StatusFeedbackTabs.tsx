import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CalendarRange, ClipboardList } from 'lucide-react';

/** Who may open the all-logs report. The server enforces the same list. */
export const REPORT_ROLES = ['admin', 'executive'];

const TABS = [
  { to: '/status-feedback', label: 'Weekly board', icon: CalendarRange },
  { to: '/status-feedback/report', label: 'All logs report', icon: ClipboardList },
];

/** Switches between the weekly board and the report. Renders nothing for anyone else. */
export const StatusFeedbackTabs: React.FC = () => {
  const { pathname } = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (!REPORT_ROLES.includes(user.role)) return null;

  return (
    <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 rounded-2xl p-1.5 border border-slate-200 dark:border-white/10 w-fit mb-8">
      {TABS.map(({ to, label, icon: Icon }) => {
        const active = pathname.replace(/\/$/, '') === to;
        return (
          <Link
            key={to}
            to={to}
            className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
              active
                ? 'bg-white dark:bg-white/10 text-accent-primary shadow-sm'
                : 'text-slate-500 hover:text-accent-primary'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </Link>
        );
      })}
    </div>
  );
};
