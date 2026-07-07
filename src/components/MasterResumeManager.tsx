import React, { useState, useRef } from 'react';
import { Plus, Trash2, Edit2, FileText, Copy, Star, Upload, Download, Eye, RefreshCw } from 'lucide-react';
import { MasterResume } from '../types';

interface MasterResumeManagerProps {
  resumes: MasterResume[];
  onAdd: (resume: MasterResume) => void;
  onUpdate: (resume: MasterResume) => void;
  onDelete: (id: string) => void;
  onSetActive: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDownload: (id: string) => void;
  onPreview: (id: string) => void;
  onSync?: () => void;
  selectedId: string;
  onSelect: (id: string) => void;
  isDarkMode: boolean;
}

export const MasterResumeManager: React.FC<MasterResumeManagerProps> = ({ 
  resumes, onAdd, onUpdate, onDelete, onSetActive, onDuplicate, onDownload, onPreview, onSync, selectedId, onSelect, isDarkMode 
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    if (!newName || resumes.length >= 8) return;
    const newResume: MasterResume = {
      id: Date.now().toString(),
      name: newName,
      description: '',
      data: { personal_info: { name: '', email: '', phone: '', location: '', summary: '' }, experience: [], skills: [] } as any,
      createdAt: Date.now(),
      isActive: false
    };
    onAdd(newResume);
    setNewName('');
    setIsAdding(false);
  };

  const handleImportCurrent = () => {
    if (resumes.length >= 8) return;
    const newResume: MasterResume = {
      id: Date.now().toString(),
      name: `Imported ${new Date().toLocaleDateString()}`,
      description: 'Imported from current workspace',
      data: JSON.parse(localStorage.getItem('resumeText') || '{}'),
      createdAt: Date.now(),
      isActive: false
    };
    onAdd(newResume);
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || resumes.length >= 8) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = JSON.parse(content);
        const newResume: MasterResume = {
          id: Date.now().toString(),
          name: file.name.replace('.json', ''),
          description: 'Imported from file',
          data: parsedData,
          createdAt: Date.now(),
          isActive: false
        };
        onAdd(newResume);
      } catch (err) {
        alert("Error parsing JSON file");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <h3 className="text-sm font-bold uppercase tracking-widest opacity-60">Manage Master Resumes</h3>
            <span className="text-[10px] font-bold text-emerald-500">{resumes.length}/8 Resumes Used</span>
          </div>
          {onSync && (
            <button 
              onClick={onSync}
              title="Sync from Cloud"
              className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20 transition-all flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-tight">Sync Cloud</span>
            </button>
          )}
      </div>
      
      {resumes.map(r => (
        <div key={r.id} className={`p-4 rounded-xl flex items-center justify-between border ${r.isActive ? 'bg-emerald-500/10 border-emerald-500/30' : (isDarkMode ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5')}`}>
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelect(r.id)}>
            <FileText className={`w-5 h-5 ${r.isActive ? 'text-emerald-500' : 'opacity-50'}`} />
            <div>
                <span className="text-sm font-bold block">{r.name}</span>
                {r.isActive && <span className="text-[9px] uppercase font-bold text-emerald-500">Active</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!r.isActive && <button onClick={() => onSetActive(r.id)} title="Set Active" className="p-2 hover:bg-white/10 rounded-lg text-amber-500"><Star className="w-4 h-4" /></button>}
            <button onClick={() => onPreview(r.id)} title="Preview" className="p-2 hover:bg-white/10 rounded-lg text-blue-500"><Eye className="w-4 h-4" /></button>
            <button onClick={() => onDownload(r.id)} title="Download JSON" className="p-2 hover:bg-white/10 rounded-lg text-emerald-500"><Download className="w-4 h-4" /></button>
            <button onClick={() => onDuplicate(r.id)} title="Duplicate" className="p-2 hover:bg-white/10 rounded-lg"><Copy className="w-4 h-4" /></button>
            <button onClick={() => onDelete(r.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      ))}
      <div className="flex gap-2">
           <button onClick={() => fileInputRef.current?.click()} disabled={resumes.length >= 8} className="flex-1 flex items-center justify-center gap-2 text-xs font-bold bg-white/5 py-2 rounded-lg hover:bg-white/10 disabled:opacity-50">
             <Upload className="w-4 h-4" /> Import JSON
           </button>
           <button onClick={handleImportCurrent} disabled={resumes.length >= 8} className="flex-1 flex items-center justify-center gap-2 text-xs font-bold bg-white/5 py-2 rounded-lg hover:bg-white/10 disabled:opacity-50">
             <FileText className="w-4 h-4" /> Import Current
           </button>
           <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".json" className="hidden" />
           {isAdding ? (
             <div className="flex flex-1 gap-2">
               <input className={`flex-1 p-2 text-xs rounded-lg ${isDarkMode ? 'bg-white/10' : 'bg-black/10'}`} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name" />
               <button onClick={handleAdd} className="px-3 py-2 bg-emerald-500 text-black font-bold text-xs rounded-lg">Add</button>
             </div>
           ) : (
             <button onClick={() => setIsAdding(true)} disabled={resumes.length >= 8} className="flex-1 flex items-center justify-center gap-2 text-xs font-bold text-emerald-500 border border-emerald-500/30 py-2 rounded-lg disabled:opacity-50">
               <Plus className="w-4 h-4" /> Add Empty
             </button>
           )}
      </div>
    </div>
  );
};
