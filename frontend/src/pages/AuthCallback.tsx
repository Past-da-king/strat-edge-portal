import React, { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import authService from '../services/authService';

/**
 * Where Strat Edge ID sends people back to. It carries a one-time code; we swap
 * that for a portal session and drop them where they were going.
 */
export const AuthCallback: React.FC = () => {
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const verifier = sessionStorage.getItem('sso_verifier');

    if (!code || !verifier) {
      setError('That sign-in link was incomplete. Please start again.');
      return;
    }

    authService
      .ssoCallback(code, verifier)
      .then(() => {
        sessionStorage.removeItem('sso_verifier');
        window.location.href = '/';
      })
      .catch((err: any) => {
        setError(err.response?.data?.detail || 'Sign-in failed. Please try again.');
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="glass p-10 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-2xl max-w-md text-center">
        {error ? (
          <>
            <div className="w-14 h-14 bg-rose-500/10 rounded-2xl flex items-center justify-center border border-rose-500/20 mx-auto mb-5">
              <AlertTriangle className="w-7 h-7 text-rose-500" />
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-8">{error}</p>
            <a href="/login" className="px-6 py-3 bg-accent-primary text-white rounded-xl font-black text-[10px] uppercase tracking-widest">
              Back to sign in
            </a>
          </>
        ) : (
          <>
            <Loader2 className="w-10 h-10 text-accent-primary animate-spin mx-auto mb-5" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
              Signing you in…
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
