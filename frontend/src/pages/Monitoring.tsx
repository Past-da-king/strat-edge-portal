import React, { useEffect, useState, useMemo } from 'react';
import { 
  Activity, 
  Users, 
  HardDrive, 
  Timer, 
  BarChart3, 
  PieChart as PieIcon,
  TrendingUp,
  Loader2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import api from '../services/api';

export const Monitoring: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        const res = await api.get('/auth/audit-logs/');
        setLogs(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAudit();
  }, []);

  const stats = React.useMemo(() => {
    if (!logs) return { activeUsers: 0, fileOps: 0, authEvents: 0 };
    const activeUsers = new Set(logs.map(l => l.user_id)).size;
    const fileOps = logs.filter(l => l.category === 'FILE').length;
    const authEvents = logs.filter(l => l.category === 'AUTH').length;
    return { activeUsers, fileOps, authEvents };
  }, [logs]);

  // Derive distribution data
  const categoryData = React.useMemo(() => {
    if (!logs) return [];
    const counts: Record<string, number> = {};
    logs.forEach(l => {
      counts[l.category] = (counts[l.category] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [logs]);

  if (loading) return (
    <div className="flex h-full items-center justify-center py-20">
      <Loader2 className="w-12 h-12 text-accent-primary animate-spin" />
    </div>
  );

  const COLORS = ['#0ea5e9', '#6366f1', '#f59e0b', '#ec4899', '#10b981'];

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-accent-primary/10 rounded-xl flex items-center justify-center border border-accent-primary/20">
          <Activity className="w-7 h-7 text-accent-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Audit & Monitoring</h1>
          <p className="text-slate-500 dark:text-slate-400">Track user activity, file operations, and system utilization.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatItem label="Active Users" value={stats.activeUsers.toString()} delta="Live" icon={<Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />} />
        <StatItem label="Auth Events" value={stats.authEvents.toString()} delta="Security" icon={<Timer className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />} />
        <StatItem label="File Ops" value={stats.fileOps.toString()} delta="Transfers" icon={<HardDrive className="w-5 h-5 text-amber-600 dark:text-amber-400" />} />
        <StatItem label="Avg Latency" value="42ms" delta="Optimal" icon={<Activity className="w-5 h-5 text-rose-600 dark:text-rose-400" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="glass rounded-3xl p-8 shadow-xl">
          <h3 className="text-slate-900 dark:text-white font-bold mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent-primary" />
            System Event Log
          </h3>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
            {logs.map((log, i) => (
              <div key={i} className="flex justify-between items-center border-b border-slate-200 dark:border-white/5 pb-3 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{log.description}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">{log.category} • {log.created_at}</p>
                </div>
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-600">{log.ip_address || 'local'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-3xl p-8 shadow-xl">
          <h3 className="text-slate-900 dark:text-white font-bold mb-6 flex items-center gap-2">
            <PieIcon className="w-5 h-5 text-accent-primary" />
            Event Distribution
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff', 
                    border: 'none', 
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                  itemStyle={{ color: document.documentElement.classList.contains('dark') ? '#fff' : '#0f172a' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatItem = ({ label, value, delta, icon }: { label: string; value: string; delta: string; icon: any }) => (
  <div className="glass p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-lg group hover:border-accent-primary/20 transition-all">
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg group-hover:scale-110 transition-transform">{icon}</div>
      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-tighter">{delta}</span>
    </div>
    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
    <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
  </div>
);

export default Monitoring;
