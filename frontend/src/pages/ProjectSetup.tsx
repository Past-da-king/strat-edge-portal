import React, { useState } from 'react';
import { 
  Plus, 
  Upload, 
  Layout, 
  Settings2, 
  CheckCircle2, 
  Loader2,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import api from '../services/api';

export const ProjectSetup: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'manual' | 'import' | 'manage'>('manual');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    project_name: '',
    project_number: '',
    client: '',
    total_budget: 0,
    start_date: '',
    target_end_date: ''
  });

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/projects/', formData);
      setSuccess('Project created successfully!');
      setFormData({ project_name: '', project_number: '', client: '', total_budget: 0, start_date: '', target_end_date: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setLoading(true);
    const file = e.target.files[0];
    const data = new FormData();
    data.append('file', file);

    try {
      await api.post('/projects/import/', data, {
        headers: { 
          'Content-Type': 'multipart/form-data' 
        }
      });
      setSuccess('Project imported successfully!');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-accent-primary/10 rounded-xl flex items-center justify-center border border-accent-primary/20">
          <Settings2 className="w-7 h-7 text-accent-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Project Administration</h1>
          <p className="text-slate-400">Configure project structures, manage dependencies, and control team access.</p>
        </div>
      </div>

      {success && (
        <div className="mb-8 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5" /> {success}
        </div>
      )}

      <div className="flex gap-4 mb-8">
        <TabButton active={activeTab === 'manual'} onClick={() => setActiveTab('manual')} icon={<Plus className="w-4 h-4" />} label="MANUAL SETUP" />
        <TabButton active={activeTab === 'import'} onClick={() => setActiveTab('import')} icon={<FileSpreadsheet className="w-4 h-4" />} label="EXCEL IMPORT" />
        <TabButton active={activeTab === 'manage'} onClick={() => setActiveTab('manage')} icon={<Layout className="w-4 h-4" />} label="MANAGE PLAN" />
      </div>

      <div className="glass rounded-3xl p-8 max-w-4xl">
        {activeTab === 'manual' && (
          <form onSubmit={handleManualSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Project Name *</label>
                <input 
                  type="text" 
                  value={formData.project_name}
                  onChange={e => setFormData({...formData, project_name: e.target.value})}
                  className="w-full bg-sidebar border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/50" 
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Project Number *</label>
                <input 
                  type="text" 
                  value={formData.project_number}
                  onChange={e => setFormData({...formData, project_number: e.target.value})}
                  className="w-full bg-sidebar border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/50" 
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Client Name</label>
                <input 
                  type="text" 
                  value={formData.client}
                  onChange={e => setFormData({...formData, client: e.target.value})}
                  className="w-full bg-sidebar border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/50" 
                />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Total Contract Value (R) *</label>
                <input 
                  type="number" 
                  value={formData.total_budget}
                  onChange={e => setFormData({...formData, total_budget: Number(e.target.value)})}
                  className="w-full bg-sidebar border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/50" 
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Planned Start Date</label>
                <input 
                  type="date" 
                  value={formData.start_date}
                  onChange={e => setFormData({...formData, start_date: e.target.value})}
                  className="w-full bg-sidebar border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/50" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Target Completion Date</label>
                <input 
                  type="date" 
                  value={formData.target_end_date}
                  onChange={e => setFormData({...formData, target_end_date: e.target.value})}
                  className="w-full bg-sidebar border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/50" 
                />
              </div>
            </div>
            <div className="md:col-span-2 pt-4">
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-accent-primary hover:bg-accent-secondary text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> CREATE INITIAL PROJECT</>}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'import' && (
          <div className="text-center space-y-8 py-10">
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-20 h-20 bg-accent-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <FileSpreadsheet className="w-10 h-10 text-accent-primary" />
              </div>
              <h3 className="text-xl font-bold text-white">Import from Excel</h3>
              <p className="text-slate-400 text-sm">Upload the official project template to automatically scaffold the baseline schedule and metadata.</p>
              
              <div className="pt-6">
                <button 
                  onClick={() => window.open('https://github.com/your-repo/templates/Project_Template.xlsx', '_blank')}
                  className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 w-full border border-white/10"
                >
                  <Download className="w-4 h-4" /> DOWNLOAD TEMPLATE
                </button>
              </div>
            </div>

            <div className="relative border-2 border-dashed border-white/10 rounded-2xl p-12 hover:border-accent-primary/50 transition-all cursor-pointer group">
              <input 
                type="file" 
                onChange={handleImport}
                className="absolute inset-0 opacity-0 cursor-pointer" 
                accept=".xlsx"
              />
              <Upload className="w-12 h-12 text-slate-500 mx-auto mb-4 group-hover:text-accent-primary transition-colors" />
              <p className="text-slate-300 font-medium">Select project excel file</p>
              {loading && <Loader2 className="w-6 h-6 animate-spin mx-auto mt-4 text-accent-primary" />}
            </div>
          </div>
        )}

        {activeTab === 'manage' && (
          <div className="text-center py-20">
            <Layout className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Interactive Plan Editor</h3>
            <p className="text-slate-500 max-w-sm mx-auto">This feature is coming in the next update. It will allow you to edit your schedule in a high-density grid similar to MS Project.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all border ${
      active 
        ? 'bg-accent-primary text-white border-accent-primary shadow-lg shadow-accent-primary/20' 
        : 'bg-sidebar text-slate-500 border-white/5 hover:text-slate-300'
    }`}
  >
    {icon}
    {label}
  </button>
);

export default ProjectSetup;
