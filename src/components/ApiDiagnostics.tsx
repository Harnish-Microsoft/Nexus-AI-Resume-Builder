import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, Cpu, Database, Save } from 'lucide-react';
import { auth } from '../firebase';

export const ApiDiagnostics: React.FC = () => {
  const [results, setResults] = useState<{
    gemini?: { status: 'loading' | 'success' | 'error', message?: string },
    openai?: { status: 'loading' | 'success' | 'error', message?: string }
  }>({});
  const [geminiKey, setGeminiKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [keyMeta, setKeyMeta] = useState<{ geminiStatus: string, openaiStatus: string, type: string } | null>(null);

  const fetchKeyStatus = async () => {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return;
    try {
      const response = await fetch('/api/key-status', {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      const data = await response.json();
      setKeyMeta(data);
    } catch (e) {
      console.error(e);
    }
  };

  React.useEffect(() => {
    fetchKeyStatus();
  }, []);

  const runDiagnostics = async () => {
    setResults({
      gemini: { status: 'loading' },
      openai: { status: 'loading' }
    });

    const idToken = await auth.currentUser?.getIdToken();

    // Gemini
    fetch('/api/diagnose/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    })
      .then(r => r.json())
      .then(data => {
        setResults(prev => ({ ...prev, gemini: data.error ? { status: 'error', message: data.error } : { status: 'success' } }));
      })
      .catch(() => setResults(prev => ({ ...prev, gemini: { status: 'error', message: 'Connection failed' } })));

    // OpenAI
    fetch('/api/diagnose/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    })
      .then(r => r.json())
      .then(data => {
        setResults(prev => ({ ...prev, openai: data.error ? { status: 'error', message: data.error } : { status: 'success' } }));
      })
      .catch(() => setResults(prev => ({ ...prev, openai: { status: 'error', message: 'Connection failed' } })));
  };

  const updateKeys = async () => {
    setUpdateStatus('loading');
    const idToken = await auth.currentUser?.getIdToken();
    try {
        const response = await fetch('/api/update-keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken, geminiKey, openaiKey })
        });
        if (!response.ok) throw new Error('Failed to update keys');
        setUpdateStatus('success');
        fetchKeyStatus();
        setGeminiKey("");
        setOpenaiKey("");
        setTimeout(() => setUpdateStatus('idle'), 3000);
    } catch (e) {
        setUpdateStatus('error');
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest">System Diagnostics & Keys</h2>
        <div className="flex items-center gap-2">
          <button onClick={fetchKeyStatus} className="p-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 opacity-50 hover:opacity-100">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={runDiagnostics} className="px-3 py-1 bg-blue-500 text-white rounded text-[10px] font-bold">
            Run Tests
          </button>
        </div>
      </div>
      
      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400">Current Session Source:</p>
        <div className="flex gap-4 mt-1">
          <div>
            <p className="text-[9px] uppercase opacity-50 font-black">Gemini</p>
            <p className="text-xs font-mono">{keyMeta?.geminiStatus || "Loading..."}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase opacity-50 font-black">OpenAI</p>
            <p className="text-xs font-mono">{keyMeta?.openaiStatus || "Loading..."}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Gemini */}
        <StatusRow label="Gemini API Connection" status={results.gemini?.status} message={results.gemini?.message} icon={<Cpu className="w-4 h-4" />} />
        
        {/* OpenAI */}
        <StatusRow label="OpenAI API Connection" status={results.openai?.status} message={results.openai?.message} icon={<Database className="w-4 h-4" />} />

        <div className="pt-4 border-t border-black/10 dark:border-white/10 space-y-2">
            <p className="text-[10px] opacity-60 italic">Update your personal keys here to override system defaults.</p>
            <input type="password" placeholder="New Gemini API Key" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} className="w-full p-2 rounded bg-black/5 dark:bg-white/5 text-xs"/>
            <input type="password" placeholder="New OpenAI API Key" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} className="w-full p-2 rounded bg-black/5 dark:bg-white/5 text-xs"/>
            <button onClick={updateKeys} className="w-full py-2 bg-emerald-600 text-white rounded flex items-center justify-center gap-2 text-xs font-bold hover:bg-emerald-500">
                <Save className="w-4 h-4"/>
                {updateStatus === 'loading' ? 'Saving...' : 'Save & Update Keys'}
            </button>
            {updateStatus === 'success' && <p className="text-[10px] text-emerald-500 text-center">Keys updated! Try refreshing.</p>}
            {updateStatus === 'error' && <p className="text-[10px] text-red-500 text-center">Failed to update keys</p>}
        </div>
      </div>
    </div>
  );
};

const StatusRow: React.FC<{ label: string, status?: 'loading' | 'success' | 'error', message?: string, icon: React.ReactNode }> = ({ label, status, message, icon }) => (
  <div className="flex items-center gap-3 p-3 rounded-lg bg-black/5 dark:bg-white/5">
    {icon}
    <div className="flex-1">
      <p className="text-xs font-bold">{label}</p>
      {status === 'error' && <p className="text-[10px] text-red-500 break-all">{message}</p>}
      {status === 'success' && <p className="text-[10px] text-emerald-500">Connected</p>}
      {status === 'loading' && <p className="text-[10px] opacity-50">Testing...</p>}
    </div>
    {status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
    {status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
  </div>
);
