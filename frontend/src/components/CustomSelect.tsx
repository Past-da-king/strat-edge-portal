import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string | number;
  label: string;
}

interface CustomSelectProps {
  label?: string;
  value: string | number | null;
  onChange: (value: any) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ 
  label, value, onChange, options, placeholder = "Select...", className = "" 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => String(opt.value) === String(value));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 px-1">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3.5 text-left text-slate-900 dark:text-white flex items-center justify-between hover:border-slate-300 dark:hover:border-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-accent-primary/20 group shadow-sm"
      >
        <span className={`truncate mr-2 ${selectedOption ? "text-slate-900 dark:text-slate-200 font-bold text-sm" : "text-slate-500 text-sm font-medium"}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-[100] w-full mt-2 bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-2xl">
          <div className="max-h-60 overflow-y-auto custom-scrollbar p-1.5">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-3 rounded-xl text-left text-sm font-bold transition-all mb-0.5 last:mb-0 ${
                  String(opt.value) === String(value) 
                    ? 'text-accent-primary bg-accent-primary/10' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
            {options.length === 0 && (
              <div className="px-4 py-10 text-center text-xs text-slate-500 italic uppercase tracking-widest font-black opacity-50">
                No items found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
