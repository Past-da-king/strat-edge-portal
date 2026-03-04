import React, { useEffect, useState, useMemo } from 'react';
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
  X,
  ChevronRight,
  FolderPlus,
  Upload,
  Link as LinkIcon,
  Network,
  ArrowLeft,
  SearchIcon,
  Link2,
  Check,
  Plus,
  Eye,
  Clock,
  User2
} from 'lucide-react';
import { DenseTable, DenseRow, DenseCell } from '../components/DenseTable';
import { Modal } from '../components/Modal';
import { DocumentPreview } from '../components/DocumentPreview';
import projectService from '../services/projectService';
import api from '../services/api';

export const Repository: React.FC = () => {
  // --- CORE STATE ---
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | 'all'>('all');
  const [viewMode, setViewMode] = useState<'deliverables' | 'kb'>('deliverables');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Menu states
  const [activeMenuId, setActiveMenuId] = useState<{ type: 'del' | 'kb', id: number, name: string } | null>(null);

  // --- PREVIEW STATE ---
  const [preview, setPreview] = useState<{ isOpen: boolean; name: string; url: string }>({
    isOpen: false,
    name: '',
    url: ''
  });

  // --- DATA STATES ---
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [kbItems, setKbItems] = useState<any[]>([]);
  const [kbPath, setKbPath] = useState<any[]>([]); 
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  
  // --- MODALS STATE ---
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [linkModal, setLinkModal] = useState<{ 
    isOpen: boolean; 
    source: { type: string; id: number; name: string } | null;
    selectedTargets: any[]; 
  }>({
    isOpen: false,
    source: null,
    selectedTargets: []
  });
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [allPotentialLinks, setAllPotentialLinks] = useState<any[]>([]);
  const [linkingInProgress, setLinkingInProgress] = useState(false);

  const [relatedModal, setRelatedModal] = useState<{ isOpen: boolean; file: { type: string; id: number; name: string } | null; related: any[] }>({
    isOpen: false,
    file: null,
    related: []
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null; name: string; type: 'del' | 'kb' }>({
    isOpen: false,
    id: null,
    name: '',
    type: 'del'
  });

  const [showToast, setShowToast] = useState({ show: false, message: '' });

  // --- DATA FETCHING ---

  const fetchInitial = async () => {
    try {
      const res = await projectService.getProjects();
      setProjects(res);
      if (res.length > 0 && selectedProjectId === 'all') {
        setSelectedProjectId(res[0].project_id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliverables = async () => {
    if (selectedProjectId === 'all') return;
    try {
      const res = await api.get(`/repository/project/${selectedProjectId}/`);
      setDeliverables(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchKnowledgeBase = async () => {
    if (selectedProjectId === 'all') return;
    try {
      const parentParam = currentFolderId ? `?parent_id=${currentFolderId}` : '';
      const res = await api.get(`/repository/project/${selectedProjectId}/knowledge-base/${parentParam}`);
      setKbItems(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { fetchInitial(); }, []);

  useEffect(() => {
    if (viewMode === 'deliverables') fetchDeliverables();
    else fetchKnowledgeBase();
  }, [selectedProjectId, viewMode, currentFolderId]);

  useEffect(() => {
    if (linkModal.isOpen && selectedProjectId !== 'all') {
      const fetchPotential = async () => {
        try {
          const res = await api.get(`/repository/search/?project_id=${selectedProjectId}`);
          setAllPotentialLinks(res.data);
        } catch (err) {
          console.error(err);
        }
      };
      fetchPotential();
    }
  }, [linkModal.isOpen, selectedProjectId]);

  // --- ACTIONS ---

  const handlePreview = async (type: 'del' | 'kb', id: number, name: string) => {
    try {
      const endpoint = type === 'del' ? `/tasks/output/${id}/blob/` : `/repository/files/${id}/blob/`;
      const res = await api.get(`${endpoint}?inline=true`);
      if (res.data.signed_url) {
        setPreview({ isOpen: true, name, url: res.data.signed_url });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActiveMenuId(null);
    }
  };

  const handleDownload = async (type: 'del' | 'kb', id: number) => {
    try {
      const endpoint = type === 'del' ? `/tasks/output/${id}/blob/` : `/repository/files/${id}/blob/`;
      const res = await api.get(endpoint);
      if (res.data.signed_url) window.open(res.data.signed_url, '_blank');
    } catch (err) {
      console.error(err);
    } finally {
      setActiveMenuId(null);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName || selectedProjectId === 'all') return;
    try {
      await api.post('/repository/folders/', {
        name: newFolderName,
        project_id: selectedProjectId,
        parent_id: currentFolderId
      });
      setNewFolderName('');
      setIsFolderModalOpen(false);
      fetchKnowledgeBase();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploadPersonal = async () => {
    if (!uploadFile || selectedProjectId === 'all') return;
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('project_id', String(selectedProjectId));
    if (currentFolderId) formData.append('parent_id', String(currentFolderId));

    try {
      await api.post('/repository/upload/', formData);
      setUploadFile(null);
      setIsUploadModalOpen(false);
      fetchKnowledgeBase();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleLinkSelection = (target: any) => {
    setLinkModal(prev => {
      const exists = prev.selectedTargets.find(t => t.id === target.id && t.type === target.type);
      if (exists) {
        return { ...prev, selectedTargets: prev.selectedTargets.filter(t => !(t.id === target.id && t.type === target.type)) };
      } else {
        return { ...prev, selectedTargets: [...prev.selectedTargets, target] };
      }
    });
  };

  const handleBatchLink = async () => {
    if (!linkModal.source || linkModal.selectedTargets.length === 0) return;
    setLinkingInProgress(true);
    try {
      await api.post('/repository/links/batch/', {
        source: { type: linkModal.source.type, id: linkModal.source.id },
        targets: linkModal.selectedTargets.map(t => ({ type: t.type, id: t.id }))
      });
      setLinkModal({ isOpen: false, source: null, selectedTargets: [] });
      triggerToast(`${linkModal.selectedTargets.length} connection(s) established`);
    } catch (err) {
      console.error(err);
    } finally {
      setLinkingInProgress(false);
    }
  };

  const handleViewRelated = async (type: string, id: number, name: string) => {
    try {
      const res = await api.get(`/repository/related/${type}/${id}/`);
      setRelatedModal({ isOpen: true, file: { type, id, name }, related: res.data });
    } catch (err) {
      console.error(err);
    } finally {
      setActiveMenuId(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      const url = deleteConfirm.type === 'del' 
        ? `/tasks/output/${deleteConfirm.id}/` 
        : `/repository/files/${deleteConfirm.id}/`;
      await api.delete(url);
      setDeleteConfirm({ isOpen: false, id: null, name: '', type: 'del' });
      if (deleteConfirm.type === 'del') fetchDeliverables();
      else fetchKnowledgeBase();
      triggerToast('Deleted successfully');
    } catch (err) {
      console.error(err);
    }
  };

  const triggerToast = (msg: string) => {
    setShowToast({ show: true, message: msg });
    setTimeout(() => setShowToast({ show: false, message: '' }), 4000);
  };

  const navigateToFolder = (folder: any) => {
    setKbPath(prev => [...prev, { id: folder.file_id, name: folder.name }]);
    setCurrentFolderId(folder.file_id);
  };

  const navigateToBreadcrumb = (idx: number) => {
    if (idx === -1) {
      setKbPath([]);
      setCurrentFolderId(null);
    } else {
      const newPath = kbPath.slice(0, idx + 1);
      setKbPath(newPath);
      setCurrentFolderId(newPath[newPath.length - 1].id);
    }
  };

  // --- RENDER HELPERS ---

  const filteredDeliverables = deliverables.filter(f => 
    f.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.task_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLinkOptions = allPotentialLinks.filter(l => 
    l.name.toLowerCase().includes(linkSearchQuery.toLowerCase()) &&
    !(l.id === linkModal.source?.id && l.type === linkModal.source?.type) 
  );

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin w-12 h-12 mx-auto text-accent-primary" /></div>;

  return (
    <div className="p-4 lg:p-8 pb-32">
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20 shadow-xl">
            <Folder className="w-8 h-8 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">Repository</h1>
            <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em] mt-2">Manage Deliverables & Project Folders</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch gap-4">
          <div className="flex p-1 bg-slate-100 dark:bg-black/40 rounded-xl border border-slate-200 dark:border-white/5 w-fit shadow-xl">
            <button onClick={() => setViewMode('deliverables')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'deliverables' ? 'bg-accent-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}><FileText className="w-3.5 h-3.5" /> Deliverables</button>
            <button onClick={() => setViewMode('kb')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'kb' ? 'bg-accent-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}><Folder className="w-3.5 h-3.5" /> Open Folder</button>
          </div>
          <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(Number(e.target.value))} className="bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-accent-primary/20">{projects.map(p => <option key={p.project_id} value={p.project_id}>{p.project_number} • {p.project_name}</option>)}</select>
        </div>
      </div>

      <div className="glass rounded-[2rem] lg:rounded-[2.5rem] p-6 lg:p-10 border border-slate-200 dark:border-white/5 shadow-2xl relative">
        {/* TOP TOOLBAR */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10 pb-10 border-b border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap custom-scrollbar pb-2 lg:pb-0">
            <button onClick={() => navigateToBreadcrumb(-1)} className={`text-[10px] font-black uppercase tracking-widest transition-colors ${viewMode === 'kb' && kbPath.length === 0 ? 'text-accent-primary' : 'text-slate-400 hover:text-slate-600'}`}>{viewMode === 'kb' ? 'Root' : 'All Deliverables'}</button>
            {viewMode === 'kb' && kbPath.map((p, i) => (
              <React.Fragment key={p.id}><ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-700 shrink-0" /><button onClick={() => navigateToBreadcrumb(i)} className={`text-[10px] font-black uppercase tracking-widest transition-colors ${i === kbPath.length - 1 ? 'text-accent-primary' : 'text-slate-400 hover:text-slate-600'}`}>{p.name}</button></React.Fragment>
            ))}
          </div>
          <div className="flex gap-3">
            <div className="relative"><SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-xl pl-12 pr-4 py-3 text-sm text-slate-900 dark:text-white w-full lg:w-64 focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all" /></div>
            {viewMode === 'kb' && (<><button onClick={() => setIsFolderModalOpen(true)} className="p-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-slate-500 dark:text-slate-400 transition-all border border-slate-200 dark:border-white/5"><FolderPlus className="w-5 h-5" /></button><button onClick={() => setIsUploadModalOpen(true)} className="p-3 bg-accent-primary text-white hover:bg-accent-secondary rounded-xl transition-all shadow-lg shadow-accent-primary/20"><Upload className="w-5 h-5" /></button></>)}
          </div>
        </div>

        {/* DATA GRID / TABLE */}
        {viewMode === 'deliverables' ? (
          <DenseTable headers={['File Name', 'Date', 'User', 'Actions']}>
            {filteredDeliverables.map((file) => (
              <DenseRow key={file.output_id}>
                <DenseCell flex={3} label="Asset Identity" onClick={() => handlePreview('del', file.output_id, file.file_name)}>
                  <div className="flex items-center gap-4 py-2 cursor-pointer group/file">
                    <div className="w-10 h-10 bg-slate-100 dark:bg-white/5 rounded-xl flex items-center justify-center text-slate-500 border border-slate-200 dark:border-white/5 shrink-0 group-hover/file:border-accent-primary transition-all">
                      <FileText className="w-5 h-5 group-hover/file:text-accent-primary transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight truncate max-sm:max-w-[200px] max-w-sm group-hover/file:text-accent-primary transition-colors">{file.file_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[8px] font-black text-accent-primary uppercase tracking-widest bg-accent-primary/5 px-2 py-0.5 rounded border border-accent-primary/10">{file.doc_type}</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-indigo-500" /> {file.task_name}</span>
                      </div>
                    </div>
                  </div>
                </DenseCell>
                <DenseCell label="Archived Date" className="hidden lg:flex"><div className="flex items-center gap-2 text-slate-500 font-mono text-[10px]"><Calendar className="w-3.5 h-3.5" />{new Date(file.upload_date).toLocaleDateString()}</div></DenseCell>
                <DenseCell label="Execution Operator" className="hidden lg:flex"><div className="flex items-center gap-2.5"><div className="w-7 h-7 bg-indigo-500/10 rounded-full flex items-center justify-center text-[10px] font-black text-indigo-500 uppercase border border-indigo-500/10">{file.uploader_name?.charAt(0)}</div><span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tighter truncate max-w-[100px]">{file.uploader_name}</span></div></DenseCell>
                <div className="lg:hidden flex items-center gap-6 mt-4 pt-4 border-t border-slate-100 dark:border-white/5 opacity-60 px-1"><div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest"><Clock className="w-3 h-3" /> {new Date(file.upload_date).toLocaleDateString()}</div><div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest"><User2 className="w-3 h-3" /> {file.uploader_name}</div></div>
                <DenseCell align="right" label="Action">
                  <ActionTrigger 
                    type="del" 
                    id={file.output_id} 
                    name={file.file_name} 
                    activeMenu={activeMenuId} 
                    setActiveMenu={setActiveMenuId} 
                    onDownload={() => handleDownload('del', file.output_id)} 
                    onPreview={() => handlePreview('del', file.output_id, file.file_name)} 
                    onDelete={() => {
                      setDeleteConfirm({ isOpen: true, id: file.output_id, name: file.file_name, type: 'del' });
                      setActiveMenuId(null);
                    }} 
                    onLink={() => {
                      setLinkModal({ isOpen: true, source: { type: 'deliverable', id: file.output_id, name: file.file_name }, selectedTargets: [] });
                      setActiveMenuId(null);
                    }}
                    onViewRelated={() => handleViewRelated('deliverable', file.output_id, file.file_name)} 
                  />
                </DenseCell>
              </DenseRow>
            ))}
          </DenseTable>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {kbPath.length > 0 && (
              <div onClick={() => navigateToBreadcrumb(kbPath.length - 2)} className="flex items-center gap-4 p-4 bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all cursor-pointer group">
                <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:text-accent-primary" />
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Go Back</span>
              </div>
            )}
            {kbItems.map((item) => (
              <div key={item.file_id} className="flex items-center justify-between p-4 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 rounded-2xl hover:border-accent-primary/30 hover:shadow-xl transition-all group cursor-pointer">
                <div className="flex items-center gap-4 min-w-0" onClick={() => item.is_folder ? navigateToFolder(item) : handlePreview('kb', item.file_id, item.name)}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0 ${item.is_folder ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500' : 'bg-slate-100 dark:bg-black/40 border-slate-200 dark:border-white/10 text-slate-400'}`}>
                    {item.is_folder ? <Folder className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                  </div>
                  <p className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight truncate pr-2">{item.name}</p>
                </div>
                <ActionTrigger 
                  type="kb" 
                  id={item.file_id} 
                  name={item.name} 
                  activeMenu={activeMenuId} 
                  setActiveMenu={setActiveMenuId} 
                  onDownload={() => handleDownload('kb', item.file_id)} 
                  onPreview={() => handlePreview('kb', item.file_id, item.name)} 
                  onDelete={() => {
                    setDeleteConfirm({ isOpen: true, id: item.file_id, name: item.name, type: 'kb' });
                    setActiveMenuId(null);
                  }} 
                  onLink={() => {
                    setLinkModal({ isOpen: true, source: { type: 'personal', id: item.file_id, name: item.name }, selectedTargets: [] });
                    setActiveMenuId(null);
                  }} 
                  onViewRelated={() => handleViewRelated('personal', item.file_id, item.name)} 
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <DocumentPreview isOpen={preview.isOpen} onClose={() => setPreview({ ...preview, isOpen: false })} fileName={preview.name} fileUrl={preview.url} />

      {/* --- CENTRALIZED MOBILE ACTION SHEET --- */}
      {activeMenuId && (
        <div className="lg:hidden fixed inset-0 z-[2000] flex items-end animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setActiveMenuId(null)} />
          <div className="relative w-full bg-white dark:bg-slate-900 rounded-t-[2.5rem] p-6 animate-in slide-in-from-bottom-full duration-500 shadow-[0_-20px_50px_rgba(0,0,0,0.3)] border-t border-slate-200 dark:border-white/5">
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full mx-auto mb-8" />
            <div className="mb-8">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Active Asset</p>
              <p className="text-lg font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tight">{activeMenuId.name}</p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <MenuAction icon={<Eye className="w-5 h-5 text-accent-primary" />} label="Quick View" onClick={() => handlePreview(activeMenuId.type, activeMenuId.id, activeMenuId.name)} />
              <MenuAction icon={<Download className="w-5 h-5 text-slate-400" />} label="Download Document" onClick={() => handleDownload(activeMenuId.type, activeMenuId.id)} />
              <MenuAction icon={<LinkIcon className="w-5 h-5 text-indigo-500" />} label="Link to Another File" onClick={() => {
                setLinkModal({ isOpen: true, source: { type: activeMenuId.type === 'del' ? 'deliverable' : 'personal', id: activeMenuId.id, name: activeMenuId.name }, selectedTargets: [] });
                setActiveMenuId(null);
              }} />
              <MenuAction icon={<Network className="w-5 h-5 text-emerald-500" />} label="Show Related Files" onClick={() => handleViewRelated(activeMenuId.type === 'del' ? 'deliverable' : 'personal', activeMenuId.id, activeMenuId.name)} />
              <div className="h-px bg-slate-100 dark:bg-white/5 my-2" />
              <MenuAction icon={<Trash2 className="w-5 h-5 text-rose-500" />} label="Delete Permanently" onClick={() => {
                setDeleteConfirm({ isOpen: true, id: activeMenuId.id, name: activeMenuId.name, type: activeMenuId.type });
                setActiveMenuId(null);
              }} />
            </div>
            <button onClick={() => setActiveMenuId(null)} className="w-full py-5 mt-6 font-black text-[10px] uppercase tracking-[0.3em] text-slate-500 bg-slate-100 dark:bg-white/5 rounded-2xl">Dismiss Actions</button>
          </div>
        </div>
      )}

      {/* MODALS */}
      <Modal isOpen={linkModal.isOpen} onClose={() => setLinkModal({ isOpen: false, source: null, selectedTargets: [] })} title="Connect Resources">
        <div className="space-y-8 flex flex-col max-h-[70vh]">
          <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-5 shrink-0"><p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Source Resource</p><p className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">{linkModal.source?.name}</p></div>
          <div className="relative shrink-0"><SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" placeholder="Search all files..." value={linkSearchQuery} onChange={e => setLinkSearchQuery(e.target.value)} className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl pl-12 pr-4 py-4 text-slate-900 dark:text-white font-bold" /></div>
          <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2 min-h-[300px]">
            {filteredLinkOptions.map(res => {
              const isSelected = !!linkModal.selectedTargets.find(t => t.id === res.id && t.type === res.type);
              return (<div key={`${res.type}-${res.id}`} onClick={() => toggleLinkSelection(res)} className={`flex items-center justify-between p-4 border transition-all cursor-pointer group rounded-2xl shadow-sm ${isSelected ? 'bg-accent-primary/10 border-accent-primary' : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10'}`}><div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isSelected ? 'bg-accent-primary text-white' : 'bg-white dark:bg-black/40 text-slate-400 group-hover:text-accent-primary'}`}>{isSelected ? <Check className="w-5 h-5" /> : (res.type === 'deliverable' ? <CheckCircle2 className="w-5 h-5" /> : <FileText className="w-5 h-5" />)}</div><div><p className={`text-sm font-bold uppercase tracking-tight truncate max-w-[250px] ${isSelected ? 'text-accent-primary' : 'text-slate-700 dark:text-slate-200'}`}>{res.name}</p><p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">{res.context}</p></div></div>{isSelected && <span className="text-[10px] font-black text-accent-primary uppercase tracking-widest bg-accent-primary/10 px-2 py-1 rounded-lg">Selected</span>}</div>);
            })}
          </div>
          <div className="pt-6 border-t border-slate-200 dark:border-white/10 shrink-0"><button disabled={linkModal.selectedTargets.length === 0 || linkingInProgress} onClick={handleBatchLink} className="w-full bg-accent-primary hover:bg-accent-secondary text-white font-black py-5 rounded-2xl transition-all shadow-2xl shadow-accent-primary/20 flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-20">{linkingInProgress ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Link2 className="w-5 h-5" /> Establish {linkModal.selectedTargets.length} Connection(s)</>}</button></div>
        </div>
      </Modal>

      <Modal isOpen={isFolderModalOpen} onClose={() => setIsFolderModalOpen(false)} title="New Folder">
        <div className="space-y-8"><div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Folder Name</label><input type="text" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl p-4 text-slate-900 dark:text-white font-bold" placeholder="Enter name..." /></div><button onClick={handleCreateFolder} className="w-full bg-accent-primary py-4 rounded-xl text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-accent-primary/20">Create Folder</button></div>
      </Modal>

      <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title="Upload File">
        <div className="space-y-8"><div className="relative border-2 border-dashed border-slate-200 dark:border-white/10 rounded-3xl p-16 text-center group hover:border-accent-primary/30 transition-all bg-slate-50 dark:bg-black/20"><input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setUploadFile(e.target.files?.[0] || null)} /><Upload className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-4 group-hover:text-accent-primary" /><p className="text-slate-700 dark:text-slate-200 font-bold uppercase tracking-tight">{uploadFile ? uploadFile.name : 'Click or drop file'}</p></div><button onClick={handleUploadPersonal} disabled={!uploadFile} className="w-full bg-accent-primary py-4 rounded-xl text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-accent-primary/20 disabled:opacity-20 transition-all">Upload Document</button></div>
      </Modal>

      <Modal isOpen={relatedModal.isOpen} onClose={() => setRelatedModal({ isOpen: false, file: null, related: [] })} title="Related Files">
        <div className="space-y-8"><div className="flex items-center gap-4 border-b border-slate-200 dark:border-white/5 pb-8"><Network className="w-8 h-8 text-accent-primary" /><div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active File</p><h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">{relatedModal.file?.name}</h3></div></div><div className="space-y-4 pr-2 max-h-[400px] overflow-y-auto custom-scrollbar">{relatedModal.related.map(rel => (<div key={rel.link_id} className="flex items-center justify-between p-5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 rounded-2xl group hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all shadow-sm"><div className="flex items-center gap-4 min-w-0"><FileText className="w-5 h-5 text-indigo-500 shrink-0" /><div className="min-w-0"><p className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight truncate pr-4">{rel.name}</p><p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{rel.type === 'deliverable' ? 'Formal Output' : 'Context File'}</p></div></div><button onClick={() => handleDownload(rel.type === 'deliverable' ? 'del' : 'kb', rel.id)} className="p-3 bg-white dark:bg-white/5 hover:bg-accent-primary text-slate-400 hover:text-white rounded-xl transition-all shadow-sm shrink-0"><Download className="w-4 h-4" /></button></div>))}</div></div>
      </Modal>

      <Modal isOpen={deleteConfirm.isOpen} onClose={() => setDeleteConfirm({ isOpen: false, id: null, name: '', type: 'del' })} title="Confirm Delete">
        <div className="text-center py-4"><div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 mx-auto mb-6 border border-rose-500/20"><AlertTriangle className="w-8 h-8" /></div><h3 className="text-xl font-black text-slate-900 dark:text-white uppercase mb-3">Delete Permanent?</h3><p className="text-sm text-slate-500 dark:text-slate-400 mb-10 max-w-xs mx-auto font-medium leading-relaxed">You are about to permanently delete <span className="text-rose-500 font-bold">"{deleteConfirm.name}"</span>. This cannot be undone.</p><div className="flex gap-3"><button onClick={() => setDeleteConfirm({ isOpen: false, id: null, name: '', type: 'del' })} className="flex-1 py-4 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 font-black uppercase text-[10px] tracking-widest border border-slate-200 dark:border-white/5">Cancel</button><button onClick={handlePermanentDelete} className="flex-1 py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-rose-600/20 transition-all">Confirm Delete</button></div></div>
      </Modal>

      {showToast.show && (
        <div className="fixed bottom-24 lg:bottom-10 right-4 lg:right-10 z-[200] animate-in slide-in-from-right duration-500">
          <div className="bg-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-emerald-400/20"><CheckCircle2 className="w-6 h-6" /><p className="text-xs font-bold tracking-tight uppercase">{showToast.message}</p><button onClick={() => setShowToast({ show: false, message: '' })} className="ml-4 p-1 hover:bg-white/10 rounded-lg transition-colors"><X className="w-4 h-4" /></button></div>
        </div>
      )}
    </div>
  );
};

// Simplified trigger component to avoid nesting issues
const ActionTrigger = ({ type, id, name, activeMenu, setActiveMenu, onDownload, onPreview, onDelete, onLink, onViewRelated }: any) => {
  const isOpen = activeMenu?.type === type && activeMenu?.id === id;

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setActiveMenu({ type, id, name });
  };

  return (
    <div className="relative">
      <button 
        onClick={handleToggle} 
        className="p-2 bg-slate-50 dark:bg-white/5 lg:bg-transparent rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white border border-slate-200 dark:border-white/10 lg:border-0 relative z-10"
      >
        <MoreVertical className="w-5 h-5 pointer-events-none" />
      </button>

      {isOpen && (
        <div className="hidden lg:block">
          <div className="fixed inset-0 z-[150]" onClick={(e) => { e.stopPropagation(); setActiveMenu(null); }} />
          <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-[160] py-2 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl">
            <MenuAction icon={<Eye className="w-4 h-4 text-accent-primary" />} label="Quick View" onClick={onPreview} />
            <button onClick={(e) => { e.stopPropagation(); onDownload(); }} className="w-full flex items-center gap-3 px-5 py-3.5 text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
              <Download className="w-4 h-4 text-slate-400" /> Download Document
            </button>
            <button onClick={(e) => { e.stopPropagation(); onLink(); }} className="w-full flex items-center gap-3 px-5 py-3.5 text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
              <LinkIcon className="w-4 h-4 text-indigo-500" /> Link to Another File
            </button>
            <button onClick={(e) => { e.stopPropagation(); onViewRelated(); }} className="w-full flex items-center gap-3 px-5 py-3.5 text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
              <Network className="w-4 h-4 text-emerald-500" /> Show Related Files
            </button>
            <div className="h-px bg-slate-100 dark:bg-white/5 my-1" />
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="w-full flex items-center gap-3 px-5 py-3.5 text-[11px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all">
              <Trash2 className="w-4 h-4" /> Delete Permanently
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const MenuAction = ({ icon, label, onClick }: { icon: any; label: string; onClick: () => void }) => (
  <button onClick={(e) => { e.stopPropagation(); onClick(); }} className="w-full flex items-center gap-4 p-4 lg:p-3.5 rounded-2xl lg:rounded-none bg-slate-50 lg:bg-transparent dark:bg-white/5 border border-slate-100 lg:border-0 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
    {icon}
    <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">{label}</span>
  </button>
);

export default Repository;
