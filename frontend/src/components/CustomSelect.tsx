import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
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

// Tallest the list may grow (matches max-h-60) plus the gap under the button.
const MENU_MAX = 240;
const GAP = 8;

interface MenuBox {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  label, value, onChange, options, placeholder = "Select...", className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [box, setBox] = useState<MenuBox | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => String(opt.value) === String(value));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // The list is drawn in a portal on <body> so no card, glass panel or
  // scrolling container can clip it or paint over it. It is pinned to the
  // button, and flips upward when there is not enough room below.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const r = buttonRef.current?.getBoundingClientRect();
      if (!r) return;
      // Below lg the layout pins an 80px nav bar to the bottom of the screen.
      const bottomBar = window.innerWidth < 1024 ? 80 : 0;
      const below = window.innerHeight - bottomBar - r.bottom - GAP;
      const above = r.top - GAP;
      const width = Math.min(Math.max(r.width, 220), window.innerWidth - 16);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      if (below >= Math.min(MENU_MAX, 160) || below >= above) {
        setBox({ left, width, top: r.bottom + GAP, maxHeight: Math.min(MENU_MAX, below - 8) });
      } else {
        setBox({ left, width, bottom: window.innerHeight - r.top + GAP, maxHeight: Math.min(MENU_MAX, above - 8) });
      }
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 px-1">
          {label}
        </label>
      )}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3.5 text-left text-slate-900 dark:text-white flex items-center justify-between hover:border-slate-300 dark:hover:border-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-accent-primary/20 group shadow-sm"
      >
        <span className={`truncate mr-2 ${selectedOption ? "text-slate-900 dark:text-slate-200 font-bold text-sm" : "text-slate-500 text-sm font-medium"}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && box && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', left: box.left, width: box.width, top: box.top, bottom: box.bottom }}
          className="z-[3100] bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in duration-200"
        >
          <div style={{ maxHeight: box.maxHeight }} className="overflow-y-auto overflow-x-hidden custom-scrollbar p-1.5">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-3 rounded-xl text-left text-sm font-bold break-words transition-all mb-0.5 last:mb-0 ${
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
        </div>,
        document.body
      )}
    </div>
  );
};
