import React, { useEffect, useState } from 'react';
import { 
  AlertTriangle, 
  Loader2, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Plus, 
  ShieldCheck,
  Search,
  Upload,
  FileText
} from 'lucide-react';
import axios from 'axios';
import riskService from '../services/riskService';
import { DenseTable, DenseRow, DenseCell } from '../components/DenseTable';
import { Modal } from '../components/Modal';
import { CustomSelect } from '../components/CustomSelect';

export const Risks: React.FC = () => {
  const [risks, setRisks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [resolveModal, setResolveModal] = useState<{ isOpen: boolean; riskId: number | null; description: string }>({
    isOpen: false,
    riskId: null,
    description: ''
  });

  const getAuthHeader = () => ({ 
    headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('user') || '{}').access_token}` } 
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projRes, riskRes] = await Promise.all([
          axios.get('/api/projects/', getAuthHeader()),
          riskService.getRisks()
        ]);
        setProjects(projRes.data);
        setRisks(riskRes);
        if (projRes.data.length > 0) setSelectedProjectId(projRes.data[0].project_id);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleResolve = (risk: any) => {
    setResolveModal({ isOpen: true, riskId: risk.risk_id, description: risk.description });
  };

  const getImpactBadge = (impact: string) => {
    const colors = {
      H: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
      M: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      L: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    };
    const label = impact === 'H' ? 'CRITICAL' : impact === 'M' ? 'ELEVATED' : 'MODERATE';
    return <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${colors[impact as keyof typeof colors]}`}>{label}</span>;
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-4xl font-black text-white mb-2 tracking-tighter flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
              <AlertTriangle className="w-7 h-7 text-amber-500" />
            </div>
            RISK REGISTER
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] ml-16">Portfolio Exposure & Mitigation Tracking</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-rose-600 hover:bg-rose-500 text-white px-8 py-4 rounded-[1.5rem] font-black uppercase tracking-widest text-xs transition-all flex items-center gap-3 shadow-2xl shadow-rose-600/20 group border border-rose-500/20"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
          LOG NEW RISK
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <StatCard label="Active Open Risks" value={risks.filter(r => r.status === 'Open').length} color="text-rose-500" />
        <StatCard label="Mitigation in Progress" value={risks.filter(r => r.status === 'Mitigated').length} color="text-amber-500" />
        <StatCard label="Resolved & Closed" value={risks.filter(r => r.status === 'Resolved' || r.status === 'Closed').length} color="text-emerald-500" />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="w-16 h-16 text-accent-primary animate-spin opacity-20" />
        </div>
      ) : (
        <div className="glass rounded-[2rem] p-10 border border-white/5 shadow-2xl">
          <DenseTable headers={['Description', 'Impact', 'Status', 'Mitigation Plan', 'Actions']}>
            {risks.map((risk: any) => (
              <DenseRow key={risk.risk_id}>
                <DenseCell flex={4}>
                  <div className="flex items-center gap-4 py-4">
                    {risk.status === 'Open' ? <Clock className="w-5 h-5 text-rose-500 opacity-50" /> : <ShieldCheck className="w-5 h-5 text-emerald-500" />}
                    <span className="font-black text-slate-200 uppercase tracking-tight text-sm leading-tight">{risk.description}</span>
                  </div>
                </DenseCell>
                <DenseCell flex={1.5} align="center">
                  {getImpactBadge(risk.impact)}
                </DenseCell>
                <DenseCell align="center">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">{risk.status}</span>
                </DenseCell>
                <DenseCell flex={3}>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed italic">{risk.mitigation_action || 'No plan defined'}</p>
                </DenseCell>
                <DenseCell align="right">
                  {risk.status === 'Open' && (
                    <button 
                      onClick={() => handleResolve(risk)}
                      className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black tracking-widest border border-emerald-500/20 transition-all duration-500 uppercase"
                    >
                      RESOLVE
                    </button>
                  )}
                </DenseCell>
              </DenseRow>
            ))}
          </DenseTable>
          {risks.length === 0 && <div className="py-40 text-center text-slate-500 uppercase font-black tracking-[0.5em] opacity-20 text-4xl italic">No Risks Logged</div>}
        </div>
      )}

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Log New Project Risk">
        <AddRiskForm 
          projects={projects} 
          onSuccess={() => {
            setIsAddModalOpen(false);
            riskService.getRisks().then(setRisks);
          }} 
        />
      </Modal>

      <Modal isOpen={resolveModal.isOpen} onClose={() => setResolveModal({ isOpen: false, riskId: null, description: '' })} title="Resolve Risk">
        <div className="space-y-8">
          <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3 opacity-50 px-1">Risk Description</p>
            <p className="text-slate-200 font-bold text-lg leading-tight uppercase tracking-tight">{resolveModal.description}</p>
          </div>
          <div className="border-2 border-dashed border-white/5 rounded-[2rem] p-16 text-center hover:border-accent-primary/20 transition-all cursor-pointer bg-black/20 group">
            <Upload className="w-12 h-12 text-slate-600 mx-auto mb-4 group-hover:text-accent-primary transition-colors" />
            <p className="text-slate-300 font-black text-sm uppercase tracking-widest">Upload Closure Proof</p>
            <p className="text-slate-500 text-[10px] mt-2 uppercase font-bold tracking-widest opacity-50">Legal requirement for resolution</p>
          </div>
          <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] shadow-2xl shadow-emerald-600/20">
            <CheckCircle2 className="w-6 h-6" /> CONFIRM RESOLUTION
          </button>
        </div>
      </Modal>
    </div>
  );
};

const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="glass p-8 rounded-[2rem] border border-white/5 shadow-xl group hover:border-white/10 transition-all">
    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 group-hover:text-slate-400 transition-colors">{label}</p>
    <p className={`text-5xl font-black ${color} tracking-tighter`}>{value}</p>
  </div>
);

const AddRiskForm: React.FC<{ projects: any[]; onSuccess: () => void }> = ({ projects, onSuccess }) => {
  const [formData, setFormData] = useState({
    project_id: projects[0]?.project_id || '',
    description: '',
    impact: 'M',
    mitigation_action: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/risks/', formData, {
        headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('user') || '{}').access_token}` }
      });
      onSuccess();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <CustomSelect 
        label="Select Project"
        value={formData.project_id}
        onChange={val => setFormData({...formData, project_id: val})}
        options={projects.map(p => ({ value: p.project_id, label: p.project_name }))}
      />
      
      <div>
        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 px-1">Risk Description *</label>
        <input 
          type="text" 
          value={formData.description}
          onChange={e => setFormData({...formData, description: e.target.value})}
          className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all font-bold" 
          placeholder="e.g. DELAY IN MATERIALS..."
          required 
        />
      </div>

      <div>
        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 px-1">Severity Impact</label>
        <div className="flex gap-3">
          {['L', 'M', 'H'].map(level => (
            <button
              key={level}
              type="button"
              onClick={() => setFormData({...formData, impact: level})}
              className={`flex-1 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] border transition-all duration-500 ${
                formData.impact === level 
                  ? 'bg-accent-primary text-white border-accent-primary shadow-lg shadow-accent-primary/20' 
                  : 'bg-black/40 text-slate-500 border-white/5 hover:border-white/10'
              }`}
            >
              {level === 'L' ? 'Low' : level === 'M' ? 'Medium' : 'High'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 px-1">Mitigation Plan</label>
        <textarea 
          value={formData.mitigation_action}
          onChange={e => setFormData({...formData, mitigation_action: e.target.value})}
          className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all h-32 font-medium leading-relaxed" 
          placeholder="Describe how to handle this risk..."
        />
      </div>

      <button type="submit" className="w-full bg-accent-primary hover:bg-accent-secondary text-white font-black py-5 rounded-[1.5rem] transition-all uppercase tracking-[0.2em] shadow-2xl shadow-accent-primary/20">
        REGISTER RISK
      </button>
    </form>
  );
};

export default Risks;
