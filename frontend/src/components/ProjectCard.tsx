
import React from 'react';
import { TrendingUp, Calendar, Users, AlertCircle } from 'lucide-react';

interface ProjectCardProps {
  project_name: string;
  project_number: string;
  client: string;
  total_budget: number;
  spent: number;
  percentComplete: number;
  health: 'Green' | 'Yellow' | 'Red';
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project_name, project_number, client, total_budget, spent, percentComplete, health
}) => {
  const healthColors = {
    Green: 'bg-emerald-500',
    Yellow: 'bg-amber-500',
    Red: 'bg-rose-500'
  };

  return (
    <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-accent-primary/50 transition-all cursor-pointer group shadow-lg">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-slate-900 dark:text-white font-bold text-lg group-hover:text-accent-primary transition-colors">{project_name}</h3>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-mono uppercase tracking-tighter">{project_number} • {client}</p>
        </div>
        <div className={`w-3 h-3 rounded-full ${healthColors[health]} shadow-[0_0_8px_rgba(0,0,0,0.5)]`} />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-slate-100 dark:bg-black/20 p-2 rounded-lg border border-slate-200 dark:border-slate-800/50">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">Budget</p>
          <p className="text-accent-primary font-bold text-sm">R {(total_budget/1000).toFixed(0)}k</p>
        </div>
        <div className="bg-slate-100 dark:bg-black/20 p-2 rounded-lg border border-slate-200 dark:border-slate-800/50">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">Spent</p>
          <p className="text-slate-900 dark:text-white font-bold text-sm">R {(spent/1000).toFixed(0)}k</p>
        </div>
        <div className="bg-slate-100 dark:bg-black/20 p-2 rounded-lg border border-slate-200 dark:border-slate-800/50">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">Status</p>
          <p className="text-emerald-500 font-bold text-sm">{percentComplete}%</p>
        </div>
      </div>

      <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
        <div 
          className="bg-gradient-to-r from-accent-primary to-accent-secondary h-full transition-all duration-1000" 
          style={{ width: `${percentComplete}%` }}
        />
      </div>
    </div>
  );
};
