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
  Settings,
  ShieldCheck,
  Hexagon
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
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 shadow-xl">
            <Hexagon className="w-8 h-8 text-accent-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Phase Control</h1>
            <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em]">Live Execution & Deliverables</p>
          </div>
        </div>

        <div className="w-full md:w-96">
          <CustomSelect 
            label="Filter Logic Stream"
            value={selectedProjectId}
            onChange={setSelectedProjectId}
            options={projects.map(p => ({ value: p.project_id, label: `${p.project_number} - ${p.project_name}` }))}
          />
        </div>
      </div>

      {/* View Switcher (Match Image Toggle) */}
      <div className="flex p-1 bg-black rounded-2xl border border-white/5 w-fit mb-12 shadow-2xl">
        <button 
          onClick={() => setViewMode('list')}
          className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
            viewMode === 'list' 
              ? 'bg-accent-primary text-white shadow-[0_0_20px_rgba(14,165,233,0.3)]' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Hexagon className="w-4 h-4 fill-current" /> ACTIVITY STREAM
        </button>
        <button 
          onClick={() => setViewMode('graph')}
          className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
            viewMode === 'graph' 
              ? 'bg-accent-primary text-white shadow-[0_0_20px_rgba(14,165,233,0.3)]' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Layout className="w-4 h-4" /> LOGIC NETWORK
        </button>
      </div>

      {viewMode === 'list' ? (
        <div className="space-y-6">
          {activities.map((activity: any, index: number) => {
            const isComplete = activity.status === 'Complete';
            const isActive = activity.status === 'Active';
            const isNotStarted = activity.status === 'Not Started';

            return (
              <div 
                key={activity.activity_id} 
                className={`group glass border rounded-[2rem] p-8 transition-all duration-500 flex flex-col lg:flex-row lg:items-center gap-8 relative overflow-hidden ${
                  isComplete ? 'border-emerald-500/20' : 
                  isActive ? 'border-amber-500/20' : 
                  'border-white/5'
                }`}
              >
                {/* Vertical Color Strip */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                  isComplete ? 'bg-emerald-500' : 
                  isActive ? 'bg-amber-500' : 
                  'bg-white/5'
                }`} />

                {/* Left: Icon */}
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border transition-all duration-500 ${
                  isComplete ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                  isActive ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                  'bg-white/5 border-white/10 text-slate-600'
                }`}>
                  <Target className="w-8 h-8" />
                </div>

                {/* Center: Info */}
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-4">
                    <h3 className="text-2xl font-black text-white tracking-tight uppercase group-hover:text-accent-primary transition-colors">
                      {activity.activity_name}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-[0.1em] border uppercase ${
                      isComplete ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                      isActive ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                      'bg-rose-500/10 text-rose-500 border-rose-500/20'
                    }`}>
                      {activity.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-6 items-center">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      <Calendar className="w-3.5 h-3.5 opacity-50" />
                      <span className="text-slate-400 font-mono">{activity.planned_start}</span>
                      <ChevronRight className="w-2.5 h-2.5 opacity-30" />
                      <span className="text-slate-400 font-mono">{activity.planned_finish}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      <User className="w-3.5 h-3.5 opacity-50 text-accent-primary" />
                      <span className="text-slate-300 font-black">{activity.responsible?.full_name || 'UNASSIGNED'}</span>
                    </div>
                  </div>

                  {/* Output Box (Match Image) */}
                  <div className="bg-black/40 rounded-xl p-4 border border-white/5 flex items-start gap-3 max-w-2xl">
                    <FileText className="w-4 h-4 text-amber-500/60 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-slate-400 font-bold leading-relaxed uppercase tracking-wide">
                      {activity.expected_output || 'No specific deliverable baseline defined.'}
                    </p>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="lg:pl-8 lg:border-l lg:border-white/5 flex items-center justify-center">
                  {isComplete ? (
                    <div className="bg-emerald-500/5 px-8 py-4 rounded-2xl border border-emerald-500/10 flex items-center gap-4">
                      <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-emerald-500 font-black text-xs uppercase tracking-[0.2em]">Validated</span>
                    </div>
                  ) : isNotStarted ? (
                    <button 
                      onClick={() => handleStartPhase(activity.activity_id)}
                      className="bg-accent-primary hover:bg-accent-secondary text-white px-10 py-4 rounded-2xl font-black transition-all duration-300 text-xs uppercase tracking-[0.2em] flex items-center gap-3 shadow-2xl shadow-accent-primary/20 active:scale-95"
                    >
                      <Upload className="w-5 h-5" /> Start Phase
                    </button>
                  ) : (
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleUploadDraft(activity.activity_id)}
                        className="bg-white/5 hover:bg-white/10 text-white px-6 py-4 rounded-2xl font-black transition-all text-xs uppercase tracking-widest border border-white/10 active:scale-95"
                      >
                        Draft
                      </button>
                      <button 
                        onClick={() => handleComplete(activity.activity_id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-4 rounded-2xl font-black transition-all text-xs uppercase tracking-[0.2em] shadow-2xl shadow-emerald-600/20 active:scale-95"
                      >
                        Finalize
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass rounded-[3rem] p-10 border border-white/5 shadow-2xl min-h-[600px] animate-in zoom-in-95 duration-700">
          {diagramData ? <NetworkDiagram data={diagramData} /> : (
            <div className="py-40 text-center text-slate-500 uppercase font-black tracking-[0.3em] opacity-20 text-2xl">Compiling Logic Network...</div>
          )}
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
              api.get(`tasks/project/${selectedProjectId}/`).then(res => setActivities(res.data));
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
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        await api.post(`tasks/${activityId}/upload/?doc_type=${docType}`, formData, {
          headers: {
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
        <Upload className="w-12 h-12 text-slate-500 mx-auto mb-4 group-hover:text-accent-primary transition-colors" />
        <p className="text-slate-200 font-black text-lg uppercase tracking-widest">Drop deliverable</p>
      </div>

      {files.length > 0 && (
        <div className="bg-black/40 rounded-2xl p-4 border border-white/5">
          {files.map(f => (
            <div key={f.name} className="flex justify-between text-xs text-slate-400 font-bold uppercase">
              <span>{f.name}</span>
              <span>{(f.size/1024/1024).toFixed(2)} MB</span>
            </div>
          ))}
        </div>
      )}

      <button
        disabled={files.length === 0 || uploading}
        onClick={handleUpload}
        className="w-full bg-accent-primary hover:bg-accent-secondary disabled:opacity-30 text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] shadow-2xl shadow-accent-primary/20"
      >
        {uploading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Confirm Upload'}
      </button>
    </div>
  );
};

export default RecordActivity;
