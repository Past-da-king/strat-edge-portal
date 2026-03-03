import React, { useEffect, useState, useMemo } from 'react';
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
  Filter,
  Maximize2,
  Table as TableIcon,
  Layout as LayoutIcon,
  Link as LinkIcon,
  User as UserIcon,
  X
} from 'lucide-react';
import projectService from '../services/projectService';
import api from '../services/api';
import { FinancialChart } from '../components/FinancialChart';
import { BurndownChart } from '../components/BurndownChart';
import { CostBreakdown } from '../components/CostBreakdown';
import { ProjectHealth } from '../components/ProjectHealth';
import { GanttChart } from '../components/GanttChart';
import { Modal } from '../components/Modal';
import { CustomSelect } from '../components/CustomSelect';
import { DenseTable, DenseRow, DenseCell } from '../components/DenseTable';

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

  // -- FULLSCREEN / MODAL STATE --
  const [activeModal, setActiveModal] = useState<'timeline' | 'plan' | 'risks' | null>(null);

  // -- HOOKS (Must be at top level) --
  
  const activeUpcomingTasks = useMemo(() => {
    return tasks
      .filter(t => t.status !== 'Complete')
      .sort((a, b) => new Date(a.planned_start).getTime() - new Date(b.planned_start).getTime())
      .slice(0, 5);
  }, [tasks]);

  const daysRemaining = useMemo(() => {
    if (tasks.length === 0) return 0;
    const taskDates = tasks.map(t => new Date(t.planned_finish).getTime());
    const latestTaskDate = Math.max(...taskDates);
    const today = new Date('2026-03-02').getTime();
    return Math.max(0, Math.floor((latestTaskDate - today) / (1000 * 3600 * 24)));
  }, [tasks]);

  const fetchAllData = async (projectId: number) => {
    try {
      setRefreshing(true);
      const [projRes, metricsRes, burnRes, taskBurnRes, spendingRes, tasksRes, riskRes, delRes, allProjRes] = await Promise.all([
        projectService.getProject(projectId),
        projectService.getProjectMetrics(projectId),
        projectService.getBurndownData(projectId),
        projectService.getTaskBurndownData(projectId),
        api.get(`projects/${projectId}/spending-breakdown/`),
        api.get(`tasks/project/${projectId}/`),
        api.get(`risks/`),
        api.get(`repository/project/${projectId}/`),
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
      const res = await api.get(`tasks/output/${fileId}/blob/`);
      alert(`Initiating secure download for: ${fileName}`);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-accent-primary animate-spin opacity-40" />
        <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px]">Syncing Data...</p>
      </div>
    </div>
  );

  if (!project) return <div className="p-20 text-center text-white font-bold">Project not found</div>;

  // -- NON-HOOK LOGIC --
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
    <div className="p-6 pb-16 max-w-[1440px] mx-auto animate-in fade-in duration-500">
      
      {/* GLOBAL CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/projects')} className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all group">
            <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-0.5">
              <h1 className="text-2xl font-black text-white tracking-tight uppercase leading-none">{project.project_name}</h1>
              {refreshing && <RefreshCw className="w-4 h-4 text-accent-primary animate-spin" />}
            </div>
            <p className="text-slate-500 font-bold text-[9px] uppercase tracking-[0.25em]">{project.project_number} • {project.client} • {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-64"><CustomSelect value={project.project_id} onChange={handleProjectChange} options={allProjects.map(p => ({ value: p.project_id, label: `${p.project_number} - ${p.project_name}` }))}/></div>
          <button onClick={handleRefresh} className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 font-black text-[9px] uppercase tracking-widest transition-all flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
          <button onClick={() => projectService.downloadProjectPDF(project.project_id, project.project_name)} className="px-4 py-2.5 bg-accent-primary hover:bg-accent-secondary text-white rounded-lg font-black text-[9px] uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-accent-primary/10"><Download className="w-3.5 h-3.5" /> Export</button>
        </div>
      </div>

      {/* SUMMARY & HEALTH */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 glass rounded-2xl p-8 border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.04] transition-opacity duration-1000"><Info className="w-48 h-48 text-white" /></div>
          <h3 className="text-white font-black text-[9px] uppercase tracking-[0.2em] mb-6 opacity-40 flex items-center gap-2"><Info className="w-3.5 h-3.5 text-accent-primary" /> Strategic Intelligence</h3>
          <div className="relative z-10">
            <p className="text-lg text-slate-300 font-medium leading-relaxed max-w-3xl">
              The project <span className="text-white font-black">{project.project_name}</span> is currently in <span className="text-accent-primary font-black uppercase tracking-tight">{project.status}</span> status. 
              Physical completion is estimated at <span className="text-white font-black">{metrics?.percent_complete || 0}%</span>. 
              Financial performance shows we are <span className={metrics?.health === 'Red' ? 'text-rose-500 font-black' : 'text-emerald-500 font-black'}>{metrics?.health === 'Red' ? 'exceeding' : 'within'} budget</span> with a forecasted completion cost of <span className="text-white font-black">R {metrics?.total_budget?.toLocaleString() || 0}</span>.
            </p>
          </div>
        </div>
        <div className="lg:col-span-1"><ProjectHealth schedule={scheduleStatus as any} budget={budgetStatus as any} risk={riskStatus as any} /></div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard label="Contract Budget" value={`R ${metrics?.total_budget?.toLocaleString() || 0}`} icon={<Briefcase className="w-4 h-4 text-indigo-400" />} color="border-indigo-500/30" />
        <KPICard label="Actual Costs" value={`R ${metrics?.spent?.toLocaleString() || 0}`} icon={<TrendingUp className="w-4 h-4 text-emerald-400" />} color="border-emerald-500/30" />
        <KPICard label="Budget Used" value={`${metrics?.budget_used_pct || 0}%`} icon={<Zap className="w-4 h-4 text-amber-400" />} color="border-amber-500/30" />
        <KPICard label="Financial Runway" value={`R ${(metrics?.total_budget - metrics?.spent).toLocaleString()}`} icon={<Clock className="w-4 h-4 text-rose-400" />} color="border-rose-500/30" />
      </div>

      {/* ANALYTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="glass rounded-2xl p-6 border border-white/5">
          <h3 className="text-white font-black text-[9px] uppercase tracking-[0.2em] mb-8 opacity-40">Volume of Work</h3>
          <div className="space-y-6">
            <ProgressBar label="Not Started" pct={(notStartedTasks/totalTasks)*100} color="bg-rose-500" value={notStartedTasks} />
            <ProgressBar label="In Progress" pct={(activeTasks/totalTasks)*100} color="bg-amber-500" value={activeTasks} />
            <ProgressBar label="Complete" pct={(completedTasks/totalTasks)*100} color="bg-emerald-500" value={completedTasks} />
          </div>
        </div>
        <div className="glass rounded-2xl p-6 border border-white/5">
          <h3 className="text-white font-black text-[9px] uppercase tracking-[0.2em] opacity-40 mb-6">Financial Benchmark</h3>
          <FinancialChart budget={metrics?.total_budget || 0} spent={metrics?.spent || 0} forecast={metrics?.total_budget || 0} />
        </div>
        <div className="glass rounded-2xl p-6 border border-white/5">
          <h3 className="text-white font-black text-[9px] uppercase tracking-[0.2em] mb-6 opacity-40">Cost Breakdown</h3>
          <div className="h-[200px]"><CostBreakdown data={spending} /></div>
        </div>
      </div>

      {/* PERFORMANCE VELOCITY */}
      <div className="glass rounded-2xl p-8 border border-white/5 mb-8">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-white font-black text-[9px] uppercase tracking-[0.2em] opacity-40">Performance Velocity</h3>
          <div className="flex p-1 bg-black/40 rounded-lg border border-white/5">
            <button onClick={() => setBurndownType('budget')} className={`px-4 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest transition-all ${burndownType === 'budget' ? 'bg-accent-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Budget</button>
            <button onClick={() => setBurndownType('activity')} className={`px-4 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest transition-all ${burndownType === 'activity' ? 'bg-accent-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Activity</button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            <BurndownChart ideal={burndownType === 'budget' ? (burndown?.ideal || []) : (taskBurndown?.ideal || [])} actual={burndownType === 'budget' ? (burndown?.actual || []) : (taskBurndown?.actual || [])} type={burndownType === 'budget' ? 'budget' : 'tasks'} />
          </div>
          <div className="lg:col-span-1 space-y-4">
            <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Days Remaining</p>
              <p className="text-3xl font-black text-white tracking-tighter">{daysRemaining}</p>
            </div>
            <div className={`p-5 rounded-2xl border border-white/5 ${metrics?.health === 'Green' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Project Status</p>
              <p className={`text-lg font-black uppercase tracking-tight ${metrics?.health === 'Green' ? 'text-emerald-500' : 'text-rose-500'}`}>{metrics?.health === 'Green' ? 'On Track' : 'Elevated Risk'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* MILESTONES & MINI-GANTT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="glass rounded-2xl p-8 border border-white/5 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-white font-black text-[9px] uppercase tracking-[0.2em] opacity-40 flex items-center gap-2"><Target className="w-3.5 h-3.5" /> Phase Milestones</h3>
            <button onClick={() => setActiveModal('plan')} className="text-accent-primary hover:text-white transition-all flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">Full Plan <TableIcon className="w-3.5 h-3.5" /></button>
          </div>
          <div className="space-y-3 flex-1">
            {activeUpcomingTasks.map((task, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 group hover:bg-white/[0.08] transition-all">
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full ${task.status === 'Active' ? 'bg-amber-500 animate-pulse' : 'bg-slate-600'}`} />
                  <div>
                    <p className="text-xs font-black text-white uppercase tracking-tight">{task.activity_name}</p>
                    <div className="flex items-center gap-2 mt-1"><span className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 text-[7px] font-black uppercase rounded border border-indigo-500/20 inline-block">{task.responsible?.full_name || 'Unassigned'}</span></div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-mono text-slate-500">{task.planned_finish}</p>
                  <p className={`text-[9px] font-black uppercase mt-0.5 ${task.status === 'Active' ? 'text-amber-500' : 'text-slate-600'}`}>{task.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-2xl p-8 border border-white/5 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-white font-black text-[9px] uppercase tracking-[0.2em] opacity-40 flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Active Logic Stream</h3>
            <button onClick={() => setActiveModal('timeline')} className="text-indigo-400 hover:text-white transition-all flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">Fullscreen <Maximize2 className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex-1"><GanttChart tasks={activeUpcomingTasks} compact={true} /></div>
        </div>
      </div>

      {/* DELIVERABLES */}
      <div className="glass rounded-2xl p-8 border border-white/5 mb-8">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-white font-black text-[9px] uppercase tracking-[0.2em] opacity-40 flex items-center gap-2"><FileIcon className="w-3.5 h-3.5 text-emerald-500" /> Project Deliverables</h3>
          <button onClick={() => navigate('/repository')} className="text-emerald-500 hover:text-white transition-all flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">Repository <ArrowUpRight className="w-3.5 h-3.5" /></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {deliverables.slice(0, 4).map((file, i) => (
            <div key={i} className="p-5 bg-white/5 rounded-xl border border-white/5 group hover:bg-white/[0.08] transition-all flex flex-col h-full justify-between">
              <div className="mb-4">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 mb-4"><FileText className="w-5 h-5" /></div>
                <p className="text-xs font-bold text-slate-200 uppercase tracking-tight mb-1 truncate">{file.file_name}</p>
                <p className="text-[8px] text-slate-500 uppercase tracking-widest leading-relaxed truncate">Task: {file.task_name}</p>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <span className="text-[8px] text-slate-600 font-black uppercase tracking-tighter truncate max-w-[100px]">BY {file.uploader_name}</span>
                <button onClick={() => handleDownloadFile(file.output_id, file.file_name)} className="p-2 bg-white/5 hover:bg-emerald-500 text-slate-400 hover:text-white rounded-lg transition-all"><Download className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
          {deliverables.length === 0 && <div className="col-span-full py-12 text-center text-slate-600 uppercase font-black tracking-[0.5em] opacity-20 italic text-[10px]">Deliverable Stream Empty</div>}
        </div>
      </div>

      {/* RISK MONITOR */}
      <div className="glass rounded-2xl p-8 border border-white/5 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="flex-1">
            <h3 className="text-white font-black text-[9px] uppercase tracking-[0.2em] mb-8 opacity-40">Exposure Monitor</h3>
            <div className="space-y-5">
              {risks.slice(0, 2).map((risk, i) => (
                <div key={i} className="flex items-start gap-4 border-b border-white/5 pb-5 last:border-0 last:pb-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${risk.impact === 'H' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : risk.impact === 'M' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}><ShieldAlert className="w-5 h-5" /></div>
                  <div>
                    <p className="text-slate-200 font-bold text-base leading-tight uppercase tracking-tight mb-1">{risk.description}</p>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic uppercase tracking-tighter">PLAN: {risk.mitigation_action || 'Monitoring'}</p>
                  </div>
                </div>
              ))}
              {risks.length === 0 && <p className="text-slate-600 uppercase font-black tracking-widest opacity-30 italic py-6 text-[10px]">No Risks Identified</p>}
            </div>
          </div>
          <div className="lg:w-80 space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Active</p>
                <p className={`text-2xl font-black ${riskColor} tracking-tighter`}>{openRisks.length}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Critical</p>
                <p className="text-2xl font-black text-rose-500 tracking-tighter">{criticalRisks.length}</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/risks', { state: { projectId: project.project_id } })} 
              className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 font-black text-[8px] uppercase tracking-[0.2em] transition-all"
            >
              Analyze Register
            </button>
          </div>
        </div>
      </div>

      {/* --- TRUE FULLSCREEN OVERLAYS --- */}

      {/* 1. TIMELINE OVERLAY */}
      {activeModal === 'timeline' && (
        <div className="fixed inset-0 z-[9999] bg-[#0a0a0c] p-10 animate-in zoom-in-95 duration-300 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-10 border-b border-white/5 pb-8">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-accent-primary/10 rounded-2xl flex items-center justify-center border border-accent-primary/20"><Clock className="w-7 h-7 text-accent-primary" /></div>
              <div>
                <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Strategic Timeline Alignment</h2>
                <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.4em]">Comprehensive Logic Stream Roadmap • Fit-to-View Oversight</p>
              </div>
            </div>
            <button onClick={() => setActiveModal(null)} className="w-14 h-14 rounded-full bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 transition-all border border-white/10 flex items-center justify-center"><X className="w-6 h-6" /></button>
          </div>
          <div className="flex-1"><GanttChart tasks={tasks} fullScreen={true} /></div>
        </div>
      )}

      {/* 2. PROJECT PLAN OVERLAY */}
      {activeModal === 'plan' && (
        <div className="fixed inset-0 z-[9999] bg-[#0a0a0c] p-10 animate-in zoom-in-95 duration-300 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-10 border-b border-white/5 pb-8">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20"><TableIcon className="w-7 h-7 text-indigo-400" /></div>
              <div>
                <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Comprehensive Project Execution Plan</h2>
                <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.4em]">Full Lifecycle Metadata • Resource Assignments • Output Benchmarks</p>
              </div>
            </div>
            <button onClick={() => setActiveModal(null)} className="w-14 h-14 rounded-full bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 transition-all border border-white/10 flex items-center justify-center"><X className="w-6 h-6" /></button>
          </div>
          <div className="flex-1 overflow-auto pr-4 custom-scrollbar">
            <DenseTable headers={['Activity / Phase', 'Assigned', 'Start', 'Finish', 'Dependencies', 'Output Requirements', 'Status']}>
              {tasks.map((task, i) => (
                <DenseRow key={i}>
                  <DenseCell flex={3}><div className="py-4 px-2 font-black text-slate-200 uppercase tracking-tight leading-tight text-sm">{task.activity_name}</div></DenseCell>
                  <DenseCell flex={1.5}><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/10 flex items-center justify-center text-[11px] font-black text-indigo-400 uppercase">{task.responsible?.full_name?.charAt(0)}</div><span className="text-xs font-bold text-slate-400 uppercase tracking-tight">{task.responsible?.full_name || 'UNASSIGNED'}</span></div></DenseCell>
                  <DenseCell><span className="font-mono text-xs text-slate-500">{task.planned_start}</span></DenseCell>
                  <DenseCell><span className="font-mono text-xs text-slate-500">{task.planned_finish}</span></DenseCell>
                  <DenseCell>{task.depends_on ? <div className="flex items-center gap-2 text-[10px] text-amber-500/60 font-black uppercase"><LinkIcon className="w-3.5 h-3.5" /> DEP-{task.depends_on}</div> : <span className="text-[10px] text-slate-700 font-black uppercase italic">Independent</span>}</DenseCell>
                  <DenseCell flex={2.5}><p className="text-[11px] text-slate-500 leading-relaxed font-medium italic">{task.expected_output || 'No baseline defined.'}</p></DenseCell>
                  <DenseCell align="right"><span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase border ${task.status === 'Complete' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : task.status === 'Active' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-white/5 text-slate-600 border-white/5'}`}>{task.status}</span></DenseCell>
                </DenseRow>
              ))}
            </DenseTable>
          </div>
        </div>
      )}

    </div>
  );
};

// -- HELPERS --

const KPICard = ({ label, value, icon, color }: { label: string; value: string; icon: any; color: string }) => (
  <div className={`glass p-6 rounded-2xl border-l-2 ${color} shadow-lg relative group hover:bg-white/[0.05] transition-all duration-300`}><div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">{icon}</div><p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] mb-0.5">{label}</p><p className="text-xl font-black text-white tracking-tighter">{value}</p></div>
);

const ProgressBar = ({ label, pct, color, value }: { label: string; pct: number; color: string; value: number }) => (
  <div className="space-y-2"><div className="flex justify-between items-end px-1"><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span><span className="text-[10px] font-black text-white">{value} <span className="opacity-30 text-[8px] font-medium ml-0.5">UNITS</span></span></div><div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden"><div className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${isNaN(pct) ? 0 : pct}%` }} /></div></div>
);

export default ProjectDetail;
