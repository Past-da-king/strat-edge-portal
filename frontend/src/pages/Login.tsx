import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff, Sun, Moon, Loader2 } from 'lucide-react';
import authService from '../services/authService';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.login(username, password);
      navigate('/');
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.message || 'Login failed';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden transition-colors duration-300">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent-primary/5 rounded-full blur-[120px] pointer-events-none" />
      
      <button 
        onClick={() => setIsDark(!isDark)}
        className="absolute top-8 right-8 p-3 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-accent-primary border border-slate-200 dark:border-white/10 transition-all"
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-10">
          <img src="/logo.png" alt="Strat Edge Logo" className="w-20 h-20 mb-6 drop-shadow-[0_0_15px_rgba(14,165,233,0.3)]" />
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">
            STRAT EDGE
          </h1>
          <p className="text-[10px] uppercase tracking-[0.4em] text-accent-secondary font-black mt-2">Project Portal</p>
        </div>

        <div className="glass p-10 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-2xl">
          <h2 className="text-xl font-black text-slate-900 dark:text-white mb-8 uppercase tracking-tight text-center">System Authentication</h2>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 px-1">Access Identity</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-5 py-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all font-bold placeholder:text-slate-400 dark:placeholder:text-slate-700"
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
                  className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-5 py-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all font-bold placeholder:text-slate-400 dark:placeholder:text-slate-700"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-accent-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 dark:text-red-400 text-xs font-bold uppercase tracking-wider animate-in fade-in slide-in-from-top-2 text-center">
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
        
        <p className="mt-10 text-center text-slate-500 text-[9px] tracking-[0.3em] font-black uppercase opacity-50">
          © 2026 Strat Edge Solutions | Secure Portal V2
        </p>
      </div>
    </div>
  );
};
