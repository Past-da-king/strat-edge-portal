import React from 'react';

interface TableProps {
  headers: string[];
  children: React.ReactNode;
}

/**
 * DenseTable - Truly Adaptive Component
 * Desktop: Standard high-density table
 * Mobile: Clean vertical card stack
 */
export const DenseTable: React.FC<TableProps> = ({ headers, children }) => {
  return (
    <div className="w-full">
      {/* Desktop Header - Hidden on Mobile */}
      <div className="hidden lg:flex border-b border-slate-200 dark:border-white/10 pt-8 pb-6 mb-4 px-4">
        {headers.map((h, i) => {
          // Precise alignment for desktop headers
          let alignment = 'text-left';
          if (h.toLowerCase() === 'status') alignment = 'text-center';
          if (h.toLowerCase() === 'actions' || h.toLowerCase() === 'action' || i === headers.length - 1) alignment = 'text-right';

          return (
            <div key={i} className={`
              text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] px-4
              ${i === 0 ? 'flex-[3]' : 'flex-1'}
              ${alignment}
            `}>
              {h}
            </div>
          );
        })}
      </div>
      
      {/* Body */}
      <div className="flex flex-col gap-4 lg:gap-0">
        {children}
      </div>
    </div>
  );
};

export const DenseRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col lg:flex-row lg:items-center min-h-[44px] border border-slate-200 dark:border-white/5 lg:border-0 lg:border-b last:border-b-0 bg-white dark:bg-white/[0.02] lg:bg-transparent rounded-2xl lg:rounded-none p-5 lg:py-2.5 lg:px-4 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all duration-500 group shadow-sm lg:shadow-none">
    {children}
  </div>
);

export const DenseCell: React.FC<{ 
  children: React.ReactNode; 
  flex?: number; 
  align?: 'left'|'center'|'right';
  label?: string; 
  onClick?: () => void;
}> = ({ 
  children, flex = 1, align = 'left', label, onClick
}) => {
  const alignmentClass = align === 'right' ? 'lg:text-right' : align === 'center' ? 'lg:text-center' : 'lg:text-left';
  const justifyClass = align === 'right' ? 'lg:justify-end' : align === 'center' ? 'lg:justify-center' : 'lg:justify-start';
  
  return (
    <div 
      className={`flex flex-col lg:flex lg:flex-row px-0 lg:px-4 mb-3 last:mb-0 lg:mb-0 ${alignmentClass} ${justifyClass} ${onClick ? 'cursor-pointer' : ''}`}
      style={{ flex: flex }}
      onClick={onClick}
    >
      {label && (
        <span className="lg:hidden text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-1.5">
          {label}
        </span>
      )}
      <div className={`text-sm lg:text-base text-slate-700 dark:text-slate-200 font-bold leading-relaxed tracking-normal flex ${justifyClass}`}>
        {children}
      </div>
    </div>
  );
};
