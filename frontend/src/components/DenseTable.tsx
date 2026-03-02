import React from 'react';

interface TableProps {
  headers: string[];
  children: React.ReactNode;
}

export const DenseTable: React.FC<TableProps> = ({ headers, children }) => {
  return (
    <div className="w-full text-left border-collapse overflow-visible">
      {/* Header */}
      <div className="flex border-b border-white/10 pb-6 mb-6">
        {headers.map((h, i) => (
          <div key={i} className={`
            text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] px-4
            ${i === 0 ? 'flex-[3]' : 'flex-1'}
            ${i === headers.length - 1 ? 'text-right' : 'text-left'}
          `}>
            {h}
          </div>
        ))}
      </div>
      
      {/* Body */}
      <div className="flex flex-col gap-2">
        {children}
      </div>
    </div>
  );
};

export const DenseRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center min-h-[44px] border-b border-white/5 hover:bg-white/[0.02] transition-all duration-500 group py-1.5">
    {children}
  </div>
);

export const DenseCell: React.FC<{ children: React.ReactNode; flex?: number; align?: 'left'|'center'|'right' }> = ({ 
  children, flex = 1, align = 'left' 
}) => (
  <div 
    className={`text-base text-slate-200 px-4 font-bold leading-relaxed tracking-normal`}
    style={{ flex, textAlign: align }}
  >
    {children}
  </div>
);
