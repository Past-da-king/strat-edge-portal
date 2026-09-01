import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff, Sun, Moon, Loader2, ShieldCheck, ArrowLeft, Copy, Check, KeyRound } from 'lucide-react';
import authService from '../services/authService';

type Stage = 'credentials' | 'enrol' | 'code';

export const Login: React.FC = () => {
  const [stage, setStage] = useState<Stage>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // -- 2FA state --
  const [challengeToken, setChallengeToken] = useState('');
  const [code, setCode] = useState('');
  const [enrolment, setEnrolment] = useState<{ qr_data_uri: string; secret: string } | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);

  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [localAllowed, setLocalAllowed] = useState(true);
  const [showLocal, setShowLocal] = useState(false);

  useEffect(() => {
    authService.ssoConfig().then((c) => {
      setSsoEnabled(Boolean(c.enabled));
      // Undefined means an older API that predates the policy — treat that as
      // allowed, the same direction the backend fails in.
      setLocalAllowed(c.local_sign_in_allowed !== false);
    });
  }, []);

  // Hand the browser to Strat Edge ID. The verifier stays here until the code
  // comes back, which is what makes a stolen code useless on its own.
  const startSso = async () => {
    setError('');
    setLoading(true);
    try {
      const { authorize_url, code_verifier } = await authService.ssoStart();
      sessionStorage.setItem('sso_verifier', code_verifier);
      window.location.href = authorize_url;
    } catch (err: any) {
      setError('Could not reach Strat Edge ID. Use your portal password below.');
      setShowLocal(true);
      setLoading(false);
    }
  };

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
      const challenge = await authService.login(username, password);
      setChallengeToken(challenge.challenge_token);

      if (challenge.mfa_enrolled) {
        setStage('code');
      } else {
        // First sign-in on this account: set the authenticator up now.
        const setup = await authService.mfaSetup(challenge.challenge_token);
        setEnrolment({ qr_data_uri: setup.qr_data_uri, secret: setup.secret });
        setStage('enrol');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.mfaVerify(challengeToken, code);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid authentication code');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const restart = () => {
    setStage('credentials');
    setChallengeToken('');
    setEnrolment(null);
    setCode('');
    setError('');
    setPassword('');
  };

  const copySecret = () => {
    if (!enrolment) return;
    navigator.clipboard?.writeText(enrolment.secret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const errorBox = error && (
    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 dark:text-red-400 text-xs font-bold uppercase tracking-wider animate-in fade-in slide-in-from-top-2 text-center">
      {error}
    </div>
  );

  const codeInput = (
    <div>
      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 px-1">Authentication Code</label>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-5 py-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all font-black text-center text-2xl tracking-[0.5em] placeholder:text-slate-400 dark:placeholder:text-slate-700 placeholder:tracking-[0.3em] placeholder:text-base"
        placeholder="000000"
        autoFocus
        required
      />
    </div>
  );

  const submitButton = (label: string) => (
    <button
      type="submit"
      disabled={loading}
      className="w-full bg-accent-primary hover:bg-accent-secondary text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-accent-primary/20 uppercase tracking-[0.2em] text-xs"
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
        <>
          {label}
          <LogIn className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-300" />
        </>
      )}
    </button>
  );

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

          {/* --- STAGE 1: USERNAME + PASSWORD --- */}
          {stage === 'credentials' && (
            <>
              <h2 className="text-xl font-black text-slate-900 dark:text-white mb-8 uppercase tracking-tight text-center">System Authentication</h2>

              {ssoEnabled && (
                <div className="mb-8">
                  <button
                    onClick={startSso}
                    disabled={loading}
                    className="w-full bg-accent-primary hover:bg-accent-secondary text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl shadow-accent-primary/20 uppercase tracking-[0.2em] text-xs disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><KeyRound className="w-4 h-4" /> Sign in with Strat Edge ID</>}
                  </button>
                  <p className="mt-3 text-center text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                    One account for every Strat Edge application
                  </p>
                  {!showLocal && localAllowed && (
                    <button
                      onClick={() => setShowLocal(true)}
                      className="w-full mt-6 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-accent-primary transition-colors"
                    >
                      Use a portal password instead
                    </button>
                  )}
                  {!localAllowed && (
                    <p className="mt-6 text-center text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Accounts here are created in Strat Edge ID
                    </p>
                  )}
                </div>
              )}

              <form onSubmit={handleLogin} className={`space-y-6 ${(ssoEnabled && !showLocal) || !localAllowed ? 'hidden' : ''}`}>
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

                {errorBox}
                {submitButton('Establish Connection')}
              </form>
            </>
          )}

          {/* --- STAGE 2A: FIRST-TIME AUTHENTICATOR ENROLMENT --- */}
          {stage === 'enrol' && enrolment && (
            <>
              <div className="flex flex-col items-center mb-8">
                <div className="w-14 h-14 bg-accent-primary/10 rounded-2xl flex items-center justify-center border border-accent-primary/20 mb-4">
                  <ShieldCheck className="w-7 h-7 text-accent-primary" />
                </div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight text-center">Set Up Two-Factor</h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2 text-center leading-relaxed">
                  Scan with Google Authenticator<br />or any TOTP app
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl w-fit mx-auto mb-6 shadow-lg">
                <img src={enrolment.qr_data_uri} alt="Two-factor QR code" className="w-44 h-44" />
              </div>

              <button
                type="button"
                onClick={copySecret}
                className="w-full mb-8 p-4 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl flex items-center justify-between gap-3 hover:border-accent-primary/30 transition-all group"
              >
                <div className="text-left min-w-0">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Or enter this key manually</p>
                  <p className="font-mono text-xs text-slate-900 dark:text-slate-200 font-bold truncate">{enrolment.secret}</p>
                </div>
                {secretCopied
                  ? <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  : <Copy className="w-4 h-4 text-slate-500 group-hover:text-accent-primary flex-shrink-0" />}
              </button>

              <form onSubmit={handleVerify} className="space-y-6">
                {codeInput}
                {errorBox}
                {submitButton('Confirm & Sign In')}
              </form>

              <button onClick={restart} className="w-full mt-6 text-slate-500 hover:text-accent-primary text-[9px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Start over
              </button>
            </>
          )}

          {/* --- STAGE 2B: RETURNING USER, CODE ONLY --- */}
          {stage === 'code' && (
            <>
              <div className="flex flex-col items-center mb-8">
                <div className="w-14 h-14 bg-accent-primary/10 rounded-2xl flex items-center justify-center border border-accent-primary/20 mb-4">
                  <ShieldCheck className="w-7 h-7 text-accent-primary" />
                </div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight text-center">Two-Factor Verification</h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2 text-center">
                  Enter the 6-digit code from your authenticator
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-6">
                {codeInput}
                {errorBox}
                {submitButton('Verify & Sign In')}
              </form>

              <button onClick={restart} className="w-full mt-6 text-slate-500 hover:text-accent-primary text-[9px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Use a different account
              </button>
            </>
          )}
        </div>

        <p className="mt-10 text-center text-slate-500 text-[9px] tracking-[0.3em] font-black uppercase opacity-50">
          © 2026 Strat Edge Solutions | Secure Portal V2
        </p>
      </div>
    </div>
  );
};
