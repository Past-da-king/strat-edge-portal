import React, { useEffect, useState, useRef } from 'react';
import { 
  Users, 
  User,
  History, 
  Database, 
  ShieldCheck,
  UserPlus,
  Trash2,
  CheckCircle2,
  XCircle,
  Download,
  Upload,
  AlertOctagon,
  Loader2,
  Activity,
  Fingerprint
} from 'lucide-react';
import api from '../services/api';
import projectService from '../services/projectService';
import authService from '../services/authService';
import { Modal } from '../components/Modal';
import { CustomSelect } from '../components/CustomSelect';

const ClearanceInfo = ({ level, desc, color }: { level: string; desc: string; color: string }) => (
  <div className="space-y-1.5 group cursor-default">
    <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${color}`}>{level}</p>
    <p className="text-[10px] text-slate-500 font-medium leading-relaxed group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors uppercase tracking-tight">{desc}</p>
  </div>
);

export const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'database'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const data = await authService.getUsers();
        setUsers(data);
      } else if (activeTab === 'audit') {
        const data = await projectService.getAuditLogs();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch admin data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleBackup = async () => {
    try {
      await projectService.downloadFullBackup();
    } catch (err) {
      alert('Backup failed');
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("RESTORE WARNING: This will overwrite the current database and all files. Proceed?")) return;
    
    try {
      await projectService.restoreBackup(file);
      alert('System restored successfully. Refreshing...');
      window.location.reload();
    } catch (err) {
      alert('Restore failed');
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-10">
        <div className="w-14 h-14 bg-accent-primary/10 rounded-2xl flex items-center justify-center border border-accent-primary/20 shadow-xl shadow-accent-primary/5">
          <ShieldCheck className="w-8 h-8 text-accent-primary" />
        </div>
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">Control Center</h1>
          <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em] mt-2">Administrative Oversight & System Integrity</p>
        </div>
      </div>

      <div className="flex gap-4 mb-10 overflow-x-auto pb-2 custom-scrollbar">
        <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Users className="w-4 h-4" />} label="IDENTITY ACCESS" />
        <TabButton active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} icon={<History className="w-4 h-4" />} label="AUDIT TRAIL" />
        <TabButton active={activeTab === 'database'} onClick={() => setActiveTab('database')} icon={<Database className="w-4 h-4" />} label="SYSTEM LIFECYCLE" />
      </div>

      <div className="glass rounded-[2.5rem] p-10 border border-slate-200 dark:border-white/5 shadow-2xl min-h-[600px]">
        {activeTab === 'users' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-end border-b border-slate-200 dark:border-white/5 pb-8">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Identity Management</h3>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Manage platform credentials and permissions</p>
              </div>
              <button 
                onClick={() => setIsAddUserModalOpen(true)}
                className="bg-accent-primary hover:bg-accent-secondary text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all shadow-2xl shadow-accent-primary/20 border border-white/10 active:scale-95"
              >
                <UserPlus className="w-4 h-4" /> Register New Identity
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {users.map((user) => (
                <div key={user.user_id} className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-white/[0.07] transition-all group shadow-sm">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-slate-200 dark:bg-black/40 rounded-full flex items-center justify-center border border-slate-300 dark:border-white/10 text-slate-500 dark:text-slate-400 font-black text-lg">
                      {user.full_name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-black text-slate-900 dark:text-white text-lg tracking-tight uppercase">{user.full_name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-bold text-slate-500 font-mono tracking-widest underline decoration-accent-primary/30 underline-offset-4">@{user.username}</span>
                        <span className="w-1 h-1 bg-slate-200 dark:bg-white/10 rounded-full" />
                        <span className="text-[9px] font-black text-accent-secondary uppercase tracking-widest px-2 py-0.5 bg-accent-secondary/10 rounded border border-accent-secondary/20">{user.role}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right mr-4 hidden md:block">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Status</p>
                      <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${user.status === 'approved' || user.status === 'active' ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}>
                        {user.status}
                      </span>
                    </div>
                    <button 
                      onClick={async () => {
                        const newStatus = user.status === 'approved' ? 'disabled' : 'approved';
                        await authService.updateUserStatus(user.user_id, newStatus);
                        fetchData();
                      }}
                      className={`p-3 rounded-xl border transition-all duration-500 ${
                        user.status === 'approved' || user.status === 'active'
                          ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-500 hover:bg-rose-600 hover:text-white' 
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-600 hover:text-white'
                      }`}
                      title={user.status === 'approved' ? "Disable User" : "Enable User"}
                    >
                      {user.status === 'approved' || user.status === 'active' ? <XCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                    </button>
                    <button className="p-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-400 hover:text-rose-500 transition-all">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
              {users.length === 0 && !loading && (
                <div className="py-20 text-center glass rounded-[2rem] border border-dashed border-slate-200 dark:border-white/5 opacity-30">
                  <Users className="w-16 h-16 mx-auto mb-4 text-slate-400 dark:text-slate-500" />
                  <p className="text-xl font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">No Identities Found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
             <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">System Audit Trail</h3>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Immutable record of all platform operations</p>
              </div>
            <div className="bg-slate-50 dark:bg-black/20 rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-inner">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5">
                    <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Timestamp</th>
                    <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Operator</th>
                    <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Action</th>
                    <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                  {auditLogs.map((log, i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-6 text-xs font-mono text-slate-400 dark:text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="p-6">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">@{log.username}</span>
                      </td>
                      <td className="p-6">
                        <span className="text-[10px] font-black px-3 py-1 bg-slate-200 dark:bg-white/5 rounded-full border border-slate-300 dark:border-white/10 text-slate-700 dark:text-white group-hover:border-accent-primary/30 transition-all uppercase tracking-widest">{log.action}</span>
                      </td>
                      <td className="p-6 text-xs text-slate-500 italic font-medium">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'database' && (
          <div className="max-w-3xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">System Lifecycle</h3>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Mission critical database & storage operations</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2rem] p-8 space-y-6 group hover:border-accent-primary/20 transition-all shadow-sm">
                <div className="w-14 h-14 bg-accent-primary/10 rounded-2xl flex items-center justify-center text-accent-primary">
                  <Download className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Full System Backup</h4>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">Generate a comprehensive snapshot of the entire system including all project data and documents.</p>
                </div>
                <button 
                  onClick={handleBackup}
                  className="w-full bg-white dark:bg-white/5 hover:bg-accent-primary text-slate-900 dark:text-white py-4 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all border border-slate-200 dark:border-white/10 group-hover:shadow-2xl group-hover:shadow-accent-primary/20"
                >
                  Initiate Backup
                </button>
              </div>

              <div className="bg-rose-500/5 border border-rose-500/10 rounded-[2rem] p-8 space-y-6 group hover:border-rose-500/20 transition-all shadow-sm">
                <div className="w-14 h-14 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500">
                  <AlertOctagon className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Restore & Overwrite</h4>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">Restore the system from a previous backup. This will permanently overwrite all current data.</p>
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-rose-600/10 hover:bg-rose-600 text-rose-600 dark:text-rose-500 hover:text-white py-4 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all border border-rose-500/20 group-hover:shadow-2xl group-hover:shadow-accent-primary/20"
                >
                  Initiate Restore
                </button>
                <input type="file" ref={fileInputRef} onChange={handleRestore} className="hidden" accept=".zip" />
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal 
        isOpen={isAddUserModalOpen} 
        onClose={() => setIsAddUserModalOpen(false)} 
        title="IDENTITY REGISTRATION TERMINAL"
        size="full"
      >
        <div className="max-w-7xl mx-auto h-full flex flex-col lg:flex-row gap-16 py-8 items-stretch">
          {/* Left Panel: Protocol & Clearance Context */}
          <div className="lg:w-1/3 space-y-10 animate-in fade-in slide-in-from-left-8 duration-1000">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-accent-primary/10 rounded-2xl flex items-center justify-center border border-accent-primary/20 shadow-2xl shadow-accent-primary/5">
                <ShieldCheck className="w-10 h-10 text-accent-primary" />
              </div>
              <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter leading-tight uppercase">Security<br/>Provisioning</h2>
              <div className="h-1 w-20 bg-accent-primary rounded-full" />
              <p className="text-slate-500 font-medium leading-relaxed uppercase text-[10px] tracking-widest italic">Establishing new node connection to the Strat Edge Intelligence Network.</p>
            </div>

            <div className="glass border border-slate-200 dark:border-white/5 rounded-3xl p-8 space-y-8 bg-slate-50 dark:bg-black/20 shadow-inner">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" /> Clearance Protocol
              </h4>
              
              <div className="space-y-6">
                <ClearanceInfo 
                  level="ADMIN" 
                  desc="Full kernel access. Database management, user provisioning, and audit oversight." 
                  color="text-rose-600 dark:text-rose-500"
                />
                <ClearanceInfo 
                  level="MANAGER" 
                  desc="Project lifecycle control. Timeline management, team assignments, and reporting." 
                  color="text-amber-600 dark:text-amber-500"
                />
                <ClearanceInfo 
                  level="FIELD AGENT" 
                  desc="Execution access. Activity recording, expenditure logging, and file submissions." 
                  color="text-emerald-600 dark:text-emerald-500"
                />
              </div>
            </div>

            <div className="p-6 border border-indigo-500/10 rounded-2xl bg-indigo-500/5">
              <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 mb-2">
                <AlertOctagon className="w-4 h-4" />
                <span className="text-[9px] font-black uppercase tracking-widest">Warning Protocol</span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed">Credential generation triggers a permanent entry in the system audit trail. Ensure all information matches legal identification.</p>
            </div>
          </div>

          {/* Right Panel: The Form */}
          <div className="lg:w-2/3 animate-in fade-in slide-in-from-right-8 duration-1000 delay-200">
            <div className="glass border border-slate-200 dark:border-white/5 rounded-[3rem] p-12 shadow-2xl bg-gradient-to-br from-slate-100/50 dark:from-white/[0.02] to-transparent h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                <Fingerprint className="w-64 h-64 text-slate-900 dark:text-white" />
              </div>
              
              <AddUserForm 
                onSuccess={() => {
                  setIsAddUserModalOpen(false);
                  fetchData();
                }} 
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const AddUserForm: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    password: '',
    role: 'team'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authService.createUser({ ...formData, status: 'approved' });
      onSuccess();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-2 space-y-10">
      {/* Identity Core Group */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-1 border-l-4 border-accent-primary pl-4">
          <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.3em]">Personal Identity</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="group space-y-2">
            <label className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-accent-primary">
              <User className="w-3 h-3" /> Full Legal Name
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({...formData, full_name: e.target.value})}
              className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-5 py-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all font-bold text-sm placeholder:text-slate-400 dark:placeholder:text-slate-800 shadow-inner"
              placeholder="e.g. Alexander Strat"
              required
            />
          </div>
          <div className="group space-y-2">
            <label className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-accent-primary">
              <Activity className="w-3 h-3" /> Network Handle
            </label>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-accent-primary font-black text-sm opacity-50">@</span>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl pl-10 pr-5 py-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all font-bold text-sm placeholder:text-slate-400 dark:placeholder:text-slate-800 shadow-inner"
                placeholder="username"
                required
              />
            </div>
          </div>
        </div>
      </div>

      {/* Security & Access Group */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-1 border-l-4 border-indigo-500 pl-4">
          <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.3em]">Security & Clearance</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="group space-y-2">
            <label className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-indigo-500">
              <Database className="w-3 h-3" /> Security Key
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-5 py-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-bold text-sm placeholder:text-slate-400 dark:placeholder:text-slate-800 shadow-inner"
              placeholder="••••••••••••"
              required
            />
          </div>
          <div className="group space-y-2">
            <label className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-indigo-500">
              <ShieldCheck className="w-3 h-3" /> Clearance Level
            </label>
            <CustomSelect 
              value={formData.role}
              onChange={(val) => setFormData({...formData, role: val})}
              options={[
                { value: 'admin', label: 'SYSTEM ADMINISTRATOR' },
                { value: 'pm', label: 'PROJECT MANAGER' },
                { value: 'team', label: 'FIELD AGENT / TEAM' },
                { value: 'executive', label: 'EXECUTIVE OVERSEE' }
              ]}
            />
          </div>
        </div>
      </div>

      <div className="pt-4">
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-accent-primary to-indigo-600 hover:from-accent-secondary hover:to-indigo-500 text-white font-black py-5 rounded-2xl transition-all duration-500 flex items-center justify-center gap-4 uppercase tracking-[0.25em] text-xs shadow-2xl shadow-accent-primary/20 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            <>
              <CheckCircle2 className="w-5 h-5" /> 
              Authorize & Establish Identity
            </>
          )}
        </button>
        <p className="text-center text-[8px] font-black text-slate-600 uppercase tracking-[0.3em] mt-6 opacity-50 italic">
          Authorized personnel only. All registration events are logged.
        </p>
      </div>
    </form>
  );
};

const TabButton = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black transition-all border whitespace-nowrap text-[10px] uppercase tracking-widest ${
      active 
        ? 'bg-accent-primary text-white border-accent-primary shadow-xl shadow-accent-primary/20 scale-105' 
        : 'bg-slate-100 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/5 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 shadow-sm'
    }`}
  >
    {icon}
    {label}
  </button>
);

export default AdminPanel;
