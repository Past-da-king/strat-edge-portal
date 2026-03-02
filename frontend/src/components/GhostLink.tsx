
import React, { useState } from 'react';
import { FileText, Download, Loader2 } from 'lucide-react';

interface GhostLinkProps {
  fileName: string;
  onFetch: () => Promise<Blob>;
  uploaderInfo?: string;
}

/**
 * GhostLink Component - SOLID Principles: Single Responsibility
 * A minimalist link that fetches data only on demand.
 * No boxes, no padding, zero waste.
 */
export const GhostLink: React.FC<GhostLinkProps> = ({ fileName, onFetch, uploaderInfo }) => {
  const [status, setStatus] = useState<'idle' | 'fetching' | 'ready'>('idle');
  const [fileBlob, setFileBlob] = useState<Blob | null>(null);

  const handleTrigger = async () => {
    setStatus('fetching');
    try {
      const blob = await onFetch();
      setFileBlob(blob);
      setStatus('ready');
    } catch (error) {
      console.error('Fetch failed', error);
      setStatus('idle');
    }
  };

  const handleDownload = () => {
    if (!fileBlob) return;
    const url = window.URL.createObjectURL(fileBlob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    setStatus('idle');
    setFileBlob(null);
  };

  return (
    <div className="flex items-center gap-2 group min-h-[24px]">
      <FileText className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
      
      {status === 'idle' && (
        <button 
          onClick={handleTrigger}
          className="text-cyan-400 hover:text-white hover:underline font-medium text-sm transition-all"
        >
          {fileName}
        </button>
      )}

      {status === 'fetching' && (
        <div className="flex items-center gap-2 text-slate-400 text-sm italic">
          <Loader2 className="w-3 h-3 animate-spin" />
          Fetching...
        </div>
      )}

      {status === 'ready' && (
        <button 
          onClick={handleDownload}
          className="text-emerald-400 hover:text-emerald-300 underline font-semibold text-sm flex items-center gap-1 animate-in fade-in"
        >
          <Download className="w-3 h-3" />
          Save {fileName}
        </button>
      )}

      {uploaderInfo && (
        <span className="ml-auto text-[10px] text-slate-500 uppercase tracking-wider font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
          {uploaderInfo}
        </span>
      )}
    </div>
  );
};
