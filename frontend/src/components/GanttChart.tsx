import React, { useState } from 'react';
import { User, Calendar, Link as LinkIcon, Info } from 'lucide-react';

interface Task {
  activity_id: number | string;
  activity_name: string;
  planned_start: string;
  planned_finish: string;
  status: string;
  responsible?: {
    full_name: string;
  };
  depends_on?: number | string | null;
}

interface GanttChartProps {
  tasks: Task[];
  fullScreen?: boolean;
}

export const GanttChart: React.FC<GanttChartProps> = ({ tasks, fullScreen = false }) => {
  const [hoveredTask, setHoveredTask] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

  if (!tasks || tasks.length === 0) return (
    <div className="h-full flex items-center justify-center text-slate-500 italic">No tasks defined for timeline.</div>
  );

  // Find overall date range
  const dates = tasks.flatMap(t => [new Date(t.planned_start), new Date(t.planned_finish)]);
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
  const totalDays = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24) || 1;

  const getLeft = (dateStr: string) => {
    const date = new Date(dateStr);
    return ((date.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;
  };

  const getWidth = (start: string, finish: string) => {
    const s = new Date(start);
    const f = new Date(finish);
    return ((f.getTime() - s.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;
  };

  const handleMouseEnter = (e: React.MouseEvent, index: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ top: rect.top, left: rect.left + rect.width / 2 });
    setHoveredTask(index);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between text-[10px] text-slate-500 uppercase font-black px-4 mb-8 border-b border-white/5 pb-4 tracking-widest">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-accent-primary rounded-full shadow-[0_0_10px_rgba(14,165,233,0.5)]" />
          START: {minDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        <div className="flex items-center gap-3">
          FINISH: {maxDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
        </div>
      </div>
      
      <div className={`flex-1 overflow-y-auto pr-4 custom-scrollbar ${fullScreen ? 'space-y-10' : 'space-y-6'}`}>
        {tasks.map((task, i) => (
          <div 
            key={i} 
            className="group relative"
            onMouseEnter={(e) => handleMouseEnter(e, i)}
            onMouseLeave={() => setHoveredTask(null)}
          >
            <div className="flex justify-between items-center mb-2 px-1">
              <span className={`text-slate-200 font-bold tracking-tight uppercase group-hover:text-accent-primary transition-all duration-300 ${fullScreen ? 'text-sm' : 'text-[10px]'}`}>
                {task.activity_name}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-[9px] text-slate-500 font-mono bg-white/5 px-2 py-0.5 rounded border border-white/5">
                  {task.planned_start}
                </span>
              </div>
            </div>
            <div className={`${fullScreen ? 'h-4' : 'h-2.5'} w-full bg-white/5 rounded-full relative overflow-hidden ring-1 ring-white/5 transition-all group-hover:ring-white/10`}>
              <div 
                className={`absolute h-full rounded-full transition-all duration-1000 shadow-xl ${
                  task.status === 'Complete' ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' :
                  task.status === 'Active' ? 'bg-gradient-to-r from-amber-600 to-amber-400' :
                  'bg-gradient-to-r from-slate-700 to-slate-600'
                }`}
                style={{ 
                  left: `${getLeft(task.planned_start)}%`, 
                  width: `${Math.max(getWidth(task.planned_start, task.planned_finish), 1.5)}%` 
                }}
              />
            </div>

            {/* Detailed Hover Card (Page Tooltip) - Only in Full Screen */}
            {fullScreen && hoveredTask === i && (
              <div 
                className={`fixed -translate-x-1/2 z-[9999] w-[340px] bg-[#1a1d23]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in duration-200 pointer-events-none ${
                  tooltipPos.top < 300 ? 'mt-8' : 'mb-8 -translate-y-full'
                }`}
                style={{ top: `${tooltipPos.top}px`, left: `${tooltipPos.left}px` }}
              >
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
                  <div className="w-10 h-10 bg-accent-primary/10 rounded-xl flex items-center justify-center">
                    <Info className="w-5 h-5 text-accent-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Phase Detail</p>
                    <p className="text-white font-bold leading-tight">{task.activity_name}</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <User className="w-4 h-4 text-accent-secondary" />
                    <span className="font-medium text-slate-300">Responsible:</span>
                    <span className="text-white font-bold">{task.responsible?.full_name || 'Unassigned'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    <span className="font-medium text-slate-300">Timeline:</span>
                    <span className="text-white font-bold">{task.planned_start} - {task.planned_finish}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <LinkIcon className="w-4 h-4 text-amber-500" />
                    <span className="font-medium text-slate-300">Depends On:</span>
                    <span className="text-white font-bold text-[11px]">
                      {task.depends_on 
                        ? (tasks.find((t: any) => String(t.activity_id) === String(task.depends_on))?.activity_name || `ID: ${task.depends_on}`)
                        : 'None'}
                    </span>
                  </div>
                </div>
                
                <div className="mt-4 pt-3 border-t border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                      task.status === 'Complete' ? 'bg-emerald-500/10 text-emerald-500' :
                      task.status === 'Active' ? 'bg-amber-500/10 text-amber-500' :
                      'bg-slate-500/10 text-slate-500'
                    }`}>{task.status}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
