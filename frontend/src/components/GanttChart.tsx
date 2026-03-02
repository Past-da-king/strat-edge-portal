import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Calendar, Link as LinkIcon, Info, Clock } from 'lucide-react';

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
  compact?: boolean;
}

export const GanttChart: React.FC<GanttChartProps> = ({ tasks, fullScreen = false, compact = false }) => {
  const [hoveredTask, setHoveredTask] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

  const chartData = useMemo(() => {
    if (!tasks || tasks.length === 0) return null;

    const dates = tasks.flatMap(t => [new Date(t.planned_start), new Date(t.planned_finish)]);
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    // Add margin to the timeline
    minDate.setDate(minDate.getDate() - 5);
    maxDate.setDate(maxDate.getDate() + 5);
    
    const totalDays = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24) || 1;

    // Generate date ticks for X-axis
    const ticks = [];
    const tickCount = fullScreen ? 10 : 0;
    for (let i = 0; i <= tickCount; i++) {
      const tickDate = new Date(minDate.getTime() + (i / tickCount) * totalDays * 24 * 60 * 60 * 1000);
      ticks.push(tickDate);
    }

    return { minDate, maxDate, totalDays, ticks };
  }, [tasks, fullScreen]);

  if (!chartData || tasks.length === 0) return (
    <div className="h-full flex items-center justify-center text-slate-500 italic text-[10px] uppercase tracking-widest font-black opacity-20">No data for timeline.</div>
  );

  const { minDate, maxDate, totalDays, ticks } = chartData;

  const getLeft = (dateStr: string) => {
    const date = new Date(dateStr);
    return ((date.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;
  };

  const getWidth = (start: string, finish: string) => {
    const s = new Date(start);
    const f = new Date(finish);
    return ((f.getTime() - s.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;
  };

  // Logic for Today's line
  const today = new Date();
  const todayLeft = getLeft(today.toISOString().split('T')[0]);
  const showToday = today >= minDate && today <= maxDate;

  const handleMouseEnter = (e: React.MouseEvent, index: number) => {
    if (compact) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ top: rect.top, left: rect.left + rect.width / 2 });
    setHoveredTask(index);
  };

  if (fullScreen) {
    return (
      <div className="flex flex-col h-full bg-[#0a0a0c]">
        {/* Main Chart Area */}
        <div className="flex-1 flex overflow-hidden border border-white/5 rounded-2xl bg-white/[0.01]">
          {/* Y-AXIS: Task Names */}
          <div className="w-64 flex-shrink-0 border-r border-white/5 bg-black/20 flex flex-col">
            <div className="h-12 border-b border-white/5 flex items-center px-4">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Project Activity</span>
            </div>
            <div className="flex-1 flex flex-col justify-between py-2">
              {tasks.map((task, i) => (
                <div key={i} className="flex-1 flex items-center px-4 group hover:bg-white/5 transition-colors">
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tight line-clamp-1 group-hover:text-white">{task.activity_name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* TIMELINE AREA */}
          <div className="flex-1 relative overflow-hidden flex flex-col">
            {/* Grid Lines */}
            <div className="absolute inset-0 flex justify-between pointer-events-none opacity-20">
              {ticks.map((_, i) => (
                <div key={i} className="w-px h-full bg-white/10" />
              ))}
            </div>

            {/* Today's Dotted Line */}
            {showToday && (
              <div 
                className="absolute top-0 bottom-0 w-px border-l-2 border-dashed border-accent-primary z-10 pointer-events-none"
                style={{ left: `${todayLeft}%` }}
              >
                <div className="bg-accent-primary text-white text-[8px] font-black px-1.5 py-0.5 rounded absolute top-0 -translate-x-1/2 uppercase tracking-widest">Today</div>
              </div>
            )}

            {/* Header / Space */}
            <div className="h-12 border-b border-white/5" />

            {/* Bars Area */}
            <div className="flex-1 flex flex-col justify-between py-2 relative">
              {tasks.map((task, i) => (
                <div 
                  key={i} 
                  className="flex-1 flex items-center relative group"
                  onMouseEnter={(e) => handleMouseEnter(e, i)}
                  onMouseLeave={() => setHoveredTask(null)}
                >
                  <div 
                    className={`absolute h-[40%] rounded-full shadow-lg transition-all duration-500 ring-1 ring-white/10 group-hover:h-[50%] ${
                      task.status === 'Complete' ? 'bg-emerald-500 shadow-emerald-500/20' :
                      task.status === 'Active' ? 'bg-amber-500 shadow-amber-500/20' :
                      'bg-slate-700'
                    }`}
                    style={{ 
                      left: `${getLeft(task.planned_start)}%`, 
                      width: `${Math.max(getWidth(task.planned_start, task.planned_finish), 1)}%` 
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* X-AXIS: Dates at bottom */}
        <div className="h-12 flex items-center pl-64 relative border-t border-white/5 mt-2">
          <div className="flex-1 flex justify-between px-1">
            {ticks.map((date, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="w-px h-2 bg-slate-700 mb-1" />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                  {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Hover Tooltip */}
        {hoveredTask !== null && (
          <div 
            className="fixed -translate-x-1/2 z-[9999] w-[280px] bg-[#1a1d23]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl animate-in fade-in zoom-in duration-200 pointer-events-none"
            style={{ top: `${tooltipPos.top - 160}px`, left: `${tooltipPos.left}px` }}
          >
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5">
              <Clock className="w-3.5 h-3.5 text-accent-primary" />
              <p className="text-white font-bold text-[11px] uppercase tracking-tight">{tasks[hoveredTask].activity_name}</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-400">Owner: <span className="text-white font-bold">{tasks[hoveredTask].responsible?.full_name || 'Unassigned'}</span></p>
              <p className="text-[10px] text-slate-400">Range: <span className="text-white font-bold font-mono">{tasks[hoveredTask].planned_start} to {tasks[hoveredTask].planned_finish}</span></p>
              <p className="text-[10px] text-slate-400">Status: <span className={`font-black ${tasks[hoveredTask].status === 'Complete' ? 'text-emerald-500' : 'text-amber-500'}`}>{tasks[hoveredTask].status}</span></p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- DASHBOARD COMPACT VIEW ---
  return (
    <div className="flex flex-col h-full space-y-4">
      {tasks.map((task, i) => (
        <div key={i} className="group relative">
          <div className="flex justify-between items-center mb-1.5 px-1">
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-tight truncate flex-1 mr-4 group-hover:text-accent-primary transition-colors">
              {task.activity_name}
            </span>
            <span className="text-[8px] font-mono text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
              {task.planned_finish}
            </span>
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full relative overflow-hidden ring-1 ring-white/5">
            <div 
              className={`absolute h-full rounded-full transition-all duration-1000 ${
                task.status === 'Complete' ? 'bg-emerald-500' :
                task.status === 'Active' ? 'bg-amber-500' :
                'bg-slate-700'
              }`}
              style={{ 
                left: `${getLeft(task.planned_start)}%`, 
                width: `${Math.max(getWidth(task.planned_start, task.planned_finish), 1)}%` 
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
