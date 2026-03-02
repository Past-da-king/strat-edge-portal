import React from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  Zap, 
  ShieldAlert,
  Clock,
  Layout
} from 'lucide-react';

interface ProjectHealthProps {
  schedule: 'Green' | 'Red';
  budget: 'Green' | 'Yellow' | 'Red';
  risk: 'Green' | 'Yellow' | 'Red';
}

export const ProjectHealth: React.FC<ProjectHealthProps> = ({ schedule, budget, risk }) => {
  const getStatusConfig = (status: string) => {
    if (status === 'Green') return { color: 'bg-emerald-500', shadow: 'shadow-emerald-500/20', icon: <CheckCircle2 className="w-5 h-5" /> };
    if (status === 'Yellow') return { color: 'bg-amber-500', shadow: 'shadow-amber-500/20', icon: <AlertCircle className="w-5 h-5" /> };
    return { color: 'bg-rose-500', shadow: 'shadow-rose-500/20', icon: <AlertCircle className="w-5 h-5" /> };
  };

  const indicators = [
    { label: 'Scope', status: 'Green', icon: <Layout className="w-4 h-4 text-slate-400" /> },
    { label: 'Schedule', status: schedule, icon: <Clock className={`w-4 h-4 text-slate-400 ${schedule === 'Red' ? 'animate-pulse' : ''}`} /> },
    { label: 'Budget', status: budget, icon: <Zap className="w-4 h-4 text-slate-400" /> },
    { label: 'Risk', status: risk, icon: <ShieldAlert className="w-4 h-4 text-slate-400" /> },
  ];

  return (
    <div className="flex justify-between items-center bg-white/5 border border-white/5 rounded-[2rem] p-10 h-full">
      {indicators.map((ind, i) => {
        const config = getStatusConfig(ind.status);
        return (
          <div key={i} className="flex flex-col items-center gap-4 flex-1 group">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl transition-all duration-500 group-hover:scale-110 ${config.color} ${config.shadow}`}>
              {config.icon}
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-slate-300 transition-colors">{ind.label}</span>
              <span className={`text-[9px] font-black uppercase mt-1 ${
                ind.status === 'Green' ? 'text-emerald-500' : ind.status === 'Yellow' ? 'text-amber-500' : 'text-rose-500'
              }`}>{ind.status}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
