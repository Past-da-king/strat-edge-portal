import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import authService from '../services/authService';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c] p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent-primary/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-10">
          <img src="/logo.png" alt="Strat Edge Logo" className="w-20 h-20 mb-6 drop-shadow-[0_0_15px_rgba(14,165,233,0.3)]" />
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">
            STRAT EDGE
          </h1>
          <p className="text-[10px] uppercase tracking-[0.4em] text-accent-secondary font-black mt-2">Project Portal</p>
        </div>

        <div className="glass p-10 rounded-[2.5rem] border border-white/5 shadow-2xl">
          <h2 className="text-xl font-black text-white mb-8 uppercase tracking-tight">System Authentication</h2>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 px-1">Access Identity</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all font-bold placeholder:text-slate-700"
                placeholder="Username"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 px-1">Security Key</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all font-bold placeholder:text-slate-700"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold uppercase tracking-wider animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent-primary hover:bg-accent-secondary text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-accent-primary/20 uppercase tracking-[0.2em] text-xs"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  Establish Connection
                  <LogIn className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-300" />
                </>
              )}
            </button>
          </form>
        </div>
        
        <p className="mt-10 text-center text-slate-600 text-[9px] tracking-[0.3em] font-black uppercase opacity-50">
          © 2026 Strat Edge Solutions | Secure Portal V2
        </p>
      </div>
    </div>
  );
};

import { Loader2 } from 'lucide-react';
