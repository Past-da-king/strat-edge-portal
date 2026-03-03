import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LabelList
} from 'recharts';

interface FinancialChartProps {
  budget: number;
  spent: number;
  forecast: number;
}

export const FinancialChart: React.FC<FinancialChartProps> = ({ budget, spent, forecast }) => {
  const data = [
    { name: 'Budget', value: budget, color: '#1e293b' },
    { name: 'Forecast', value: forecast, color: '#7c3aed' },
    { name: 'Actual', value: spent, color: '#0891b2' },
  ];

  const formatCurrency = (val: number) => `R ${(val / 1000).toFixed(0)}k`;

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <XAxis type="number" hide />
          <YAxis 
            dataKey="name" 
            type="category" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#94a3b8', fontSize: 12 }}
          />
          <Tooltip 
            cursor={{ fill: 'transparent' }}
            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
            formatter={(value: any) => [formatCurrency(Number(value)), 'Value']}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
            <LabelList 
              dataKey="value" 
              position="right" 
              formatter={(val: any) => formatCurrency(Number(val))} 
              style={{ fill: '#fff', fontSize: '10px', fontWeight: 'bold' }} 
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
