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
  ArrowUpRight
} from 'lucide-react';
import { DenseTable, DenseRow, DenseCell } from '../components/DenseTable';
import projectService from '../services/projectService';
import api from '../services/api';

export const Repository: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | 'all'>('all');
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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
    }
  };

  const filteredFiles = files.filter(f => 
    f.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.task_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.uploader_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin w-12 h-12 mx-auto text-accent-primary" /></div>;

  return (
    <div className="p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase mb-2 flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20">
              <Folder className="w-7 h-7 text-indigo-500" />
            </div>
            Document Repository
          </h1>
          <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em] ml-16">Centralized Project Deliverables & Knowledge Base</p>
        </div>

        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Filter repository..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-black/40 border border-white/5 rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/20 w-64 transition-all"
            />
          </div>
          <select 
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-accent-primary/20"
          >
            <option value="all">ALL PROJECTS</option>
            {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
          </select>
        </div>
      </div>

      <div className="glass rounded-[2.5rem] p-10 border border-white/5 shadow-2xl overflow-hidden">
        <DenseTable headers={['Deliverable Name', 'Upload Date', 'Context / Task', 'Operator', 'Action']}>
          {filteredFiles.map((file) => (
            <DenseRow key={file.output_id}>
              <DenseCell flex={3}>
                <div className="flex items-center gap-4 py-3">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-500 border border-white/5">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-200 uppercase tracking-tight truncate max-w-xs">{file.file_name}</p>
                    <span className="text-[9px] font-black text-accent-primary uppercase tracking-widest bg-accent-primary/5 px-2 py-0.5 rounded mt-1 inline-block border border-accent-primary/10">{file.doc_type}</span>
                  </div>
                </div>
              </DenseCell>
              <DenseCell>
                <div className="flex items-center gap-2 text-slate-500 font-mono text-[10px]">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(file.upload_date).toLocaleDateString()}
                </div>
              </DenseCell>
              <DenseCell flex={2}>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-tight italic opacity-60">
                  <ArrowUpRight className="w-3 h-3" />
                  {file.task_name}
                </div>
              </DenseCell>
              <DenseCell>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-indigo-500/20 rounded-full flex items-center justify-center text-[10px] font-black text-indigo-400">
                    {file.uploader_name?.charAt(0)}
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{file.uploader_name}</span>
                </div>
              </DenseCell>
              <DenseCell align="right">
                <button 
                  onClick={() => handleDownload(file.output_id, file.file_name)}
                  className="p-3 bg-accent-primary/10 hover:bg-accent-primary text-accent-primary hover:text-white rounded-xl transition-all duration-500 shadow-xl shadow-accent-primary/5"
                >
                  <Download className="w-5 h-5" />
                </button>
              </DenseCell>
            </DenseRow>
          ))}
        </DenseTable>
        {filteredFiles.length === 0 && (
          <div className="py-40 text-center">
            <Folder className="w-20 h-20 text-slate-800 mx-auto mb-6" />
            <p className="text-2xl font-black text-slate-700 uppercase tracking-widest">Repository Empty</p>
            <p className="text-slate-500 mt-2 font-medium">No documents matching your search or filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Repository;
