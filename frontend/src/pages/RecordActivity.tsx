import React, { useEffect, useState, useMemo } from 'react';
import { 
  Bolt, 
  Loader2, 
  Calendar, 
  User, 
  FileText, 
  Plus, 
  CheckCircle2, 
  Clock,
  Upload,
  Layout,
  AlertTriangle,
  ChevronDown,
  ArrowRight,
  Target,
  Maximize2,
  X,
  FileUp,
  Download,
  Info,
  ShieldCheck,
  Hexagon
} from 'lucide-react';
import api from '../services/api';
import projectService from '../services/projectService';
import { FileUploadZone } from '../components/FileUploadZone';
import { CustomSelect } from '../components/CustomSelect';
import { NetworkDiagram } from '../components/NetworkDiagram';
import { DenseTable, DenseRow, DenseCell } from '../components/DenseTable';

export const RecordActivity: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [diagramData, setDiagramData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');

  const [uploadModal, setUploadModal] = useState<{
    isOpen: boolean;
    activityId: number | null;
    docType: string;
  }>({ isOpen: false, activityId: null, docType: '' });

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const res = await projectService.getProjects();
        setProjects(res);
        if (res.length > 0) setSelectedProjectId(res[0].project_id);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchInitial();
  }, []);

  const fetchData = async () => {
    if (!selectedProjectId) return;
    try {
      // 1. Fetch Core Data (Crucial for page load)
      const [actRes, delRes] = await Promise.all([
        api.get(`/tasks/project/${selectedProjectId}/`),
        api.get(`/repository/project/${selectedProjectId}/`)
      ]);
      setActivities(actRes.data);
      setDeliverables(delRes.data);

      // 2. Fetch Diagram Data separately (Corrected path: network-diagram)
      try {
        const diagRes = await api.get(`/projects/${selectedProjectId}/network-diagram/`);
        setDiagramData(diagRes.data);
      } catch (diagErr) {
        console.warn('Network diagram failed to load, but activities will still show.', diagErr);
        setDiagramData(null);
      }
    } catch (err) {
      console.error('Critical data fetch failed', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedProjectId]);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleStartPhase = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await api.patch(`/tasks/${id}/status/?status=Active`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploadDraft = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setUploadModal({ isOpen: true, activityId: id, docType: 'Regular Draft' });
  };

  const handleComplete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setUploadModal({ isOpen: true, activityId: id, docType: 'Final Submission' });
  };

  const handleDownloadFile = async (id: number, name: string) => {
    try {
      const res = await api.get(`/tasks/output/${id}/blob/`);
      if (res.data.signed_url) window.open(res.data.signed_url, '_blank');
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin w-12 h-12 mx-auto text-accent-primary" /></div>;

  return (
    <div className="p-4 lg:p-8 pb-24">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 lg:mb-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 lg:w-12 lg:h-12 bg-accent-primary/10 rounded-xl flex items-center justify-center border border-accent-primary/20 shadow-xl">
            <Bolt className="w-6 h-6 text-accent-primary" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">Phase Control</h1>
            <p className="text-slate-500 font-bold text-[9px] uppercase tracking-[0.2em] mt-1.5">Execution Stream & Deliverables</p>
          </div>
        </div>

        <div className="w-full md:w-96">
          <CustomSelect 
            label="Project Stream"
            value={selectedProjectId}
            onChange={setSelectedProjectId}
            options={projects.map(p => ({ value: p.project_id, label: `${p.project_number} - ${p.project_name}` }))}
          />
        </div>
      </div>

      {/* View Switcher */}
      <div className="flex p-1 bg-slate-100 dark:bg-black/40 rounded-xl border border-slate-200 dark:border-white/5 w-fit mb-8 shadow-xl">
        <button 
          onClick={() => setViewMode('list')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
            viewMode === 'list' ? 'bg-accent-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
          }`}
        >
          <Hexagon className="w-3.5 h-3.5" /> List
        </button>
        <button 
          onClick={() => setViewMode('graph')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
            viewMode === 'graph' ? 'bg-accent-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
          }`}
        >
          <Layout className="w-3.5 h-3.5" /> Graph
        </button>
      </div>

      {viewMode === 'list' ? (
        <div className="glass border border-slate-200 dark:border-white/5 rounded-[2rem] lg:rounded-3xl overflow-hidden shadow-2xl">
          <DenseTable headers={['Activity / Phase', 'Timeline', 'Assignee', 'Status', 'Actions']}>
            {activities.map((activity: any) => {
              const isComplete = activity.status === 'Complete';
              const isActive = activity.status === 'Active';
              const isExpanded = expandedId === activity.activity_id;
              const activityFiles = deliverables.filter(d => d.activity_id === activity.activity_id);
              
              return (
                <React.Fragment key={activity.activity_id}>
                  <DenseRow>
                    {/* Activity Cell */}
                    <DenseCell flex={3} label="Activity / Phase">
                      <div className="flex items-center gap-3 lg:gap-4" onClick={() => toggleExpand(activity.activity_id)}>
                        <div className={`w-8 h-8 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl flex items-center justify-center border flex-shrink-0 ${
                          isComplete ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                          isActive ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                          'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-600'
                        }`}>
                          <Target className="w-4 h-4 lg:w-5 lg:h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight truncate">{activity.activity_name}</p>
                          <div className="flex items-center gap-2 mt-0.5 opacity-60 lg:hidden">
                             <FileText className="w-3 h-3 text-amber-500" />
                             <p className="text-[9px] font-bold uppercase truncate italic">{activity.expected_output || 'No output defined'}</p>
                          </div>
                        </div>
                      </div>
                    </DenseCell>

                    {/* Timeline Cell */}
                    <DenseCell flex={1.5} label="Timeline">
                      <div className="flex items-center gap-2 lg:gap-3">
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{activity.planned_start}</span>
                        <ArrowRight className="w-3 h-3 text-slate-300 dark:text-slate-700" />
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{activity.planned_finish}</span>
                      </div>
                    </DenseCell>

                    {/* Assignee Cell */}
                    <DenseCell flex={1.5} label="Assignee">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[9px] lg:text-[10px] font-black text-indigo-400 uppercase">
                          {activity.responsible?.full_name?.charAt(0)}
                        </div>
                        <span className="text-[10px] lg:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tighter">{activity.responsible?.full_name || 'UNASSIGNED'}</span>
                      </div>
                    </DenseCell>

                    {/* Status Cell */}
                    <DenseCell flex={1} align="center" label="Status">
                      <span className={`px-2 lg:px-3 py-1 rounded-full text-[8px] font-black tracking-[0.1em] border uppercase whitespace-nowrap ${
                        isComplete ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                        isActive ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                        'bg-slate-100 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/5'
                      }`}>
                        {activity.status}
                      </span>
                    </DenseCell>

                    {/* Actions Cell */}
                    <DenseCell flex={2} align="right" label="Execution">
                      <div className="flex gap-2 w-full lg:w-auto">
                        {isComplete ? (
                          <div className="flex-1 lg:flex-none flex items-center justify-center gap-2 text-emerald-500 bg-emerald-500/5 px-3 py-2 lg:py-1.5 rounded-lg border border-emerald-500/10">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Validated</span>
                          </div>
                        ) : activity.status === 'Not Started' ? (
                          <button 
                            onClick={(e) => handleStartPhase(e, activity.activity_id)}
                            className="flex-1 lg:flex-none bg-accent-primary hover:bg-accent-secondary text-white px-4 py-2.5 rounded-lg font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-accent-primary/10"
                          >
                            <Upload className="w-3.5 h-3.5" /> Start
                          </button>
                        ) : (
                          <div className="flex gap-2 w-full">
                            <button onClick={(e) => handleUploadDraft(e, activity.activity_id)} className="flex-1 lg:flex-none bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-white px-3 py-2.5 rounded-lg font-black text-[9px] uppercase tracking-widest border border-slate-200 dark:border-white/5 transition-all">Draft</button>
                            <button onClick={(e) => handleComplete(e, activity.activity_id)} className="flex-1 lg:flex-none bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/10">Submit</button>
                          </div>
                        )}
                      </div>
                    </DenseCell>
                  </DenseRow>

                  {/* Mobile-Friendly Expanded Info */}
                  {isExpanded && (
                    <div className="px-6 lg:px-20 py-6 lg:py-8 bg-slate-50 dark:bg-black/40 border-t border-slate-200 dark:border-white/5 animate-in slide-in-from-top-4 duration-500">
                      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 lg:gap-12">
                        <div className="lg:col-span-5 space-y-4">
                          <div className="flex items-center gap-2 text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-[0.2em]">
                            <Info className="w-3.5 h-3.5" /> Baseline Requirements
                          </div>
                          <div className="p-5 lg:p-6 bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                            <p className="text-xs lg:text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed italic">
                              "{activity.expected_output || 'No specific deliverable baseline defined for this phase.'}"
                            </p>
                          </div>
                        </div>

                        <div className="lg:col-span-7 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em]">
                              <ShieldCheck className="w-3.5 h-3.5" /> Deliverable History
                            </div>
                            <span className="text-[8px] lg:text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">{activityFiles.length} ASSETS</span>
                          </div>
                          
                          <div className="space-y-2.5">
                            {activityFiles.map((file, i) => (
                              <div key={i} className="flex items-center justify-between p-3 lg:p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                                <div className="flex items-center gap-3 lg:gap-4 overflow-hidden">
                                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <div className="overflow-hidden">
                                    <p className="text-[11px] lg:text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight truncate">{file.file_name}</p>
                                    <p className="text-[8px] text-slate-500 font-mono mt-0.5 uppercase tracking-tighter truncate">BY {file.uploader_name}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => handleDownloadFile(file.output_id, file.file_name)} className="p-2 bg-slate-100 dark:bg-white/5 hover:bg-accent-primary text-slate-400 hover:text-white rounded-lg transition-all"><Download className="w-3 h-3.5" /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </DenseTable>
        </div>
      ) : (
        <div className="glass rounded-[2rem] lg:rounded-3xl p-4 lg:p-10 border border-slate-200 dark:border-white/5 shadow-2xl min-h-[500px] lg:min-h-[600px]">
          {diagramData ? <NetworkDiagram data={diagramData} /> : (
            <div className="py-40 text-center text-slate-400 dark:text-slate-500 uppercase font-black tracking-[0.3em] opacity-20 text-xl">Compiling Logic Network...</div>
          )}
        </div>
      )}

      {/* Upload Portal */}
      {uploadModal.isOpen && (
        <FileUploadZone 
          activityId={uploadModal.activityId!}
          onSuccess={() => {
            setUploadModal({ isOpen: false, activityId: null, docType: '' });
            fetchData();
          }}
          onClose={() => setUploadModal({ isOpen: false, activityId: null, docType: '' })}
          docType={uploadModal.docType}
          contextName={activities.find(a => a.activity_id === uploadModal.activityId)?.activity_name || 'Selected Activity'}
        />
      )}
    </div>
  );
};

export default RecordActivity;
