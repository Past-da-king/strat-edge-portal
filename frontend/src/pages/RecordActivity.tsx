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
  ChevronRight,
  Target,
  Hexagon,
  ShieldCheck,
  Zap,
  Info,
  ArrowRight,
  Maximize2,
  FileUp,
  X,
  Fingerprint,
  ChevronDown,
  Download,
  Link as LinkIcon
} from 'lucide-react';
import api from '../services/api';
import { Modal } from '../components/Modal';
import { useDropzone } from 'react-dropzone';
import { NetworkDiagram } from '../components/NetworkDiagram';
import { CustomSelect } from '../components/CustomSelect';

import { FileUploadZone } from '../components/FileUploadZone';

export const RecordActivity: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [diagramData, setDiagramData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [uploadModal, setUploadModal] = useState<{ isOpen: boolean; activityId: number | null; docType: string }>({
    isOpen: false,
    activityId: null,
    docType: ''
  });

  const fetchActivities = async (projectId: number) => {
    try {
      const [actRes, diagRes, delRes] = await Promise.all([
        api.get(`tasks/project/${projectId}/`),
        api.get(`projects/${projectId}/network-diagram/`),
        api.get(`repository/project/${projectId}/`)
      ]);
      setActivities(actRes.data);
      setDiagramData(diagRes.data);
      setDeliverables(delRes.data);
    } catch (err) {
      console.error('Failed to fetch data', err);
    }
  };

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await api.get('projects/');
        setProjects(res.data);
        if (res.data.length > 0) setSelectedProjectId(res.data[0].project_id);
      } catch (err) {
        console.error('Failed to fetch projects', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchActivities(selectedProjectId);
    }
  }, [selectedProjectId]);

  const handleStartPhase = (e: React.MouseEvent, activityId: number) => {
    e.stopPropagation();
    setUploadModal({ isOpen: true, activityId, docType: 'First Draft' });
  };

  const handleUploadDraft = (e: React.MouseEvent, activityId: number) => {
    e.stopPropagation();
    setUploadModal({ isOpen: true, activityId, docType: 'Regular Draft' });
  };

  const handleComplete = (e: React.MouseEvent, activityId: number) => {
    e.stopPropagation();
    setUploadModal({ isOpen: true, activityId, docType: 'Final Document' });
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleDownloadFile = async (fileId: number, fileName: string) => {
    try {
      const res = await api.get(`tasks/output/${fileId}/blob/`);
      const { signed_url } = res.data;
      if (signed_url) {
        window.open(signed_url, '_blank');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return (
    <div className="flex h-full items-center justify-center py-20">
      <Loader2 className="w-12 h-12 text-accent-primary animate-spin" />
    </div>
  );

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 shadow-xl">
            <Bolt className="w-6 h-6 text-accent-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Phase Control</h1>
            <p className="text-slate-500 font-bold text-[9px] uppercase tracking-[0.2em]">Execution Stream & Deliverables</p>
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
      <div className="flex p-1 bg-black/40 rounded-xl border border-white/5 w-fit mb-8 shadow-2xl">
        <button 
          onClick={() => setViewMode('list')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
            viewMode === 'list' ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Hexagon className="w-3.5 h-3.5" /> List
        </button>
        <button 
          onClick={() => setViewMode('graph')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
            viewMode === 'graph' ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Layout className="w-3.5 h-3.5" /> Graph
        </button>
      </div>

      {viewMode === 'list' ? (
        <div className="glass border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-8 py-4 bg-white/5 border-b border-white/5 items-center">
            <div className="col-span-4 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Activity / Phase</div>
            <div className="col-span-2 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Timeline</div>
            <div className="col-span-2 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Assignee</div>
            <div className="col-span-2 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Status</div>
            <div className="col-span-2 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Actions</div>
          </div>

          <div className="divide-y divide-white/5">
            {activities.map((activity: any, index: number) => {
              const isComplete = activity.status === 'Complete';
              const isActive = activity.status === 'Active';
              const isExpanded = expandedId === activity.activity_id;
              const activityFiles = deliverables.filter(d => d.activity_id === activity.activity_id);
              
              return (
                <div key={activity.activity_id} className="transition-all duration-500 overflow-hidden">
                  <div 
                    onClick={() => toggleExpand(activity.activity_id)}
                    className={`grid grid-cols-12 gap-4 px-8 py-5 hover:bg-white/[0.04] cursor-pointer transition-colors items-center group ${isExpanded ? 'bg-white/[0.03]' : ''}`}
                  >
                    {/* Name & Output */}
                    <div className="col-span-4 flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0 transition-all group-hover:scale-110 ${
                        isComplete ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                        isActive ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                        'bg-white/5 border-white/10 text-slate-600'
                      }`}>
                        <Target className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black text-slate-200 uppercase tracking-tight truncate group-hover:text-white transition-colors">{activity.activity_name}</p>
                          <ChevronDown className={`w-3.5 h-3.5 text-slate-600 transition-transform duration-500 ${isExpanded ? 'rotate-180 text-accent-primary' : ''}`} />
                        </div>
                        {!isExpanded && (
                          <div className="flex items-center gap-2 mt-1 opacity-40 group-hover:opacity-100 transition-opacity">
                            <FileText className="w-3 h-3 text-amber-500" />
                            <p className="text-[10px] text-slate-500 font-medium truncate uppercase italic">{activity.expected_output || 'No output defined'}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="col-span-2 flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Start</span>
                        <span className="text-[10px] font-mono text-slate-400">{activity.planned_start}</span>
                      </div>
                      <ArrowRight className="w-3 h-3 text-slate-700" />
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Finish</span>
                        <span className="text-[10px] font-mono text-slate-400">{activity.planned_finish}</span>
                      </div>
                    </div>

                    {/* Assignee */}
                    <div className="col-span-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-black text-indigo-400 uppercase">
                          {activity.responsible?.full_name?.charAt(0)}
                        </div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">{activity.responsible?.full_name || 'UNASSIGNED'}</span>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="col-span-2 flex justify-center">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black tracking-[0.1em] border uppercase ${
                        isComplete ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                        isActive ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                        'bg-white/5 text-slate-600 border-white/5'
                      }`}>
                        {activity.status}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="col-span-2 flex justify-end gap-2">
                      {isComplete ? (
                        <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/10">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="text-[9px] font-black uppercase tracking-widest">Validated</span>
                        </div>
                      ) : activity.status === 'Not Started' ? (
                        <button 
                          onClick={(e) => handleStartPhase(e, activity.activity_id)}
                          className="bg-accent-primary hover:bg-accent-secondary text-white px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-accent-primary/10"
                        >
                          <Upload className="w-3.5 h-3.5" /> Start
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={(e) => handleUploadDraft(e, activity.activity_id)} className="bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest border border-white/5 transition-all">Draft</button>
                          <button onClick={(e) => handleComplete(e, activity.activity_id)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/10">Submit</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* EXPANDED SECTION */}
                  {isExpanded && (
                    <div className="px-20 py-8 bg-black/40 border-t border-white/5 animate-in slide-in-from-top-4 duration-500">
                      <div className="grid grid-cols-12 gap-12">
                        {/* Full Expected Output */}
                        <div className="col-span-5 space-y-4">
                          <div className="flex items-center gap-2 text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">
                            <Info className="w-3.5 h-3.5" /> Baseline Output Requirements
                          </div>
                          <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                            <p className="text-sm text-slate-300 font-medium leading-relaxed italic">
                              "{activity.expected_output || 'No specific deliverable baseline defined for this phase.'}"
                            </p>
                          </div>
                        </div>

                        {/* Deliverable History / Files */}
                        <div className="col-span-7 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">
                              <ShieldCheck className="w-3.5 h-3.5" /> Evidence & Deliverable History
                            </div>
                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{activityFiles.length} TOTAL ASSETS</span>
                          </div>
                          
                          <div className="space-y-2.5">
                            {activityFiles.map((file, i) => (
                              <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/[0.08] transition-all group/file">
                                <div className="flex items-center gap-4">
                                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-200 uppercase tracking-tight truncate max-w-md">{file.file_name}</p>
                                    <p className="text-[9px] text-slate-500 font-mono mt-0.5 uppercase tracking-tighter">BY {file.uploader_name} • {new Date(file.upload_date).toLocaleDateString()}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="px-2 py-0.5 bg-white/5 text-[8px] font-black text-slate-500 rounded uppercase tracking-widest">{file.doc_type}</span>
                                  <button 
                                    onClick={() => handleDownloadFile(file.output_id, file.file_name)}
                                    className="p-2 bg-white/5 hover:bg-accent-primary text-slate-400 hover:text-white rounded-lg transition-all"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                            {activityFiles.length === 0 && (
                              <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-2xl opacity-30">
                                <FileUp className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">No deliverables submitted for this phase</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {activities.length === 0 && (
              <div className="py-40 text-center">
                <Bolt className="w-16 h-16 text-slate-800 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-black text-slate-700 uppercase tracking-widest">No activities in stream</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="glass rounded-3xl p-10 border border-white/5 shadow-2xl min-h-[600px] animate-in zoom-in-95 duration-700">
          {diagramData ? <NetworkDiagram data={diagramData} /> : (
            <div className="py-40 text-center text-slate-500 uppercase font-black tracking-[0.3em] opacity-20 text-xl">Compiling Logic Network...</div>
          )}
        </div>
      )}

      {/* --- FULLSCREEN SUBMISSION TERMINAL --- */}
      {uploadModal.isOpen && (
        <FileUploadZone 
          onSuccess={() => {
            setUploadModal({ isOpen: false, activityId: null, docType: '' });
            if (selectedProjectId) fetchActivities(selectedProjectId);
          }}
          onClose={() => setUploadModal({ isOpen: false, activityId: null, docType: '' })}
          activityId={uploadModal.activityId!}
          docType={uploadModal.docType}
          contextName={activities.find(a => a.activity_id === uploadModal.activityId)?.activity_name || 'Selected Activity'}
        />
      )}
    </div>
  );
};

export default RecordActivity;
