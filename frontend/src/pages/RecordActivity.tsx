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
  Target
} from 'lucide-react';
import axios from 'axios';
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

  const getAuthHeader = () => ({ 
    headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('user') || '{}').access_token}` } 
  });

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await axios.get('/api/projects', getAuthHeader());
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
            axios.get(`/api/tasks/project/${selectedProjectId}`, getAuthHeader()),
            axios.get(`/api/projects/${selectedProjectId}/network-diagram`, getAuthHeader())
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
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
        <div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-amber-500/10 rounded-[1.25rem] flex items-center justify-center border border-amber-500/20 shadow-lg shadow-amber-500/5">
              <Bolt className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Phase Control</h1>
              <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em]">Execution & Deliverable Management</p>
            </div>
          </div>
        </div>

        <div className="w-full md:w-96">
          <CustomSelect 
            label="Active Project"
            value={selectedProjectId}
            onChange={setSelectedProjectId}
            options={projects.map(p => ({ value: p.project_id, label: `${p.project_number} - ${p.project_name}` }))}
          />
        </div>
      </div>

      {/* View Switcher */}
      <div className="flex p-1.5 bg-black/40 rounded-2xl border border-white/5 w-fit mb-10 shadow-inner">
        <button 
          onClick={() => setViewMode('list')}
          className={`flex items-center gap-3 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${
            viewMode === 'list' 
              ? 'bg-accent-primary text-white shadow-xl shadow-accent-primary/20' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Bolt className="w-4 h-4" /> Activity Stream
        </button>
        <button 
          onClick={() => setViewMode('graph')}
          className={`flex items-center gap-3 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${
            viewMode === 'graph' 
              ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Layout className="w-4 h-4" /> Logic Network
        </button>
      </div>

      {viewMode === 'list' ? (
        <div className="space-y-4">
          {activities.map((activity: any, index: number) => (
            <div 
              key={activity.activity_id} 
              className="group relative animate-in fade-in slide-in-from-bottom-2 duration-500"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              {/* Vertical Progress Line Connector */}
              {index !== activities.length - 1 && (
                <div className="absolute left-[24px] top-16 bottom-[-16px] w-px bg-gradient-to-b from-white/10 to-transparent" />
              )}

              <div className={`glass border border-white/5 rounded-2xl p-5 transition-all duration-500 hover:bg-white/[0.03] flex flex-col lg:flex-row lg:items-center gap-6 relative overflow-hidden ${
                activity.status === 'Complete' ? 'border-emerald-500/20' :
                activity.status === 'Active' ? 'border-amber-500/20' : 'border-white/5'
              }`}>
                {/* Status Glow Indicator */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                  activity.status === 'Complete' ? 'bg-emerald-500 shadow-[2px_0_15px_rgba(16,185,129,0.3)]' :
                  activity.status === 'Active' ? 'bg-amber-500 shadow-[2px_0_15px_rgba(245,158,11,0.3)]' :
                  'bg-white/5'
                }`} />

                {/* Left Side: Identity */}
                <div className="flex items-start gap-5 flex-1 min-w-0">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border transition-all duration-500 group-hover:scale-105 ${
                    activity.status === 'Complete' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                    activity.status === 'Active' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                    'bg-white/5 border-white/10 text-slate-500'
                  }`}>
                    <Target className="w-5 h-5" />
                  </div>
                  
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-base font-black text-white tracking-tight uppercase group-hover:text-accent-primary transition-colors duration-500 truncate">
                        {activity.activity_name}
                      </h3>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest border ${
                        activity.status === 'Complete' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                        activity.status === 'Active' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                        'bg-rose-500/10 text-rose-500 border-rose-500/20'
                      }`}>
                        {activity.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-4 items-center">
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                        <Calendar className="w-3 h-3 opacity-50" />
                        <span className="text-slate-400 font-mono">{activity.planned_start}</span>
                        <ChevronRight className="w-2.5 h-2.5 opacity-30" />
                        <span className="text-slate-400 font-mono">{activity.planned_finish}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                        <User className="w-3 h-3 opacity-50 text-indigo-400" />
                        <span className="text-slate-300">{activity.responsible?.full_name || 'UNASSIGNED'}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 bg-black/20 rounded-lg p-2.5 border border-white/5 w-fit max-w-full">
                      <FileText className="w-3.5 h-3.5 text-amber-500/50 mt-0.5 flex-shrink-0" />
                      <p className="text-[10px] text-slate-400 font-medium italic leading-relaxed uppercase tracking-tight truncate">
                        {activity.expected_output || 'No specific output baseline defined.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Side: Actions */}
                <div className="flex items-center gap-2.5 lg:pl-6 lg:border-l lg:border-white/5 min-w-fit">
                  {activity.status === 'Not Started' && (
                    <button 
                      onClick={() => handleStartPhase(activity.activity_id)}
                      className="bg-accent-primary hover:bg-accent-secondary text-white px-6 py-2.5 rounded-xl font-black transition-all duration-500 text-[9px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-accent-primary/20 border border-white/10 active:scale-95"
                    >
                      <Upload className="w-3.5 h-3.5" /> START PHASE
                    </button>
                  )}
                  {activity.status === 'Active' && (
                    <div className="flex gap-2.5">
                      <button 
                        onClick={() => handleUploadDraft(activity.activity_id)}
                        className="bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 rounded-xl font-black transition-all duration-500 text-[9px] uppercase tracking-widest flex items-center gap-2 border border-white/10 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" /> DRAFT
                      </button>
                      <button 
                        onClick={() => handleComplete(activity.activity_id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-black transition-all duration-500 text-[9px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-600/20 border border-white/10 active:scale-95"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> COMPLETE
                      </button>
                    </div>
                  )}
                  {activity.status === 'Complete' && (
                    <div className="flex items-center gap-3 bg-emerald-500/5 px-5 py-2.5 rounded-xl border border-emerald-500/10">
                      <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/40">
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-emerald-500 font-black text-[10px] uppercase tracking-[0.1em]">Validated</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {activities.length === 0 && (
            <div className="py-40 text-center glass rounded-[3rem] border border-dashed border-white/10">
              <Bolt className="w-20 h-20 text-slate-800 mx-auto mb-6" />
              <p className="text-2xl font-black text-slate-700 uppercase tracking-widest">No activities found</p>
              <p className="text-slate-500 mt-2 font-medium">Select a project to view execution phases.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-700">
          <div className="bg-indigo-500/5 border border-indigo-500/10 p-6 rounded-[2rem] flex items-center gap-4 shadow-2xl">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-indigo-400" />
            </div>
            <p className="text-xs text-indigo-200/70 font-bold uppercase tracking-widest leading-loose">
              Visualizing task dependencies and the <b className="text-indigo-400">Critical Path</b> analysis.
            </p>
          </div>
          <div className="glass rounded-[3rem] p-10 border border-white/5 shadow-2xl min-h-[600px]">
            {diagramData ? <NetworkDiagram data={diagramData} /> : (
              <div className="py-40 text-center text-slate-500 uppercase font-black tracking-[0.3em] opacity-20 text-2xl">Generating logic map...</div>
            )}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <Modal 
        isOpen={uploadModal.isOpen} 
        onClose={() => setUploadModal({ isOpen: false, activityId: null, docType: '' })}
        title={`SUBMIT ${uploadModal.docType.toUpperCase()}`}
      >
        <FileUploadZone 
          onSuccess={() => {
            setUploadModal({ isOpen: false, activityId: null, docType: '' });
            if (selectedProjectId) {
              axios.get(`/api/tasks/project/${selectedProjectId}`, getAuthHeader()).then(res => setActivities(res.data));
            }
          }}
          activityId={uploadModal.activityId!}
          docType={uploadModal.docType}
        />
      </Modal>
    </div>
  );
};

const FileUploadZone: React.FC<{ activityId: number; docType: string; onSuccess: () => void }> = ({ activityId, docType, onSuccess }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: acceptedFiles => setFiles(acceptedFiles)
  });

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    
    try {
      const getAuthHeader = () => ({ 
        headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('user') || '{}').access_token}` } 
      });
      
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        await axios.post(`/api/tasks/${activityId}/upload?doc_type=${docType}`, formData, {
          headers: {
            ...getAuthHeader().headers,
            'Content-Type': 'multipart/form-data'
          }
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
    <div className="space-y-8 p-4">
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-[2.5rem] p-20 text-center transition-all duration-500 cursor-pointer group bg-black/20 ${
          isDragActive ? 'border-accent-primary bg-accent-primary/5' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
        }`}
      >
        <input {...getInputProps()} />
        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
          <Upload className="w-10 h-10 text-slate-500 group-hover:text-accent-primary" />
        </div>
        <p className="text-slate-200 font-black text-lg uppercase tracking-tighter">Drop deliverable here</p>
        <p className="text-slate-500 text-[10px] mt-3 uppercase tracking-[0.2em] font-black opacity-50 underline decoration-accent-primary decoration-2 underline-offset-4">or click to browse local files</p>
      </div>

      {files.length > 0 && (
        <div className="bg-black/40 rounded-3xl p-6 border border-white/5 animate-in fade-in slide-in-from-top-4">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <Plus className="w-3 h-3" /> Ready for upload ({files.length})
          </h4>
          <div className="space-y-3">
            {files.map(f => (
              <div key={f.name} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="w-10 h-10 bg-accent-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 text-accent-primary">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 font-bold truncate uppercase tracking-tight">{f.name}</p>
                  <p className="text-slate-500 font-mono text-[9px]">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        disabled={files.length === 0 || uploading}
        onClick={handleUpload}
        className="w-full bg-accent-primary hover:bg-accent-secondary disabled:opacity-30 text-white font-black py-5 rounded-[1.5rem] transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-xs shadow-2xl shadow-accent-primary/20 active:scale-95"
      >
        {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> CONFIRM SUBMISSION</>}
      </button>
    </div>
  );
};

export default RecordActivity;
