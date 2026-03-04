import React, { useEffect, useState } from 'react';
import { 
  LayoutDashboard, 
  Loader2, 
  BarChart3, 
  Target, 
  TrendingUp, 
  CheckCircle2,
  ArrowUpRight,
  Download,
  FileText
} from 'lucide-react';
import projectService from '../services/projectService';
import { ProjectCard } from '../components/ProjectCard';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export const Overview: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPortfolio = async () => {
      console.log("DEBUG: Overview fetching portfolio. User in storage:", localStorage.getItem('user'));
      try {
        const data = await projectService.getProjects();
        setProjects(data);
      } catch (err) {
        console.error("DEBUG: Portfolio fetch failed", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPortfolio();
  }, []);

  const handleDownloadReport = async (projectId: number, projectName: string) => {
    try {
      await projectService.downloadProjectPDF(projectId, projectName);
    } catch (err) {
      console.error('Failed to download report', err);
    }
  };

  if (loading) return (
    <div className="flex h-full items-center justify-center py-20">
      <Loader2 className="w-12 h-12 text-accent-primary animate-spin" />
    </div>
  );

  const stats = {
    totalProjects: projects.length,
    totalBudget: projects.reduce((acc, p) => acc + p.total_budget, 0),
    totalSpent: projects.reduce((acc, p) => acc + p.spent, 0),
    avgCompletion: projects.length > 0 
      ? Math.round(projects.reduce((acc, p) => acc + p.percent_complete, 0) / projects.length) 
      : 0
  };

  return (
    <div className="p-8 pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-accent-primary to-accent-secondary rounded-3xl p-10 mb-10 shadow-2xl shadow-accent-primary/20 relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-8">
          <div className="w-24 h-24 bg-white/10 rounded-[2rem] backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
            <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain drop-shadow-2xl" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">Portal Overview</h1>
            </div>
            <p className="text-white/70 font-bold text-sm uppercase tracking-[0.2em] max-w-lg">Strategic Project Performance & Intelligence</p>
          </div>
        </div>
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
      </div>

      {/* Top Level Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <StatCard label="Total Projects" value={stats.totalProjects.toString()} icon={<Target className="w-5 h-5" />} />
        <StatCard label="Portfolio Budget" value={`R ${(stats.totalBudget / 1000000).toFixed(1)}M`} icon={<BarChart3 className="w-5 h-5" />} />
        <StatCard label="Total Spent" value={`R ${(stats.totalSpent / 1000000).toFixed(1)}M`} icon={<TrendingUp className="w-5 h-5" />} />
        <StatCard label="Avg Completion" value={`${stats.avgCompletion}%`} icon={<CheckCircle2 className="w-5 h-5" />} />
      </div>

      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          Active Initiatives
          <span className="text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-1 rounded-full text-slate-500 font-mono">{projects.length}</span>
        </h2>
      </div>

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {projects.map(project => (
          <div key={project.project_id} className="space-y-4 group">
            <div onClick={() => navigate(`/projects/${project.project_id}`)}>
              <ProjectCard 
                project_name={project.project_name}
                project_number={project.project_number}
                client={project.client || 'Internal'}
                total_budget={project.total_budget}
                spent={project.spent}
                percentComplete={project.percent_complete}
                health={project.health}
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => navigate(`/projects/${project.project_id}`)}
                className="flex-1 bg-slate-100 dark:bg-white/5 hover:bg-accent-primary hover:text-white text-slate-600 dark:text-slate-400 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-slate-200 dark:border-white/5 group-hover:border-accent-primary/20"
              >
                DASHBOARD <ArrowUpRight className="w-3 h-3" />
              </button>
              <button 
                onClick={() => handleDownloadReport(project.project_id, project.project_name)}
                className="bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 py-3 px-4 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-white/5 flex items-center gap-2"
              >
                <FileText className="w-3 h-3" /> REPORT
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon }: { label: string; value: string; icon: any }) => (
  <div className="glass p-6 rounded-3xl border border-slate-200 dark:border-white/5 relative group hover:border-accent-primary/20 transition-all shadow-sm">
    <div className="w-10 h-10 bg-accent-primary/10 rounded-xl flex items-center justify-center text-accent-primary mb-4 group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
    <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
  </div>
);

export default Overview;
