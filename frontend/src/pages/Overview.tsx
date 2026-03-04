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
import { useNavigate } from 'react-router-dom';
import projectService from '../services/projectService';
import { ProjectCard } from '../components/ProjectCard';

export const Overview: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const userStr = localStorage.getItem('user');
  const user = JSON.parse(userStr || '{}');

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        const res = await projectService.getProjects();
        setProjects(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPortfolio();
  }, []);

  const handleDownloadReport = async (projectId: number, projectName: string) => {
    await projectService.downloadProjectPDF(projectId, projectName);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center py-40">
        <Loader2 className="w-12 h-12 text-accent-primary animate-spin" />
      </div>
    );
  }

  // Calculate high-level stats
  const totalBudget = projects.reduce((sum, p) => sum + (p.total_budget || 0), 0);
  const totalSpent = projects.reduce((sum, p) => sum + (p.spent || 0), 0);
  const avgCompletion = projects.length > 0 
    ? Math.round(projects.reduce((sum, p) => sum + (p.percent_complete || 0), 0) / projects.length)
    : 0;

  return (
    <div className="p-4 lg:p-8 animate-in fade-in duration-700 max-w-full overflow-x-hidden">
      {/* Hero Section - Truly Responsive */}
      <div className="relative mb-10 lg:mb-12">
        <div className="bg-gradient-to-br from-accent-primary to-blue-600 rounded-[2rem] lg:rounded-[3rem] p-8 lg:p-16 text-white overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 lg:w-96 h-64 lg:h-96 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <div className="flex items-center gap-3 mb-4 lg:mb-6">
              <div className="w-8 h-8 lg:w-10 lg:h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-md">
                <BarChart3 className="w-5 h-5 lg:w-6 lg:h-6" />
              </div>
              <span className="text-[10px] lg:text-xs font-black uppercase tracking-[0.3em] opacity-80">Portfolio Intelligence</span>
            </div>
            <h1 className="text-4xl lg:text-7xl font-black tracking-tighter uppercase leading-[0.9] mb-4 lg:mb-6">
              Portal<br />Overview
            </h1>
            <p className="text-sm lg:text-xl font-medium opacity-90 leading-relaxed uppercase tracking-tight">
              Strategic project performance & intelligence for <span className="font-black underline decoration-2 underline-offset-4">{user.full_name}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Portfolio Quick Stats - Grid adaptation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-10 lg:mb-16">
        <StatCard label="Total Projects" value={projects.length.toString()} icon={<LayoutDashboard />} />
        <StatCard label="Portfolio Value" value={`R ${(totalBudget/1000000).toFixed(1)}M`} icon={<TrendingUp />} />
        <StatCard label="Execution Status" value={`${avgCompletion}%`} icon={<Target />} />
        <StatCard label="Health Check" value="98.2%" icon={<CheckCircle2 />} />
      </div>

      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          Active Initiatives
          <span className="text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-1 rounded-full text-slate-500 font-mono">{projects.length}</span>
        </h2>
      </div>

      {/* Project Grid - Dynamic spacing */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
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
                className="flex-1 bg-slate-100 dark:bg-white/5 hover:bg-accent-primary hover:text-white text-slate-600 dark:text-slate-400 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all flex items-center justify-center gap-2 border border-slate-200 dark:border-white/5 group-hover:border-accent-primary/20"
              >
                DASHBOARD <ArrowUpRight className="w-3 h-3" />
              </button>
              <button 
                onClick={() => handleDownloadReport(project.project_id, project.project_name)}
                className="bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 py-3 px-4 rounded-xl text-[10px] font-black tracking-widest transition-all border border-slate-200 dark:border-white/5 flex items-center gap-2"
              >
                <FileText className="w-3 h-3" />
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
