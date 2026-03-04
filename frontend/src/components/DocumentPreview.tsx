import React from 'react';
import { X, Download, FileText, Loader2, ExternalLink } from 'lucide-react';

interface DocumentPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  fileUrl: string;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({ isOpen, onClose, fileName, fileUrl }) => {
  if (!isOpen) return null;

  const getFileType = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '')) return 'image';
    if (ext === 'pdf') return 'pdf';
    if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext || '')) return 'office';
    return 'other';
  };

  const type = getFileType(fileName);

  const renderContent = () => {
    switch (type) {
      case 'image':
        return (
          <div className="w-full h-full flex items-center justify-center p-4 lg:p-12">
            <img 
              src={fileUrl} 
              alt={fileName} 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300" 
            />
          </div>
        );
      case 'pdf':
        return (
          <iframe 
            src={`${fileUrl}#toolbar=1`} 
            className="w-full h-full border-0 rounded-b-2xl"
            title={fileName}
          />
        );
      case 'office':
        // Use Microsoft Office Online Viewer
        const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
        return (
          <iframe 
            src={officeUrl} 
            className="w-full h-full border-0 rounded-b-2xl bg-white"
            title={fileName}
          />
        );
      default:
        return (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-12">
            <div className="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-3xl flex items-center justify-center mb-6 border border-slate-200 dark:border-white/10">
              <FileText className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase mb-4 tracking-tighter">Preview Unavailable</h3>
            <p className="text-slate-500 max-w-xs mb-8 font-medium">This file type cannot be previewed within the application. Please download the document to view its contents.</p>
            <button 
              onClick={() => window.open(fileUrl, '_blank')}
              className="bg-accent-primary hover:bg-accent-secondary text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all flex items-center gap-3"
            >
              <Download className="w-4 h-4" /> Download Document
            </button>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-900/60 dark:bg-black/90 backdrop-blur-md flex items-center justify-center p-4 lg:p-10 animate-in fade-in duration-300">
      <div className="w-full h-full max-w-7xl bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-500">
        
        {/* Top Header */}
        <div className="px-8 py-5 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-white/5">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 bg-accent-primary/10 rounded-xl flex items-center justify-center text-accent-primary flex-shrink-0">
              {type === 'image' ? <FileText className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{fileName}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[8px] font-black text-accent-primary uppercase tracking-widest px-2 py-0.5 bg-accent-primary/10 rounded border border-accent-primary/20">
                  {type.toUpperCase()} PREVIEW
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => window.open(fileUrl, '_blank')}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-slate-500 dark:text-slate-400 font-black text-[9px] uppercase tracking-widest transition-all border border-slate-200 dark:border-white/10"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </button>
            <button 
              onClick={onClose}
              className="p-3 bg-slate-100 dark:bg-white/5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 rounded-xl transition-all border border-slate-200 dark:border-white/10"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 relative overflow-hidden">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};
