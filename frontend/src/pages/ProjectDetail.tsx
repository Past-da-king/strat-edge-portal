import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Calendar, 
  Target, 
  TrendingUp, 
  AlertTriangle,
  Download,
  Users,
  Clock,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RefreshCw,
  Info,
  Zap,
  ShieldAlert,
  FileText,
  Plus,
  ArrowUpRight,
  FileIcon,
  Search,
  Filter
} from 'lucide-react';
import projectService from '../services/projectService';
import riskService from '../services/riskService';
import api from '../services/api';
import { FinancialChart } from '../components/FinancialChart';
import { BurndownChart } from '../components/BurndownChart';
import { CostBreakdown } from '../components/CostBreakdown';
import { ProjectHealth } from '../components/ProjectHealth';
import { GanttChart } from '../components/GanttChart';
import { Modal } from '../components/Modal';
import { CustomSelect } from '../components/CustomSelect';

export const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // -- GLOBAL STATE --
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [project, setProject] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [burndown, setBurndown] = useState<any>(null);
  const [taskBurndown, setTaskBurndown] = useState<any>(null);
  const [spending, setSpending] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [burndownType, setBurndownType] = useState<'budget' | 'activity'>('budget');

  // -- MODAL STATE --
  const [activeModal, setActiveModal] = useState<'timeline' | 'financials' | 'milestones' | 'risks' | 'deliverables' | null>(null);

  const fetchAllData = async (projectId: number) => {
    try {
      setRefreshing(true);
      const [projRes, metricsRes, burnRes, taskBurnRes, spendingRes, tasksRes, riskRes, delRes, allProjRes] = await Promise.all([
        projectService.getProject(projectId),
        projectService.getProjectMetrics(projectId),
        projectService.getBurndownData(projectId),
        projectService.getTaskBurndownData(projectId),
        api.get(`/projects/${projectId}/spending-breakdown/`),
        api.get(`/tasks/project/${projectId}/`),
        api.get(`/risks/`),
        api.get(`/repository/project/${projectId}/`),
        projectService.getProjects()
      ]);
      
      setProject(projRes);
      setMetrics(metricsRes);
      setBurndown(burnRes);
      setTaskBurndown(taskBurnRes);
      setSpending(spendingRes.data);
      setTasks(tasksRes.data);
      setRisks(riskRes.data.filter((r: any) => r.project_id === projectId));
      setDeliverables(delRes.data);
      setAllProjects(allProjRes);
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (id) fetchAllData(Number(id));
  }, [id]);

  const handleProjectChange = (newId: number) => {
    navigate(`/projects/${newId}`);
  };

  const handleRefresh = () => {
    if (id) fetchAllData(Number(id));
  };

  const handleDownloadFile = async (fileId: number, fileName: string) => {
    try {
      const res = await api.get(`/tasks/output/${fileId}/blob/`);
      alert(`Initiating secure download for: ${fileName}\nPath: ${res.data.blob_path}`);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <Loader2 className="w-16 h-16 text-accent-primary animate-spin opacity-40" />
        <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-xs">Synchronizing Intelligence...</p>
      </div>
    </div>
  );

  if (!project) return <div className="p-20 text-center text-white">Project not found</div>;

  // -- LOGIC CALCULATIONS --
  const openRisks = risks.filter(r => r.status === 'Open');
  const criticalRisks = openRisks.filter(r => r.impact === 'H');
  const riskColor = criticalRisks.length > 0 ? 'text-rose-500' : (openRisks.length > 0 ? 'text-amber-500' : 'text-emerald-500');
  
  const scheduleStatus = metrics?.schedule_health || 'Green';
  const budgetStatus = metrics?.health || 'Green';
  const riskStatus = criticalRisks.length > 0 ? 'Red' : (openRisks.length > 0 ? 'Yellow' : 'Green');

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'Complete').length;
  const activeTasks = tasks.filter(t => t.status === 'Active').length;
  const notStartedTasks = tasks.filter(t => t.status === 'Not Started').length;

  return (
    <div className="p-8 pb-24 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      
      {/* 1. GLOBAL IDENTITY & CONTROLS */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 mb-12">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate('/projects')}
            className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all group"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">{project.project_name}</h1>
              {refreshing && <RefreshCw className="w-5 h-5 text-accent-primary animate-spin" />}
            </div>
            <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.3em]">
              {project.project_number} • {project.client} • {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="w-72">
            <CustomSelect 
              value={project.project_id}
              onChange={handleProjectChange}
              options={allProjects.map(p => ({ value: p.project_id, label: `${p.project_number} - ${p.project_name}` }))}
            />
          </div>
          <button 
            onClick={handleRefresh}
            className="px-6 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button 
            onClick={() => projectService.downloadProjectPDF(project.project_id, project.project_name)}
            className="px-6 py-3.5 bg-accent-primary hover:bg-accent-secondary text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl shadow-accent-primary/20"
          >
            <Download className="w-4 h-4" /> Export Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-12">
        {/* 2. EXECUTIVE SUMMARY */}
        <div className="xl:col-span-2 glass rounded-[2.5rem] p-10 border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-1000">
            <Info className="w-64 h-64 text-white" />
          </div>
          <h3 className="text-white font-black text-[10px] uppercase tracking-[0.3em] mb-8 opacity-50 flex items-center gap-2">
            <Info className="w-4 h-4 text-accent-primary" /> Strategic Intelligence Summary
          </h3>
          <div className="relative z-10">
            <p className="text-2xl text-slate-200 font-medium leading-relaxed max-w-4xl">
              The project <span className="text-white font-black">{project.project_name}</span> is currently in <span className="text-accent-primary font-black uppercase tracking-tight">{project.status}</span> status. 
              Physical completion is estimated at <span className="text-white font-black">{metrics?.percent_complete || 0}%</span>. 
              Financial performance shows we are <span className={metrics?.health === 'Red' ? 'text-rose-500 font-black' : 'text-emerald-500 font-black'}>
                {metrics?.health === 'Red' ? 'exceeding' : 'well within'} budget
              </span> with a forecasted completion cost of <span className="text-white font-black">R {metrics?.total_budget?.toLocaleString() || 0}</span>.
            </p>
          </div>
        </div>

        {/* 2. HEALTH MATRIX */}
        <div className="xl:col-span-1">
          <ProjectHealth 
            schedule={scheduleStatus as any} 
            budget={budgetStatus as any} 
            risk={riskStatus as any} 
          />
        </div>
      </div>

      {/* 3. CORE EXECUTION METRICS (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <KPICard 
          label="Contract Budget" 
          value={`R ${metrics?.total_budget?.toLocaleString() || 0}`} 
          icon={<Briefcase className="w-5 h-5 text-indigo-400" />} 
          color="border-indigo-500/50" 
        />
        <KPICard 
          label="Actual Costs" 
          value={`R ${metrics?.spent?.toLocaleString() || 0}`} 
          icon={<TrendingUp className="w-5 h-5 text-emerald-400" />} 
          color="border-emerald-500/50" 
        />
        <KPICard 
          label="Budget Utilization" 
          value={`${metrics?.budget_used_pct || 0}%`} 
          icon={<Zap className="w-5 h-5 text-amber-400" />} 
          color="border-amber-500/50" 
        />
        <KPICard 
          label="Financial Runway" 
          value={`R ${(metrics?.total_budget - metrics?.spent).toLocaleString()}`} 
          icon={<Clock className="w-5 h-5 text-rose-400" />} 
          color="border-rose-500/50" 
        />
      </div>

      {/* 4. VISUAL PROGRESS ANALYTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Phase Distribution */}
        <div className="glass rounded-[2.5rem] p-8 border border-white/5">
          <h3 className="text-white font-black text-[10px] uppercase tracking-[0.3em] mb-10 opacity-50">Volume of Work Analysis</h3>
          <div className="space-y-8">
            <ProgressBar label="Not Started" pct={(notStartedTasks/totalTasks)*100} color="bg-rose-500" value={notStartedTasks} />
            <ProgressBar label="In Progress" pct={(activeTasks/totalTasks)*100} color="bg-amber-500" value={activeTasks} />
            <ProgressBar label="Complete" pct={(completedTasks/totalTasks)*100} color="bg-emerald-500" value={completedTasks} />
          </div>
        </div>

        {/* Financial Benchmark */}
        <div className="glass rounded-[2.5rem] p-8 border border-white/5">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-white font-black text-[10px] uppercase tracking-[0.3em] opacity-50">Financial Benchmark</h3>
            <button onClick={() => setActiveModal('financials')} className="text-accent-primary hover:text-white transition-colors">
              <ArrowUpRight className="w-5 h-5" />
            </button>
          </div>
          <FinancialChart 
            budget={metrics?.total_budget || 0} 
            spent={metrics?.spent || 0} 
            forecast={metrics?.total_budget || 0} 
          />
        </div>

        {/* Cost Composition */}
        <div className="glass rounded-[2.5rem] p-8 border border-white/5">
          <h3 className="text-white font-black text-[10px] uppercase tracking-[0.3em] mb-8 opacity-50">Cost Composition Donut</h3>
          <div className="h-[240px]">
            <CostBreakdown data={spending} />
          </div>
        </div>
      </div>

      {/* 5. BURNDOWN ANALYTICS (TABBED) */}
      <div className="glass rounded-[2.5rem] p-10 border border-white/5 mb-12">
        <div className="flex items-center justify-between mb-10">
          <h3 className="text-white font-black text-[10px] uppercase tracking-[0.3em] opacity-50">Performance Velocity & Burn</h3>
          <div className="flex p-1 bg-black/40 rounded-xl border border-white/5">
            <button 
              onClick={() => setBurndownType('budget')}
              className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${burndownType === 'budget' ? 'bg-accent-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Budget Burn
            </button>
            <button 
              onClick={() => setBurndownType('activity')}
              className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${burndownType === 'activity' ? 'bg-accent-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Activity Velocity
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            {burndownType === 'budget' ? (
              <BurndownChart ideal={burndown?.ideal || []} actual={burndown?.actual || []} type="budget" />
            ) : (
              <BurndownChart ideal={taskBurndown?.ideal || []} actual={taskBurndown?.actual || []} type="tasks" />
            )}
          </div>
          <div className="lg:col-span-1 space-y-6">
            <div className="p-6 bg-white/5 rounded-[2rem] border border-white/5">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Days Remaining</p>
              <p className="text-4xl font-black text-white tracking-tighter">
                {project.target_end_date ? Math.max(0, Math.ceil((new Date(project.target_end_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24))) : 0}
              </p>
            </div>
            <div className={`p-6 rounded-[2rem] border border-white/5 ${metrics?.health === 'Green' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Budget Status</p>
              <p className={`text-xl font-black uppercase tracking-tight ${metrics?.health === 'Green' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {metrics?.health === 'Green' ? 'On Track' : 'Over Budget'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 6 & 7. MILESTONES & DELIVERABLES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Upcoming Milestones */}
        <div className="glass rounded-[2.5rem] p-10 border border-white/5">
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-white font-black text-[10px] uppercase tracking-[0.3em] opacity-50 flex items-center gap-2">
              <Target className="w-4 h-4" /> Major Execution Milestones
            </h3>
            <button onClick={() => setActiveModal('milestones')} className="text-accent-primary hover:text-white transition-colors">
              <ArrowUpRight className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-4">
            {tasks.filter(t => t.status !== 'Complete').slice(0, 4).map((task, i) => (
              <div key={i} className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/[0.08] transition-all">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${task.status === 'Active' ? 'bg-amber-500 animate-pulse' : 'bg-slate-600'}`} />
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-tight">{task.activity_name}</p>
                    <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[8px] font-black uppercase rounded border border-indigo-500/20 mt-1 inline-block">
                      {task.responsible?.full_name || 'Unassigned'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-mono text-slate-500">{task.planned_finish}</p>
                  <p className={`text-[10px] font-black uppercase mt-1 ${task.status === 'Active' ? 'text-amber-500' : 'text-slate-600'}`}>{task.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Task Deliverables */}
        <div className="glass rounded-[2.5rem] p-10 border border-white/5">
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-white font-black text-[10px] uppercase tracking-[0.3em] opacity-50 flex items-center gap-2">
              <FileIcon className="w-4 h-4 text-emerald-500" /> Recent Task Deliverables
            </h3>
            <button onClick={() => setActiveModal('deliverables')} className="text-accent-primary hover:text-white transition-colors">
              <ArrowUpRight className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-4">
            {deliverables.slice(0, 4).map((file, i) => (
              <div key={i} className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 group">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 flex-shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-200 truncate uppercase tracking-tight">{file.file_name}</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">BY {file.uploader_name} • {new Date(file.upload_date).toLocaleDateString()}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleDownloadFile(file.output_id, file.file_name)}
                  className="p-3 bg-white/5 hover:bg-emerald-500 text-slate-400 hover:text-white rounded-xl border border-white/10 transition-all"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            ))}
            {deliverables.length === 0 && <div className="py-20 text-center text-slate-600 uppercase font-black tracking-widest opacity-20 italic">No Deliverables Uploaded</div>}
          </div>
        </div>
      </div>

      {/* 8. RISK REGISTER SUMMARY */}
      <div className="glass rounded-[2.5rem] p-10 border border-white/5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="flex-1">
            <h3 className="text-white font-black text-[10px] uppercase tracking-[0.3em] mb-10 opacity-50">Risk Impact Monitor</h3>
            <div className="space-y-6">
              {risks.slice(0, 2).map((risk, i) => (
                <div key={i} className="flex items-start gap-6 border-b border-white/5 pb-6 last:border-0 last:pb-0">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    risk.impact === 'H' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 
                    risk.impact === 'M' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 
                    'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  }`}>
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-slate-200 font-bold text-lg leading-tight uppercase tracking-tight mb-2">{risk.description}</p>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed italic uppercase tracking-tighter">PLAN: {risk.mitigation_action || 'Continuous Monitoring'}</p>
                  </div>
                </div>
              ))}
              {risks.length === 0 && <p className="text-slate-600 uppercase font-black tracking-widest opacity-30 italic py-10">No Strategic Risks Identified</p>}
            </div>
          </div>

          <div className="lg:w-96 space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Active Risks</p>
                <p className={`text-4xl font-black ${riskColor} tracking-tighter`}>{openRisks.length}</p>
              </div>
              <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Critical</p>
                <p className="text-4xl font-black text-rose-500 tracking-tighter">{criticalRisks.length}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex justify-between">
                <span>Exposure Spectrum</span>
                <span className="text-slate-400">{risks.length} TOTAL</span>
              </p>
              <div className="flex h-3 w-full rounded-full bg-white/5 overflow-hidden">
                <div style={{ width: `${(risks.filter(r => r.impact === 'H').length/risks.length)*100}%` }} className="bg-rose-500" />
                <div style={{ width: `${(risks.filter(r => r.impact === 'M').length/risks.length)*100}%` }} className="bg-amber-500" />
                <div style={{ width: `${(risks.filter(r => r.impact === 'L').length/risks.length)*100}%` }} className="bg-emerald-500" />
              </div>
              <div className="flex justify-between text-[8px] font-black text-slate-600 uppercase tracking-widest pt-1">
                <span>HIGH</span>
                <span>MEDIUM</span>
                <span>LOW</span>
              </div>
            </div>

            <button 
              onClick={() => setActiveModal('risks')}
              className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/10 font-black text-[10px] uppercase tracking-[0.2em] transition-all"
            >
              Full Register Analysis
            </button>
          </div>
        </div>
      </div>

      {/* MODALS */}
      <Modal isOpen={activeModal === 'risks'} onClose={() => setActiveModal(null)} title="STRATEGIC RISK REGISTER">
         <div className="space-y-4 p-4 max-h-[70vh] overflow-y-auto">
            {risks.map((r, i) => (
              <div key={i} className="glass p-6 rounded-2xl border border-white/5">
                <div className="flex justify-between mb-4">
                  <span className="text-xs font-black text-accent-primary uppercase tracking-widest">RISK ID: {r.risk_id}</span>
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${r.impact === 'H' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {r.impact}-IMPACT
                  </span>
                </div>
                <p className="text-white font-bold text-lg mb-2 uppercase">{r.description}</p>
                <p className="text-slate-400 text-sm leading-relaxed">{r.mitigation_action}</p>
              </div>
            ))}
         </div>
      </Modal>

      <Modal isOpen={activeModal === 'milestones'} onClose={() => setActiveModal(null)} title="FULL PROJECT MILESTONES">
         <div className="p-4 max-h-[70vh] overflow-y-auto">
            <GanttChart tasks={tasks} />
         </div>
      </Modal>

    </div>
  );
};

// -- HELPER COMPONENTS --

const KPICard = ({ label, value, icon, color }: { label: string; value: string; icon: any; color: string }) => (
  <div className={`glass p-8 rounded-[2rem] border-l-4 ${color} shadow-xl relative group hover:scale-[1.02] transition-all duration-500`}>
    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">{label}</p>
    <p className="text-2xl font-black text-white tracking-tighter">{value}</p>
  </div>
);

const ProgressBar = ({ label, pct, color, value }: { label: string; pct: number; color: string; value: number }) => (
  <div className="space-y-3">
    <div className="flex justify-between items-end">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <span className="text-xs font-black text-white">{value} <span className="opacity-30 text-[10px] font-medium ml-1">UNITS</span></span>
    </div>
    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
      <div 
        className={`h-full ${color} rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(0,0,0,0.5)]`} 
        style={{ width: `${isNaN(pct) ? 0 : pct}%` }} 
      />
    </div>
  </div>
);

export default ProjectDetail;
