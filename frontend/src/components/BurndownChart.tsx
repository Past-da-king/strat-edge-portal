import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Line, 
  ComposedChart 
} from 'recharts';

interface BurndownChartProps {
  ideal: { date: string; remaining: number }[];
  actual: { date: string; remaining: number }[];
  type?: 'budget' | 'tasks';
}

export const BurndownChart: React.FC<BurndownChartProps> = ({ ideal, actual, type = 'budget' }) => {
  return (
    <div className="h-[340px] w-full bg-transparent rounded-2xl">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            tickFormatter={(value) => {
               try {
                 const date = new Date(value);
                 return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
               } catch {
                 return value;
               }
            }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            tickFormatter={(value) => type === 'budget' ? `R ${value / 1000}k` : value}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f1115', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
            itemStyle={{ fontWeight: 'bold' }}
            formatter={(value: number) => type === 'budget' ? `R ${value.toLocaleString()}` : `${value} Tasks`}
          />
          <Line 
            type="monotone" 
            data={ideal} 
            dataKey="remaining" 
            stroke="#94a3b8" 
            strokeDasharray="5 5" 
            dot={false} 
            name={type === 'budget' ? "Planned Spend" : "Planned Baseline"}
          />
          <Area 
            type="monotone" 
            data={actual} 
            dataKey="remaining" 
            stroke={type === 'budget' ? "#0891b2" : "#a855f7"} 
            fillOpacity={1} 
            fill={type === 'budget' ? "url(#colorActualBudget)" : "url(#colorActualTasks)"} 
            name={type === 'budget' ? "Actual Spend" : "Actual Completion"}
          />
          <defs>
            <linearGradient id="colorActualBudget" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0891b2" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#0891b2" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorActualTasks" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
            </linearGradient>
          </defs>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
