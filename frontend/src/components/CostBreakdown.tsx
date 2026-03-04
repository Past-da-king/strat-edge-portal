import React from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Legend, 
  Tooltip 
} from 'recharts';

interface CostBreakdownProps {
  data: { category: string; amount: number }[];
}

const COLORS = ['#db2777', '#4f46e5', '#ea580c', '#059669', '#94a3b8'];

export const CostBreakdown: React.FC<CostBreakdownProps> = ({ data }) => {
  const isDark = document.documentElement.classList.contains('dark');
  
  if (!data || data.length === 0) {
    return (
      <div className="h-[240px] flex items-center justify-center text-slate-500 text-sm italic">
        No expenditure recorded.
      </div>
    );
  }

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="amount"
            nameKey="category"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: isDark ? '#1e293b' : '#fff', 
              border: isDark ? 'none' : '1px solid #e2e8f0', 
              borderRadius: '8px',
              color: isDark ? '#fff' : '#0f172a'
            }}
            itemStyle={{ color: isDark ? '#fff' : '#0f172a' }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36} 
            formatter={(value) => <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
