import React, { useEffect, useState } from 'react';
import { 
  Coins, 
  Loader2, 
  Plus, 
  History,
  CheckCircle2,
  Calendar,
  Tag,
  Hash
} from 'lucide-react';
import api from '../services/api';
import { DenseTable, DenseRow, DenseCell } from '../components/DenseTable';
import { CustomSelect } from '../components/CustomSelect';

export const RecordExpenditure: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [expenditures, setExpenditures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setUploading] = useState(false);
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    category: 'Material',
    amount: 0,
    spend_date: new Date().toISOString().split('T')[0],
    reference_id: '',
    description: '',
    activity_id: '' as string | number
  });

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const res = await api.get('/projects/');
        setProjects(res.data);
        if (res.data.length > 0) setSelectedProjectId(res.data[0].project_id);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchInitial();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      const fetchRelated = async () => {
        try {
          const [actRes, expRes] = await Promise.all([
            api.get(`/tasks/project/${selectedProjectId}/`),
            api.get(`/expenditures/project/${selectedProjectId}/`)
          ]);
          setActivities(actRes.data);
          setExpenditures(expRes.data);
        } catch (err) {
          console.error(err);
        }
      };
      fetchRelated();
    }
  }, [selectedProjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      const payload = {
        ...formData,
        project_id: selectedProjectId,
        activity_id: formData.activity_id === '' ? null : Number(formData.activity_id)
      };
      await api.post('/expenditures/', payload);
      setSuccess('Expenditure logged successfully!');
      setFormData({ ...formData, amount: 0, reference_id: '', description: '', activity_id: '' });
      // Refresh history
      const expRes = await api.get(`/expenditures/project/${selectedProjectId}/`);
      setExpenditures(expRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  if (loading) return (
    <div className="flex h-full items-center justify-center py-20">
      <Loader2 className="w-12 h-12 text-accent-primary animate-spin" />
    </div>
  );

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
          <Coins className="w-7 h-7 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Record Expenditure</h1>
          <p className="text-slate-500 dark:text-slate-400">Log project costs against specific activities or overheads.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="glass rounded-3xl p-8 border-l-4 border-l-emerald-500 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-500" /> New Transaction
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                  <CheckCircle2 className="w-4 h-4" /> {success}
                </div>
              )}

              <CustomSelect 
                label="Select Project"
                value={selectedProjectId}
                onChange={setSelectedProjectId}
                options={projects.map(p => ({ value: p.project_id, label: p.project_name }))}
              />

              <CustomSelect 
                label="Linked Activity (Optional)"
                value={formData.activity_id}
                onChange={(val) => setFormData({...formData, activity_id: val})}
                options={[
                  { value: '', label: 'None / Overhead' },
                  ...activities.map(a => ({ value: a.activity_id, label: a.activity_name }))
                ]}
              />

              <div className="grid grid-cols-2 gap-4">
                <CustomSelect 
                  label="Category"
                  value={formData.category}
                  onChange={(val) => setFormData({...formData, category: val})}
                  options={['Labour', 'Material', 'Vehicle', 'Diesel', 'Other'].map(c => ({ value: c, label: c }))}
                />
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2 px-1">Amount (R)</label>
                  <input 
                    type="number" 
                    value={formData.amount} 
                    onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                    className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all font-bold text-sm" 
                    required 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2 px-1">Spend Date</label>
                <input 
                  type="date" 
                  value={formData.spend_date} 
                  onChange={(e) => setFormData({...formData, spend_date: e.target.value})}
                  className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all font-bold text-sm" 
                  required 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2 px-1">Reference (Invoice/PO) *</label>
                <input 
                  type="text" 
                  value={formData.reference_id} 
                  onChange={(e) => setFormData({...formData, reference_id: e.target.value})}
                  className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all font-bold text-sm" 
                  placeholder="e.g. INV-9901"
                  required 
                />
              </div>

              <button 
                type="submit" 
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 uppercase tracking-widest text-xs shadow-lg shadow-emerald-600/20"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> LOG EXPENDITURE</>}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-[2rem] p-10 border border-slate-200 dark:border-white/5 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-8 flex items-center gap-3 uppercase tracking-widest opacity-50 text-xs">
              <History className="w-5 h-5 text-accent-primary" /> 
              Full Transaction History
            </h3>

            <div className="overflow-hidden">
              <DenseTable headers={['Date', 'Category', 'Reference', 'Amount']}>
                {expenditures.map((exp: any) => (
                  <DenseRow key={exp.exp_id}>
                    <DenseCell>
                      <div className="flex items-center gap-2 py-3">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{exp.spend_date}</span>
                      </div>
                    </DenseCell>
                    <DenseCell>
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-accent-primary opacity-50" />
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">{exp.category}</span>
                      </div>
                    </DenseCell>
                    <DenseCell>
                      <div className="flex items-center gap-2">
                        <Hash className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        <span className="text-xs font-mono text-slate-500">{exp.reference_id}</span>
                      </div>
                    </DenseCell>
                    <DenseCell align="right">
                      <span className="text-base font-black text-slate-900 dark:text-white font-mono">R {exp.amount.toLocaleString()}</span>
                    </DenseCell>
                  </DenseRow>
                ))}
                {expenditures.length === 0 && (
                  <div className="py-20 text-center text-slate-400 dark:text-slate-500 italic uppercase font-black tracking-[0.5em] opacity-20 text-xl">
                    No Records
                  </div>
                )}
              </DenseTable>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordExpenditure;
