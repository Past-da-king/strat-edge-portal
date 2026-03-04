import React, { useEffect, useState } from 'react';
import { 
  Folder, 
  Loader2, 
  Search, 
  FileText, 
  Download, 
  Calendar,
  User,
  Filter,
  ArrowUpRight,
  MoreVertical,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X
} from 'lucide-react';
import { DenseTable, DenseRow, DenseCell } from '../components/DenseTable';
import { Modal } from '../components/Modal';
import projectService from '../services/projectService';
import api from '../services/api';

export const Repository: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | 'all'>('all');
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; fileId: number | null; fileName: string }>({
    isOpen: false,
    fileId: null,
    fileName: ''
  });

  const [showToast, setShowToast] = useState(false);

  const fetchFiles = async () => {
    try {
      const url = selectedProjectId === 'all' 
        ? '/repository/all/' 
        : `/repository/project/${selectedProjectId}/`;
      const res = await api.get(url);
      setFiles(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const res = await projectService.getProjects();
        setProjects(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchInitial();
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [selectedProjectId]);

  const handleDownload = async (fileId: number, fileName: string) => {
    try {
      const res = await api.get(`/tasks/output/${fileId}/blob/`);
      const { signed_url } = res.data;
      if (signed_url) {
        window.open(signed_url, '_blank');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActiveMenu(null);
    }
  };

  const openDeleteConfirm = (fileId: number, fileName: string) => {
    setDeleteConfirm({ isOpen: true, fileId, fileName });
    setActiveMenu(null);
  };

  const handlePermanentDelete = async () => {
    if (!deleteConfirm.fileId) return;
    try {
      await api.delete(`/tasks/output/${deleteConfirm.fileId}/`);
      setDeleteConfirm({ isOpen: false, fileId: null, fileName: '' });
      fetchFiles();
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const filteredFiles = files.filter(f => 
    f.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.task_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.uploader_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin w-12 h-12 mx-auto text-accent-primary" /></div>;

  return (
    <div className="p-4 lg:p-8 pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-2xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase mb-2 flex items-center gap-4">
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
              <Folder className="w-6 h-6 lg:w-7 lg:h-7 text-indigo-500" />
            </div>
            Repository
          </h1>
          <p className="text-slate-500 font-bold text-[9px] uppercase tracking-[0.2em] ml-14 lg:ml-16">Deliverables & Knowledge Base</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Filter repository..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl pl-12 pr-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/20 w-full lg:w-64 transition-all"
            />
          </div>
          <select 
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-accent-primary/20"
          >
            <option value="all">ALL PROJECTS</option>
            {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
          </select>
        </div>
      </div>

      <div className="glass rounded-[2rem] lg:rounded-[2.5rem] p-4 lg:p-10 border border-slate-200 dark:border-white/5 shadow-2xl overflow-hidden relative">
        <DenseTable headers={['Deliverable Name', 'Upload Date', 'Context / Task', 'Operator', 'Action']}>
          {filteredFiles.map((file) => (
            <DenseRow key={file.output_id}>
              <DenseCell flex={3} label="Asset Name">
                <div className="flex items-center gap-3 lg:gap-4 lg:py-3">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 bg-slate-100 dark:bg-white/5 rounded-lg lg:rounded-xl flex items-center justify-center text-slate-500 border border-slate-200 dark:border-white/5">
                    <FileText className="w-4 h-4 lg:w-5 lg:h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight truncate max-w-[200px] lg:max-w-xs">{file.file_name}</p>
                    <span className="text-[8px] lg:text-[9px] font-black text-accent-primary uppercase tracking-widest bg-accent-primary/5 px-2 py-0.5 rounded mt-1 inline-block border border-accent-primary/10">{file.doc_type}</span>
                  </div>
                </div>
              </DenseCell>
              <DenseCell flex={1} label="Archived">
                <div className="flex items-center gap-2 text-slate-500 font-mono text-[10px]">
                  <Calendar className="w-3.5 h-3.5 lg:hidden text-accent-primary opacity-50" />
                  {new Date(file.upload_date).toLocaleDateString()}
                </div>
              </DenseCell>
              <DenseCell flex={2} label="Logical Context">
                <div className="flex items-center gap-2 text-[10px] lg:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight italic opacity-60">
                  <ArrowUpRight className="w-3 h-3 text-indigo-500" />
                  <span className="truncate">{file.task_name}</span>
                </div>
              </DenseCell>
              <DenseCell flex={1} label="Operator">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-indigo-500/20 rounded-full flex items-center justify-center text-[9px] lg:text-[10px] font-black text-indigo-400 uppercase">
                    {file.uploader_name?.charAt(0)}
                  </div>
                  <span className="text-[10px] lg:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tighter truncate">{file.uploader_name}</span>
                </div>
              </DenseCell>
              <DenseCell flex={1} align="right" label="Management">
                <div className="relative">
                  <button 
                    onClick={() => setActiveMenu(activeMenu === file.output_id ? null : file.output_id)}
                    className="p-2 lg:p-2 bg-slate-100 dark:bg-white/5 lg:bg-transparent rounded-lg transition-all text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>

                  {activeMenu === file.output_id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl z-20 py-2 animate-in fade-in zoom-in-95 duration-200">
                        <button onClick={() => handleDownload(file.output_id, file.file_name)} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5">
                          <Download className="w-4 h-4" /> Download
                        </button>
                        <div className="h-px bg-slate-100 dark:bg-white/5 my-1" />
                        <button onClick={() => openDeleteConfirm(file.output_id, file.file_name)} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </DenseCell>
            </DenseRow>
          ))}
        </DenseTable>
        {filteredFiles.length === 0 && (
          <div className="py-40 text-center">
            <Folder className="w-16 lg:w-20 h-16 lg:h-20 text-slate-300 dark:text-slate-800 mx-auto mb-6 opacity-30" />
            <p className="text-xl lg:text-2xl font-black text-slate-400 dark:text-slate-700 uppercase tracking-widest opacity-50">Empty Repository</p>
          </div>
        )}
      </div>

      <Modal isOpen={deleteConfirm.isOpen} onClose={() => setDeleteConfirm({ isOpen: false, fileId: null, fileName: '' })} title="Security Check">
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 mx-auto mb-6">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase mb-3">Delete Permanent?</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-xs mx-auto font-medium leading-relaxed">
            You are about to remove <span className="text-rose-500 font-bold">"{deleteConfirm.fileName}"</span> forever. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteConfirm({ isOpen: false, fileId: null, fileName: '' })} className="flex-1 py-3.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 font-black uppercase text-[10px] tracking-widest border border-slate-200 dark:border-white/5">Cancel</button>
            <button onClick={handlePermanentDelete} className="flex-1 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-rose-600/20 transition-all">Yes, Delete</button>
          </div>
        </div>
      </Modal>

      {showToast && (
        <div className="fixed bottom-24 lg:bottom-10 right-4 lg:right-10 z-[200] animate-in slide-in-from-bottom-10 duration-500">
          <div className="bg-emerald-500 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-emerald-400/20">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Document Purged</span>
            <button onClick={() => setShowToast(false)} className="ml-2"><X className="w-4 h-4 opacity-50" /></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Repository;
