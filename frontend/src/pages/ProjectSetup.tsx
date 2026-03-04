import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Upload, 
  Layout, 
  Settings2, 
  CheckCircle2, 
  Loader2,
  FileSpreadsheet,
  Download,
  Trash2,
  Save,
  AlertTriangle
} from 'lucide-react';
import api from '../services/api';
import projectService from '../services/projectService';
import authService from '../services/authService';
import { CustomSelect } from '../components/CustomSelect';
import { DenseTable, DenseRow, DenseCell } from '../components/DenseTable';

export const ProjectSetup: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'manual' | 'import' | 'manage'>('manual');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Manual Setup State
  const [formData, setFormData] = useState({
    project_name: '',
    project_number: '',
    client: '',
    total_budget: 0,
    start_date: '',
    target_end_date: '',
    pm_user_id: 0
  });

  // Manage Plan State
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [planTasks, setPlanTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isPlanLoading, setIsPlanLoading] = useState(false);

  const currentUser = authService.getCurrentUser();
  const isAdminExec = currentUser?.role === 'admin' || currentUser?.role === 'executive';

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const [projRes, userRes] = await Promise.all([
          projectService.getProjects(),
          authService.getUsers()
        ]);
        setProjects(projRes);
        setUsers(userRes.filter((u: any) => u.status === 'approved' || u.status === 'active'));
        
        if (projRes.length > 0) setSelectedProjectId(projRes[0].project_id);
        
        // Set default PM for manual form
        if (!isAdminExec) {
          setFormData(prev => ({ ...prev, pm_user_id: currentUser?.user_id || 0 }));
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchInitial();
  }, []);

  useEffect(() => {
    if (activeTab === 'manage' && selectedProjectId) {
      fetchPlan(selectedProjectId);
    }
  }, [activeTab, selectedProjectId]);

  const fetchPlan = async (projectId: number) => {
    setIsPlanLoading(true);
    try {
      const res = await api.get(`tasks/project/${projectId}/`);
      setPlanTasks(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsPlanLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await projectService.createProject(formData);
      setSuccess('Project established successfully!');
      setFormData({ project_name: '', project_number: '', client: '', total_budget: 0, start_date: '', target_end_date: '', pm_user_id: currentUser?.user_id || 0 });
    } catch (err) {
      setError('Failed to create project.');
    } finally {
      setLoading(false);
      setTimeout(() => { setSuccess(''); setError(''); }, 3000);
    }
  };

  // --- PLAN EDITOR LOGIC ---
  const handleAddTaskRow = () => {
    const newTask = {
      activity_id: `temp-${Date.now()}`,
      activity_name: '',
      planned_start: '',
      planned_finish: '',
      budgeted_cost: 0,
      responsible_user_id: null,
      depends_on: null,
      expected_output: '',
      status: 'Not Started',
      project_id: selectedProjectId
    };
    setPlanTasks([...planTasks, newTask]);
  };

  const handleUpdateTaskField = (index: number, field: string, value: any) => {
    const updated = [...planTasks];
    updated[index] = { ...updated[index], [field]: value };
    setPlanTasks(updated);
  };

  const handleRemoveTask = async (taskId: number | string, index: number) => {
    if (typeof taskId === 'string' && taskId.startsWith('temp-')) {
      const updated = [...planTasks];
      updated.splice(index, 1);
      setPlanTasks(updated);
      return;
    }

    if (window.confirm('Delete this activity permanently?')) {
      try {
        await api.delete(`tasks/${taskId}/`);
        const updated = [...planTasks];
        updated.splice(index, 1);
        setPlanTasks(updated);
      } catch (err) {
        alert('Failed to delete task.');
      }
    }
  };

  const handleSavePlan = async () => {
    setLoading(true);
    try {
      for (const task of planTasks) {
        const isNew = typeof task.activity_id === 'string' && task.activity_id.startsWith('temp-');
        const payload = { ...task };
        if (isNew) delete payload.activity_id;

        if (isNew) {
          await api.post('tasks/', payload);
        } else {
          await api.put(`tasks/${task.activity_id}/`, payload);
        }
      }
      setSuccess('Project plan synchronized successfully!');
      if (selectedProjectId) fetchPlan(selectedProjectId);
    } catch (err) {
      setError('Plan synchronization failed.');
    } finally {
      setLoading(false);
      setTimeout(() => { setSuccess(''); setError(''); }, 3000);
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-accent-primary/10 rounded-xl flex items-center justify-center border border-accent-primary/20">
          <Settings2 className="w-7 h-7 text-accent-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Project Administration</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Configure project structures, manage dependencies, and control team access.</p>
        </div>
      </div>

      <div className="flex gap-4 mb-8 overflow-x-auto pb-2 custom-scrollbar">
        <TabButton active={activeTab === 'manual'} onClick={() => setActiveTab('manual')} icon={<Plus className="w-4 h-4" />} label="CREATE PROJECT" />
        <TabButton active={activeTab === 'import'} onClick={() => setActiveTab('import')} icon={<FileSpreadsheet className="w-4 h-4" />} label="EXCEL IMPORT" />
        <TabButton active={activeTab === 'manage'} onClick={() => setActiveTab('manage')} icon={<Layout className="w-4 h-4" />} label="MANAGE PLAN" />
      </div>

      {success && (
        <div className="mb-8 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 font-bold uppercase text-[10px] tracking-widest">
          <CheckCircle2 className="w-5 h-5" /> {success}
        </div>
      )}
      {error && (
        <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 font-bold uppercase text-[10px] tracking-widest">
          <AlertTriangle className="w-5 h-5" /> {error}
        </div>
      )}

      <div className="glass rounded-3xl p-8 overflow-hidden shadow-2xl">
        {activeTab === 'manual' && (
          <form onSubmit={handleManualSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl">
            <div className="space-y-6">
              <Input label="Project Name *" value={formData.project_name} onChange={v => setFormData({...formData, project_name: v})} required />
              <Input label="Project Number *" value={formData.project_number} onChange={v => setFormData({...formData, project_number: v})} required />
              <Input label="Client Name" value={formData.client} onChange={v => setFormData({...formData, client: v})} />
              <Input type="number" label="Total Contract Value (R) *" value={formData.total_budget} onChange={v => setFormData({...formData, total_budget: Number(v)})} required />
            </div>
            <div className="space-y-6">
              <Input type="date" label="Planned Start Date" value={formData.start_date} onChange={v => setFormData({...formData, start_date: v})} />
              <Input type="date" label="Target Completion Date" value={formData.target_end_date} onChange={v => setFormData({...formData, target_end_date: v})} />
              
              {isAdminExec ? (
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Assign Project Manager</label>
                  <select 
                    value={formData.pm_user_id} 
                    onChange={e => setFormData({...formData, pm_user_id: Number(e.target.value)})}
                    className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all font-bold"
                  >
                    <option value={0}>Select PM...</option>
                    {users.filter(u => u.role === 'pm' || u.role === 'admin').map(u => (
                      <option key={u.user_id} value={u.user_id}>{u.full_name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Project Assignment</p>
                  <p className="text-slate-900 dark:text-white font-bold text-sm">Will be assigned to you as PM.</p>
                </div>
              )}
            </div>
            <div className="md:col-span-2 pt-4">
              <button type="submit" disabled={loading} className="w-full bg-accent-primary hover:bg-accent-secondary text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] shadow-2xl shadow-accent-primary/20 active:scale-95">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> ESTABLISH PROJECT BASELINE</>}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'import' && (
          <div className="text-center py-16 max-w-2xl mx-auto space-y-10">
            <div className="space-y-4">
              <div className="w-20 h-20 bg-accent-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <FileSpreadsheet className="w-10 h-10 text-accent-primary" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Structured Excel Ingestion</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Download our master template to prepare your project phases, dependencies, and resource allocations for bulk synchronization.</p>
              <div className="pt-4">
                <button className="bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-900 dark:text-white px-8 py-4 rounded-xl font-bold transition-all border border-slate-200 dark:border-white/10 flex items-center gap-3 mx-auto uppercase text-xs tracking-widest">
                  <Download className="w-4 h-4" /> Download Baseline Template
                </button>
              </div>
            </div>
            <div className="relative border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[2.5rem] p-20 hover:border-accent-primary/30 transition-all cursor-pointer group bg-slate-50 dark:bg-black/20 shadow-inner">
              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept=".xlsx" />
              <Upload className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-4 group-hover:text-accent-primary transition-colors" />
              <p className="text-slate-500 dark:text-slate-300 font-black uppercase tracking-widest text-xs">Drop excel here or click to browse</p>
            </div>
          </div>
        )}

        {activeTab === 'manage' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="w-full lg:w-96">
                <CustomSelect 
                  label="Select Project to Edit" 
                  value={selectedProjectId} 
                  onChange={setSelectedProjectId} 
                  options={projects.map(p => ({ value: p.project_id, label: `${p.project_number} - ${p.project_name}` }))} 
                />
              </div>
              <div className="flex gap-3">
                <button onClick={handleAddTaskRow} className="px-6 py-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-white/10 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all">
                  <Plus className="w-4 h-4" /> Add Activity
                </button>
                <button onClick={handleSavePlan} disabled={loading} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl shadow-emerald-600/20">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Synchronize Plan</>}
                </button>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-white/5 rounded-2xl bg-slate-50 dark:bg-black/20 overflow-hidden shadow-inner">
              {isPlanLoading ? (
                <div className="py-40 text-center"><Loader2 className="w-12 h-12 text-accent-primary animate-spin mx-auto opacity-20" /></div>
              ) : (
                <div className="overflow-x-auto custom-scrollbar min-h-[400px]">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 dark:bg-white/5">
                      <tr>
                        <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-white/5">Activity Name</th>
                        <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-white/5">Responsible</th>
                        <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-white/5">Start Date</th>
                        <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-white/5">End Date</th>
                        <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-white/5">Budget (R)</th>
                        <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-white/5">Predecessor</th>
                        <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-white/5">Status</th>
                        <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-white/5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                      {planTasks.map((task, idx) => (
                        <tr key={task.activity_id} className="hover:bg-slate-100 dark:hover:bg-white/[0.02] transition-colors group">
                          <td className="p-2">
                            <input 
                              type="text" value={task.activity_name} 
                              onChange={e => handleUpdateTaskField(idx, 'activity_name', e.target.value)}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-accent-primary/50 rounded px-2 py-2 text-sm text-slate-900 dark:text-white font-bold uppercase" 
                              placeholder="Phase title..."
                            />
                          </td>
                          <td className="p-2 w-48">
                            <CustomSelect
                              value={task.responsible_user_id || ''}
                              onChange={val => handleUpdateTaskField(idx, 'responsible_user_id', val === '' ? null : Number(val))}
                              options={[
                                { value: '', label: 'Unassigned' },
                                ...users.map(u => ({ value: u.user_id, label: u.full_name }))
                              ]}
                              placeholder="Unassigned"
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="date" value={task.planned_start} 
                              onChange={e => handleUpdateTaskField(idx, 'planned_start', e.target.value)}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-accent-primary/50 rounded px-2 py-2 text-xs text-slate-500 dark:text-slate-400 font-mono" 
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="date" value={task.planned_finish} 
                              onChange={e => handleUpdateTaskField(idx, 'planned_finish', e.target.value)}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-accent-primary/50 rounded px-2 py-2 text-xs text-slate-500 dark:text-slate-400 font-mono" 
                            />
                          </td>
                          <td className="p-2 w-32">
                            <input 
                              type="number" value={task.budgeted_cost} 
                              onChange={e => handleUpdateTaskField(idx, 'budgeted_cost', Number(e.target.value))}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-accent-primary/50 rounded px-2 py-2 text-sm text-slate-900 dark:text-white font-mono font-bold" 
                            />
                          </td>
                          <td className="p-2 w-56">
                            <CustomSelect
                              value={task.depends_on || ''}
                              onChange={val => handleUpdateTaskField(idx, 'depends_on', val === '' ? null : Number(val))}
                              options={[
                                { value: '', label: 'None' },
                                ...planTasks.filter(t => t.activity_id !== task.activity_id && !String(t.activity_id).startsWith('temp-')).map(t => ({ value: t.activity_id, label: t.activity_name }))
                              ]}
                              placeholder="None"
                            />
                          </td>
                          <td className="p-2 w-40">
                            <CustomSelect
                              value={task.status}
                              onChange={val => handleUpdateTaskField(idx, 'status', val)}
                              options={['Not Started', 'Active', 'Complete'].map(s => ({ value: s, label: s }))}
                            />
                          </td>
                          <td className="p-2 text-right">
                            <button onClick={() => handleRemoveTask(task.activity_id, idx)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {planTasks.length === 0 && (
                    <div className="py-20 text-center text-slate-400 dark:text-slate-700 uppercase font-black tracking-widest text-sm italic">Plan is currently empty. Initialize baseline below.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// -- HELPERS --

const TabButton = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border whitespace-nowrap ${
      active 
        ? 'bg-accent-primary text-white border-accent-primary shadow-lg shadow-accent-primary/20' 
        : 'bg-slate-100 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/5 hover:text-slate-900 dark:hover:text-slate-300'
    }`}
  >
    {icon}
    {label}
  </button>
);

const Input = ({ label, value, onChange, type = 'text', required = false }: { label: string; value: any; onChange: (v: string) => void; type?: string; required?: boolean }) => (
  <div>
    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">{label}</label>
    <input 
      type={type} 
      value={value} 
      onChange={e => onChange(e.target.value)}
      required={required}
      className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3.5 text-sm text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700"
    />
  </div>
);

export default ProjectSetup;
