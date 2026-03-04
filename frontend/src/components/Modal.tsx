import React, { useEffect } from 'react';
import { X, ArrowLeft } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl' | 'full';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  // If size is 'full' or 'xl', we render a completely different layout that is a true full-screen page
  if (size === 'full' || size === 'xl') {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col animate-in fade-in slide-in-from-bottom-6 duration-500">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 dark:border-white/5 bg-sidebar dark:bg-[#0f1115]">
          <div className="flex items-center gap-6">
            <button 
              onClick={onClose} 
              className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all group px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1.5 transition-transform duration-300" />
              <span className="font-black text-[10px] uppercase tracking-[0.2em]">Return to Dashboard</span>
            </button>
            <div className="w-px h-8 bg-slate-200 dark:bg-white/10" />
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">{title}</h2>
              <div className="h-1 w-12 bg-accent-primary mt-2 rounded-full" />
            </div>
          </div>
          
          <button 
            onClick={onClose} 
            className="p-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-all group border border-slate-200 dark:border-white/5"
          >
            <X className="w-6 h-6 text-slate-500 group-hover:text-rose-500 group-hover:rotate-90 transition-all duration-500" />
          </button>
        </div>

        {/* Content Area - No Max Width, Full Height */}
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          <div className="w-full h-full">
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Standard modal layout for smaller views
  const sizeClasses = {
    md: 'max-w-lg',
    lg: 'max-w-3xl',
    xl: '', // handled above
    full: '' // handled above
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-[2px] animate-in fade-in duration-300">
      <div className={`bg-sidebar dark:bg-[#0f1115] border border-slate-200 dark:border-white/10 rounded-[2.5rem] w-full ${sizeClasses[size]} shadow-[0_0_100px_rgba(0,0,0,0.1)] dark:shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in duration-500 flex flex-col max-h-[90vh]`}>
        <div className="flex items-center justify-between p-10 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5">
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">{title}</h3>
            <div className="h-1 w-10 bg-accent-primary mt-3 rounded-full" />
          </div>
          <button onClick={onClose} className="p-3 bg-slate-100 dark:bg-white/5 hover:bg-rose-500/10 hover:text-rose-500 rounded-2xl transition-all group">
            <X className="w-6 h-6 text-slate-500 group-hover:rotate-90 transition-transform duration-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};
