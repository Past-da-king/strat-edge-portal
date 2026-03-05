import React, { useState, useEffect } from 'react';
import { User, Save, Loader2, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import authService from '../services/authService';
import { useNavigate } from 'react-router-dom';

export const UserSettings = () => {
    const [username, setUsername] = useState('');
    const [fullName, setFullName] = useState('');
    const [oldPassword, setOldPassword] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const navigate = useNavigate();

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                setUsername(user.username || '');
                setFullName(user.full_name || '');
            } catch (e) {
                console.error("Failed to parse user data", e);
            }
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (password && password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setIsLoading(true);

        try {
            const payload: any = {};
            if (username) payload.username = username;
            if (fullName) payload.full_name = fullName;
            if (password) {
                payload.password = password;
                payload.old_password = oldPassword;
            }

            const updatedUser = await authService.updateMyProfile(payload);

            // Update local storage user data keeping the token
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const currentUserData = JSON.parse(userStr);
                const newData = {
                    ...currentUserData,
                    username: updatedUser.username,
                    full_name: updatedUser.full_name,
                };
                localStorage.setItem('user', JSON.stringify(newData));
            }

            if (password) {
                setSuccess("Profile and password updated successfully. Please log in again.");
                setTimeout(() => {
                    authService.logout();
                    navigate('/login');
                }, 2000);
            } else {
                setSuccess("Profile updated successfully");
                setOldPassword('');
                setPassword('');
                setConfirmPassword('');
            }

        } catch (err: any) {
            console.error(err);
            if (err.response?.data?.detail) {
                setError(err.response.data.detail);
            } else {
                setError('Failed to update profile. Please try again.');
            }
        } finally {
            setIsLoading(false);
            setTimeout(() => { setSuccess(null); setError(null); }, 3000);
        }
    };

    return (
        <div className="p-8 max-w-[1000px] mx-auto animate-in fade-in duration-500">
            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-accent-primary/10 rounded-xl flex items-center justify-center border border-accent-primary/20">
                    <User className="w-7 h-7 text-accent-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">User Settings</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Manage your personal account information and password.</p>
                </div>
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
                <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">
                                Username
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3.5 text-sm text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700"
                                placeholder="johndoe"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">
                                Full Name
                            </label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3.5 text-sm text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700"
                                placeholder="John Doe"
                            />
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-200 dark:border-white/10">
                        <h3 className="text-sm font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Security</h3>
                        <p className="text-[10px] tracking-widest text-slate-500 dark:text-slate-400 font-medium uppercase mb-6">Leave blank if you do not want to change your password.</p>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">
                                    Old Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showOldPassword ? "text" : "password"}
                                        value={oldPassword}
                                        onChange={(e) => setOldPassword(e.target.value)}
                                        className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3.5 pr-12 text-sm text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowOldPassword(!showOldPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-accent-primary transition-colors"
                                    >
                                        {showOldPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">
                                        New Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3.5 pr-12 text-sm text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700"
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-accent-primary transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">
                                        Confirm New Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showConfirmPassword ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3.5 pr-12 text-sm text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700"
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-accent-primary transition-colors"
                                        >
                                            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-8">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full md:w-auto bg-accent-primary hover:bg-accent-secondary text-white font-black px-10 py-5 rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] shadow-2xl shadow-accent-primary/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    SAVING...
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    SAVE SETTINGS
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
