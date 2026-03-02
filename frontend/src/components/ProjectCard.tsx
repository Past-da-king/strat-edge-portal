
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
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 hover:border-cyan-500/50 transition-all cursor-pointer group shadow-lg">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-white font-bold text-lg group-hover:text-cyan-400 transition-colors">{project_name}</h3>
          <p className="text-slate-500 text-xs font-mono uppercase tracking-tighter">{project_number} • {client}</p>
        </div>
        <div className={`w-3 h-3 rounded-full ${healthColors[health]} shadow-[0_0_8px_rgba(0,0,0,0.5)]`} />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-black/20 p-2 rounded-lg border border-slate-800/50">
          <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Budget</p>
          <p className="text-cyan-400 font-bold text-sm">R {(total_budget/1000).toFixed(0)}k</p>
        </div>
        <div className="bg-black/20 p-2 rounded-lg border border-slate-800/50">
          <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Spent</p>
          <p className="text-white font-bold text-sm">R {(spent/1000).toFixed(0)}k</p>
        </div>
        <div className="bg-black/20 p-2 rounded-lg border border-slate-800/50">
          <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Status</p>
          <p className="text-emerald-400 font-bold text-sm">{percentComplete}%</p>
        </div>
      </div>

      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
        <div 
          className="bg-gradient-to-r from-cyan-600 to-blue-500 h-full transition-all duration-1000" 
          style={{ width: `${percentComplete}%` }}
        />
      </div>
    </div>
  );
};
