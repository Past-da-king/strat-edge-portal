import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, 
  Users, 
  Lock, 
  Key, 
  UserCheck, 
  UserX,
  Loader2,
  ChevronRight,
  Save,
  UserPlus
} from 'lucide-react';
import projectService from '../services/projectService';
import authService from '../services/authService';
import { DenseTable, DenseRow, DenseCell } from '../components/DenseTable';
import { CustomSelect } from '../components/CustomSelect';

export const AdminSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'approvals' | 'access' | 'tasks'>('approvals');
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection states
  const [newPmId, setNewPmId] = useState<number | null>(null);
  const [teamSelection, setTeamSelection] = useState<number[]>([]);
  const [taskAssignments, setTaskAssignments] = useState<{[key: number]: number | null}>({});

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      // Fetch tasks for selected project when tab or project changes
      fetchProjectData(selectedProjectId);
    }
  }, [selectedProjectId, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [allUsers, projRes] = await Promise.all([
        authService.getUsers(), // Assuming this exists or using direct axios if not
        projectService.getProjects()
      ]);
      setPendingUsers(allUsers.filter((u: any) => u.status === 'pending'));
      setApprovedUsers(allUsers.filter((u: any) => u.status === 'approved' || u.status === 'active'));
      setProjects(projRes);
      if (projRes.length > 0) {
        setSelectedProjectId(projRes[0].project_id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectData = async (projectId: number) => {
    try {
      const project = await projectService.getProject(projectId);
      setNewPmId(project.pm_user_id);
      // tasks are in project.tasks based on relationship
      setTasks(project.tasks || []);
      
      const initialAssignments: any = {};
      (project.tasks || []).forEach((t: any) => {
        initialAssignments[t.activity_id] = t.responsible_user_id;
      });
      setTaskAssignments(initialAssignments);
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async (userId: number) => {
    try {
      await authService.updateUserStatus(userId, 'approved');
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdatePM = async () => {
    if (!selectedProjectId || !newPmId) return;
    try {
      await projectService.updateProjectPM(selectedProjectId, newPmId);
      alert('Lead PM updated successfully');
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTeam = async () => {
    if (!selectedProjectId) return;
    try {
      await projectService.updateProjectTeam(selectedProjectId, teamSelection);
      alert('Project team updated successfully');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveTaskAssignments = async () => {
    const assignments = Object.entries(taskAssignments).map(([taskId, userId]) => ({
      task_id: Number(taskId),
      user_id: userId
    }));
    try {
      await projectService.bulkUpdateTaskAssignments(assignments);
      alert('Task assignments saved successfully');
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin w-10 h-10 mx-auto text-accent-primary" /></div>;

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-accent-primary/10 rounded-xl flex items-center justify-center border border-accent-primary/20 shadow-xl">
          <ShieldCheck className="w-7 h-7 text-accent-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-none uppercase">System Administration</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-[10px] uppercase tracking-widest mt-2">Manage user access, project assignments, and system lifecycle.</p>
        </div>
      </div>

      <div className="flex gap-4 mb-8 overflow-x-auto pb-2 custom-scrollbar">
        <TabButton active={activeTab === 'approvals'} onClick={() => setActiveTab('approvals')} icon={<UserCheck className="w-4 h-4" />} label="USERS & APPROVALS" />
        <TabButton active={activeTab === 'access'} onClick={() => setActiveTab('access')} icon={<Lock className="w-4 h-4" />} label="PROJECT ACCESS" />
        <TabButton active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} icon={<Users className="w-4 h-4" />} label="TASK ASSIGNMENTS" />
      </div>

      <div className="glass rounded-3xl p-8 min-h-[500px] shadow-2xl overflow-hidden">
        {activeTab === 'approvals' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-tight">
              <Key className="w-5 h-5 text-amber-500" /> Account Requests
            </h3>
            {pendingUsers.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {pendingUsers.map(user => (
                  <div key={user.user_id} className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 flex items-center justify-between shadow-sm hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white text-lg tracking-tight uppercase">{user.full_name}</p>
                      <p className="text-xs text-slate-500 font-mono tracking-widest uppercase">@{user.username} • {user.role.toUpperCase()}</p>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleApprove(user.user_id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-xl font-black transition-all text-[10px] tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                      >
                        APPROVE
                      </button>
                      <button className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-500 px-6 py-2 rounded-xl font-black border border-rose-500/20 transition-all text-[10px] tracking-widest">
                        REJECT
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center text-slate-400 dark:text-slate-500 italic border-2 border-dashed border-slate-200 dark:border-white/5 rounded-2xl">
                No pending approval requests.
              </div>
            )}
          </div>
        )}

        {activeTab === 'access' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Project Team Assignments</h3>
            <div className="max-w-md">
              <CustomSelect 
                label="Select Project"
                value={selectedProjectId}
                onChange={setSelectedProjectId}
                options={projects.map(p => ({ value: p.project_id, label: p.project_name }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Lead Project Manager</h4>
                <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-accent-primary/10 rounded-full flex items-center justify-center text-accent-primary border border-accent-primary/20">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-slate-900 dark:text-white font-bold text-sm uppercase tracking-tight">Assign Primary Lead</p>
                      <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">This user will have full administrative rights over the project timeline.</p>
                    </div>
                  </div>
                  <CustomSelect 
                    value={newPmId}
                    onChange={setNewPmId}
                    options={approvedUsers.filter(u => u.role === 'pm' || u.role === 'admin').map(u => ({
                      value: u.user_id,
                      label: `${u.full_name} (@${u.username})`
                    }))}
                    placeholder="Select PM..."
                    className="mb-4"
                  />
                  <button 
                    onClick={handleUpdatePM}
                    className="w-full bg-accent-primary text-white py-3 rounded-xl font-black text-[10px] tracking-widest hover:bg-accent-secondary transition-all shadow-xl shadow-accent-primary/20 uppercase"
                  >
                    CHANGE LEAD PM
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Project Team Access</h4>
                <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-slate-900 dark:text-white font-bold text-sm uppercase tracking-tight">Manage Staff Access</p>
                      <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">Grant specific users access to view or record data for this project.</p>
                    </div>
                  </div>
                  
                  <div className="max-h-40 overflow-y-auto mb-4 border border-slate-200 dark:border-white/5 rounded-xl p-3 space-y-1 bg-slate-100 dark:bg-black/20 custom-scrollbar shadow-inner">
                    {approvedUsers.map(u => (
                      <label key={u.user_id} className="flex items-center gap-3 p-2.5 hover:bg-slate-200 dark:hover:bg-white/5 rounded-lg transition-all cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={teamSelection.includes(u.user_id)}
                          onChange={(e) => {
                            if (e.target.checked) setTeamSelection([...teamSelection, u.user_id]);
                            else setTeamSelection(teamSelection.filter(id => id !== u.user_id));
                          }}
                          className="w-4 h-4 rounded border-slate-300 dark:border-white/10 bg-white dark:bg-black/40 text-accent-primary focus:ring-accent-primary focus:ring-offset-0 transition-all cursor-pointer shadow-sm"
                        />
                        <span className="text-xs text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white font-bold transition-colors uppercase tracking-tight">{u.full_name}</span>
                      </label>
                    ))}
                  </div>

                  <button 
                    onClick={handleUpdateTeam}
                    className="w-full bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-700 dark:text-white py-3 rounded-xl font-black text-[10px] tracking-widest hover:bg-slate-300 dark:hover:bg-white/10 transition-all uppercase"
                  >
                    UPDATE PROJECT TEAM
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Specific Task Assignments</h3>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Assign project phases to specific personnel.</p>
              </div>
              <button 
                onClick={handleSaveTaskAssignments}
                className="bg-accent-primary hover:bg-accent-secondary text-white px-8 py-3 rounded-xl font-black text-[10px] tracking-widest flex items-center gap-2 transition-all shadow-xl shadow-accent-primary/20 uppercase"
              >
                <Save className="w-4 h-4" /> SAVE ASSIGNMENTS
              </button>
            </div>

            <div className="max-w-md mb-8">
              <CustomSelect 
                label="Select Project"
                value={selectedProjectId}
                onChange={setSelectedProjectId}
                options={projects.map(p => ({ value: p.project_id, label: p.project_name }))}
              />
            </div>
            
            <div className="border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden bg-slate-50 dark:bg-black/20 shadow-inner">
              <DenseTable headers={['Activity Name', 'Start Date', 'Responsible Person']}>
                {tasks.map((task: any) => (
                  <DenseRow key={task.activity_id}>
                    <DenseCell flex={2}>
                      <span className="text-slate-700 dark:text-slate-200 font-black uppercase tracking-tight text-sm leading-tight">{task.activity_name}</span>
                    </DenseCell>
                    <DenseCell>
                      <span className="text-slate-500 font-mono text-[10px] bg-slate-100 dark:bg-white/5 px-2 py-1 rounded border border-slate-200 dark:border-white/5 shadow-sm">{task.planned_start}</span>
                    </DenseCell>
                    <DenseCell>
                      <div className="w-64">
                        <CustomSelect 
                          value={taskAssignments[task.activity_id] || ''}
                          onChange={(val) => setTaskAssignments({...taskAssignments, [task.activity_id]: val})}
                          options={[
                            { value: '', label: 'Unassigned' },
                            ...approvedUsers.map(u => ({ value: u.user_id, label: u.full_name }))
                          ]}
                          placeholder="Assign..."
                        />
                      </div>
                    </DenseCell>
                  </DenseRow>
                ))}
              </DenseTable>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

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

export default AdminSettings;
