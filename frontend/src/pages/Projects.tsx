import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Loader2, 
  MoreVertical, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  X 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import projectService from '../services/projectService';
import api from '../services/api';
import { ProjectCard } from '../components/ProjectCard';
import { Modal } from '../components/Modal';

export const Projects: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null; name: string }>({
    isOpen: false,
    id: null,
    name: ''
  });

  const [showToast, setShowToast] = useState(false);

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdminExec = user.role === 'admin' || user.role === 'executive';

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const data = await projectService.getProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to fetch projects', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDeleteProject = async () => {
    if (!deleteConfirm.id) return;
    try {
      await api.delete(`/projects/${deleteConfirm.id}/`);
      setDeleteConfirm({ isOpen: false, id: null, name: '' });
      fetchProjects();
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    } catch (err) {
      console.error('Delete failed', err);
      alert('Delete failed');
    }
  };

  const filteredProjects = projects.filter((p: any) => 
    p.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.project_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.client && p.client.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-8 pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Project Portfolio</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage and track performance across all active projects.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            placeholder="Search projects by name, number or client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-sidebar border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/50 transition-all shadow-sm"
          />
        </div>
        <button className="bg-sidebar border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 px-6 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all flex items-center gap-2 shadow-sm">
          <Filter className="w-4 h-4" />
          FILTERS
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-12 h-12 text-accent-primary animate-spin" />
          <p className="text-slate-500 font-medium animate-pulse">Loading portfolio...</p>
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.map((project: any) => (
            <div key={project.project_id} className="relative group/card">
              <div onClick={() => navigate(`/projects/${project.project_id}`)}>
                <ProjectCard
                  project_name={project.project_name}
                  project_number={project.project_number}
                  client={project.client || 'N/A'}
                  total_budget={project.total_budget}
                  spent={project.spent || 0}
                  percentComplete={project.percent_complete || 0}
                  health={project.health || 'Green'}
                />
              </div>
              
              {/* Project Action Menu */}
              {isAdminExec && (
                <div className="absolute top-4 right-4 z-10">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === project.project_id ? null : project.project_id); }}
                    className="p-2 bg-white/10 hover:bg-white/20 dark:bg-black/20 dark:hover:bg-black/40 rounded-lg text-white dark:text-slate-400 transition-all opacity-0 group-hover/card:opacity-100"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {activeMenu === project.project_id && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setActiveMenu(null)} />
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-30 py-2 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl">
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setDeleteConfirm({ isOpen: true, id: project.project_id, name: project.project_name });
                            setActiveMenu(null);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" /> Delete Project
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-sidebar border border-slate-200 dark:border-slate-800 rounded-2xl border-dashed">
          <p className="text-slate-500 text-lg">No projects found matching your criteria.</p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal 
        isOpen={deleteConfirm.isOpen} 
        onClose={() => setDeleteConfirm({ isOpen: false, id: null, name: '' })}
        title="Security Authorization"
      >
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 mx-auto mb-6 border border-rose-500/20">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase mb-3 tracking-tighter">Delete Project?</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-10 max-w-xs mx-auto font-medium leading-relaxed">
            You are about to permanently delete <span className="text-rose-500 font-bold">"{deleteConfirm.name}"</span> and all its associated tasks, documents, and records. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteConfirm({ isOpen: false, id: null, name: '' })} className="flex-1 py-4 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 font-black uppercase text-[10px] tracking-widest border border-slate-200 dark:border-white/5">Cancel</button>
            <button onClick={handleDeleteProject} className="flex-1 py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-rose-600/20 transition-all">Yes, Delete</button>
          </div>
        </div>
      </Modal>

      {/* Success Toast */}
      {showToast && (
        <div className="fixed bottom-24 lg:bottom-10 right-4 lg:right-10 z-[200] animate-in slide-in-from-right duration-500">
          <div className="bg-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-emerald-400/20">
            <CheckCircle2 className="w-6 h-6" />
            <div>
              <p className="font-black uppercase tracking-widest text-[10px]">Project Purged</p>
              <p className="text-xs font-bold opacity-90 tracking-tight">The project has been permanently removed.</p>
            </div>
            <button onClick={() => setShowToast(false)} className="ml-4 p-1 hover:bg-white/10 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
