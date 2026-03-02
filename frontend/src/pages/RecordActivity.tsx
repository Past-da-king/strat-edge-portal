import React, { useEffect, useState } from 'react';
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
  Fingerprint
} from 'lucide-react';
import api from '../services/api';
import { Modal } from '../components/Modal';
import { useDropzone } from 'react-dropzone';
import { NetworkDiagram } from '../components/NetworkDiagram';
import { CustomSelect } from '../components/CustomSelect';

export const RecordActivity: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [diagramData, setDiagramData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');
  const [uploadModal, setUploadModal] = useState<{ isOpen: boolean; activityId: number | null; docType: string }>({
    isOpen: false,
    activityId: null,
    docType: ''
  });

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
      const fetchActivities = async () => {
        try {
          const [actRes, diagRes] = await Promise.all([
            api.get(`tasks/project/${selectedProjectId}/`),
            api.get(`projects/${selectedProjectId}/network-diagram/`)
          ]);
          setActivities(actRes.data);
          setDiagramData(diagRes.data);
        } catch (err) {
          console.error('Failed to fetch data', err);
        }
      };
      fetchActivities();
    }
  }, [selectedProjectId]);

  const handleStartPhase = (activityId: number) => {
    setUploadModal({ isOpen: true, activityId, docType: 'First Draft' });
  };

  const handleUploadDraft = (activityId: number) => {
    setUploadModal({ isOpen: true, activityId, docType: 'Regular Draft' });
  };

  const handleComplete = (activityId: number) => {
    setUploadModal({ isOpen: true, activityId, docType: 'Final Document' });
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
              
              return (
                <div 
                  key={activity.activity_id} 
                  className="grid grid-cols-12 gap-4 px-8 py-5 hover:bg-white/[0.02] transition-colors items-center group"
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
                      <p className="text-sm font-black text-slate-200 uppercase tracking-tight truncate group-hover:text-white transition-colors">{activity.activity_name}</p>
                      <div className="flex items-center gap-2 mt-1 opacity-40 group-hover:opacity-100 transition-opacity">
                        <FileText className="w-3 h-3 text-amber-500" />
                        <p className="text-[10px] text-slate-500 font-medium truncate uppercase italic">{activity.expected_output || 'No output defined'}</p>
                      </div>
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
                        onClick={() => handleStartPhase(activity.activity_id)}
                        className="bg-accent-primary hover:bg-accent-secondary text-white px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-accent-primary/10"
                      >
                        <Upload className="w-3.5 h-3.5" /> Start
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => handleUploadDraft(activity.activity_id)} className="bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest border border-white/5 transition-all">Draft</button>
                        <button onClick={() => handleComplete(activity.activity_id)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/10">Submit</button>
                      </div>
                    )}
                  </div>
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
        <div className="fixed inset-0 z-[9999] bg-[#0a0a0c] flex flex-col animate-in fade-in duration-300">
          {/* Top Bar */}
          <div className="flex items-center justify-between px-10 py-8 border-b border-white/5">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-accent-primary/10 rounded-2xl flex items-center justify-center border border-accent-primary/20 shadow-2xl">
                <ShieldCheck className="w-7 h-7 text-accent-primary" />
              </div>
              <div>
                <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Submission Terminal</h2>
                <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.4em] mt-2">Strat Edge Secure Deliverable Pipeline • Node Establish</p>
              </div>
            </div>
            <button 
              onClick={() => setUploadModal({ isOpen: false, activityId: null, docType: '' })}
              className="w-14 h-14 rounded-full bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 transition-all border border-white/10 flex items-center justify-center font-black"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Fullscreen Content Area */}
          <div className="flex-1 overflow-y-auto">
            <FileUploadZone 
              onSuccess={() => {
                setUploadModal({ isOpen: false, activityId: null, docType: '' });
                if (selectedProjectId) {
                  api.get(`tasks/project/${selectedProjectId}/`).then(res => setActivities(res.data));
                }
              }}
              activityId={uploadModal.activityId!}
              docType={uploadModal.docType}
              activityName={activities.find(a => a.activity_id === uploadModal.activityId)?.activity_name || 'Selected Activity'}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const FileUploadZone: React.FC<{ activityId: number; docType: string; activityName: string; onSuccess: () => void }> = ({ activityId, docType, activityName, onSuccess }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: acceptedFiles => setFiles(prev => [...prev, ...acceptedFiles])
  });

  const removeFile = (name: string) => {
    setFiles(files.filter(f => f.name !== name));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        await api.post(`tasks/${activityId}/upload/?doc_type=${docType}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      onSuccess();
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-12 p-12 items-stretch h-full min-h-[80vh]">
      {/* LEFT: Context & Dropzone */}
      <div className="lg:w-1/2 space-y-10">
        <div className="p-10 bg-accent-primary/5 border border-accent-primary/10 rounded-[3rem] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
            <Fingerprint className="w-40 h-40 text-white" />
          </div>
          <div className="flex items-center gap-5 mb-8 relative z-10">
            <div className="w-14 h-14 bg-accent-primary/10 rounded-2xl flex items-center justify-center border border-accent-primary/20">
              <Zap className="w-7 h-7 text-accent-primary" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Project Objective</p>
              <p className="text-white font-black text-3xl tracking-tighter uppercase leading-tight">{activityName}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-5 py-5 px-8 bg-black/60 rounded-2xl border border-white/5 relative z-10">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">Verified {docType} Uplink Protocol</span>
          </div>
        </div>

        <div 
          {...getRootProps()} 
          className={`relative border-2 border-dashed rounded-[3.5rem] p-20 text-center transition-all duration-700 cursor-pointer group flex-1 flex flex-col items-center justify-center bg-black/20 ${
            isDragActive ? 'border-accent-primary bg-accent-primary/5 ring-[20px] ring-accent-primary/5 scale-[1.02]' : 'border-white/10 hover:border-accent-primary/40 hover:bg-white/[0.02]'
          }`}
        >
          <input {...getInputProps()} />
          <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-700 group-hover:bg-accent-primary/10 group-hover:shadow-[0_0_50px_rgba(14,165,233,0.2)]">
            <FileUp className={`w-12 h-12 transition-all duration-500 ${isDragActive ? 'text-accent-primary animate-bounce' : 'text-slate-600 group-hover:text-accent-primary'}`} />
          </div>
          <p className="text-slate-200 font-black text-2xl uppercase tracking-tighter">Deliverable Ingestion</p>
          <p className="text-slate-500 text-xs mt-4 uppercase font-bold opacity-50 underline underline-offset-8 decoration-accent-primary/50 tracking-widest">Drop assets here or click to manual browse</p>
        </div>
      </div>

      {/* RIGHT: Selected Files & Final Confirmation */}
      <div className="lg:w-1/2 flex flex-col h-full">
        <div className="flex-1 bg-white/[0.02] rounded-[3.5rem] border border-white/5 flex flex-col overflow-hidden relative shadow-2xl">
          <div className="px-12 py-8 border-b border-white/5 flex justify-between items-center bg-white/5">
            <h4 className="text-sm font-black text-slate-400 uppercase tracking-[0.4em] flex items-center gap-4">
              <FileText className="w-5 h-5 text-indigo-500" /> Queue Analysis ({files.length} Assets)
            </h4>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Active</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-10 space-y-4 custom-scrollbar min-h-[400px]">
            {files.map((f, i) => (
              <div key={i} className="group flex items-center gap-6 p-6 bg-white/5 rounded-[2rem] border border-white/5 hover:border-white/10 hover:bg-white/[0.08] transition-all duration-500 animate-in fade-in slide-in-from-right-8" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-inner">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-200 truncate uppercase tracking-tight leading-none mb-2">{f.name}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-bold text-slate-500 font-mono tracking-widest">{(f.size/1024/1024).toFixed(2)} MB</span>
                    <span className="w-1 h-1 bg-white/10 rounded-full" />
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Ready for Transfer</span>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); removeFile(f.name); }}
                  className="p-3 hover:bg-rose-500/20 text-slate-600 hover:text-rose-500 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                >
                  <X className="w-5 h-5 rotate-45" />
                </button>
              </div>
            ))}
            {files.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-10 text-slate-500 py-32">
                <FileUp className="w-24 h-24 mb-8" />
                <p className="text-sm font-black uppercase tracking-[0.5em]">Input Buffer Empty</p>
              </div>
            )}
          </div>

          <div className="p-10 bg-white/5 border-t border-white/5 space-y-6">
            <button
              disabled={files.length === 0 || uploading}
              onClick={handleUpload}
              className="w-full bg-gradient-to-r from-accent-primary to-indigo-600 hover:from-accent-secondary hover:to-indigo-500 disabled:opacity-20 text-white font-black py-7 rounded-[2.5rem] transition-all duration-700 shadow-[0_0_50px_rgba(14,165,233,0.2)] uppercase tracking-[0.3em] text-sm active:scale-[0.98] group"
            >
              {uploading ? <Loader2 className="animate-spin w-7 h-7" /> : (
                <div className="flex items-center justify-center gap-5">
                  <ShieldCheck className="w-7 h-7 group-hover:scale-125 transition-transform duration-500" /> 
                  Authorize Payload Transfer
                </div>
              )}
            </button>
            <div className="flex items-center justify-center gap-3">
              <ShieldCheck className="w-3 h-3 text-slate-600" />
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em] italic">
                End-to-End Encrypted Secure Ingestion Node
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordActivity;
