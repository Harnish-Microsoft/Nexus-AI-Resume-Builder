import React, { useState, useRef } from 'react';
import { 
  Linkedin, 
  FileText, 
  Upload, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { extractTextFromPDFFile } from '../lib/pdfUtils';
import { EngineType, scanResumeImage } from '../services/geminiService';

interface LinkedInImporterProps {
  linkedInUrl: string;
  setLinkedInUrl: (url: string) => void;
  linkedInFileName: string;
  setLinkedInFileName: (name: string) => void;
  setLinkedInPdfText: (text: string) => void;
  linkedInPdfText: string;
  isDarkMode: boolean;
  onImport: (text: string) => void;
  isExtracting: boolean;
  setIsExtracting: (val: boolean) => void;
}

export const LinkedInImporter: React.FC<LinkedInImporterProps> = ({
  linkedInUrl,
  setLinkedInUrl,
  linkedInFileName,
  setLinkedInFileName,
  setLinkedInPdfText,
  linkedInPdfText,
  isDarkMode,
  onImport,
  isExtracting,
  setIsExtracting
}) => {
  const [importMode, setImportMode] = useState<'url' | 'pdf' | 'text' | 'vision'>('url');
  const [pastedText, setPastedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const visionInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setError(null);
      if (file.type === 'application/pdf') {
        setIsExtracting(true);
        setLinkedInFileName(file.name);
        try {
          const text = await extractTextFromPDFFile(file);
          setLinkedInPdfText(text);
          onImport(text);
        } catch (err) {
          setError('Failed to extract text from PDF.');
        } finally {
          setIsExtracting(false);
        }
      } else {
        setError('Please upload a PDF file.');
      }
    }
  };

  const handleVisionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsExtracting(true);
      setLinkedInFileName(file.name);
      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const base64 = (event.target?.result as string).split(',')[1];
            const parsedData = await scanResumeImage(base64, file.type);
            onImport(JSON.stringify(parsedData));
            setLinkedInPdfText(JSON.stringify(parsedData));
          } catch (err) {
            setError('Vision scan failed. Use text paste.');
          } finally {
            setIsExtracting(false);
          }
        };
        reader.readAsDataURL(file);
      } catch (err) {
        setError('Vision scan failed. Use text paste.');
        setIsExtracting(false);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (importMode === 'vision') {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    setIsExtracting(true);
                    setLinkedInFileName(file.name);
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        try {
                            const base64 = (event.target?.result as string).split(',')[1];
                            const parsedData = await scanResumeImage(base64, file.type);
                            onImport(JSON.stringify(parsedData));
                            setLinkedInPdfText(JSON.stringify(parsedData));
                        } catch (err) {
                            setError('Vision scan failed. Use text paste.');
                        } finally {
                            setIsExtracting(false);
                        }
                    };
                    reader.readAsDataURL(file);
                }
            }
        }
    }
  };

  const handleManualImport = () => {
    if (!pastedText.trim()) {
      setError('Please paste your profile text.');
      return;
    }
    onImport(pastedText);
    setLinkedInPdfText(pastedText);
    setError(null);
  };

  return (
    <div className={`p-6 rounded-2xl border transition-all ${
      isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-black/5 shadow-sm'
    }`}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <Linkedin className="w-5 h-5 text-blue-500" />
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest">LinkedIn Profile Importer</h3>
          <p className="text-[10px] opacity-50 mt-1">Extract professional details from your LinkedIn profile</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 p-1 bg-black/5 dark:bg-white/5 rounded-xl">
        {(['url', 'pdf', 'text', 'vision'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setImportMode(mode)}
            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
              importMode === mode 
                ? (isDarkMode ? 'bg-white/10 text-white shadow-lg' : 'bg-white text-black shadow-sm')
                : 'text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white'
            }`}
          >
            {mode === 'url' ? 'URL' : mode === 'pdf' ? 'PDF' : mode === 'text' ? 'Paste' : 'Vision Scan'}
          </button>
        ))}
      </div>

      <div className="min-h-[140px]">
        {importMode === 'url' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="relative group">
              <input 
                type="url"
                placeholder="https://linkedin.com/in/yourprofile"
                className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                  isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
                }`}
                value={linkedInUrl}
                onChange={(e) => setLinkedInUrl(e.target.value)}
              />
              <Linkedin className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20 group-focus-within:opacity-100 transition-opacity" />
            </div>
            <p className="text-[10px] opacity-50 italic">
              * Note: Direct URL scraping may be restricted. If data isn't found, try the PDF Export option.
            </p>
          </motion.div>
        )}

        {importMode === 'pdf' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div 
              onClick={() => pdfInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                isDarkMode ? 'bg-white/5 border-white/10 hover:border-blue-500/50' : 'bg-[#F9F9F9] border-black/10 hover:border-blue-500/50'
              }`}
            >
              <input 
                type="file"
                ref={pdfInputRef}
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              {isExtracting ? (
                <div className="flex flex-col items-center gap-2">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                  <span className="text-xs font-medium">Extracting professional data...</span>
                </div>
              ) : linkedInFileName ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-emerald-500/10 rounded-full">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <span className="text-xs font-bold">{linkedInFileName}</span>
                  <button className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-2 hover:underline">Change File</button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 opacity-30" />
                  <div className="text-center">
                    <p className="text-xs font-bold uppercase tracking-wider mb-1">Click to Upload PDF</p>
                    <p className="text-[10px] opacity-50">Saved from LinkedIn: "More" {`>`} "Save to PDF"</p>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}

        {importMode === 'text' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <textarea 
              placeholder="Select all (Ctrl+A) on your profile, Copy and Paste here..."
              className={`w-full h-32 px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none ${
                isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
              }`}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
            />
            <button
              onClick={handleManualImport}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20"
            >
              Sync Profile Data
            </button>
          </motion.div>
        )}

        {importMode === 'vision' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div 
              onClick={() => visionInputRef.current?.click()}
              onPaste={handlePaste}
              tabIndex={0}
              className={`relative border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                isDarkMode ? 'bg-white/5 border-white/10 hover:border-blue-500/50' : 'bg-[#F9F9F9] border-black/10 hover:border-blue-500/50'
              }`}
            >
              <input 
                type="file"
                ref={visionInputRef}
                accept="image/*"
                onChange={handleVisionUpload}
                className="hidden"
              />
              {isExtracting ? (
                <div className="flex flex-col items-center gap-2">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                  <span className="text-xs font-medium">Scanning with Gemini Vision...</span>
                </div>
              ) : (
                <>
                  <Eye className="w-8 h-8 opacity-30" />
                  <div className="text-center">
                    <p className="text-xs font-bold uppercase tracking-wider mb-1">Omni Vision Scan</p>
                    <p className="text-[10px] opacity-50">Upload a screenshot or photo of your resume</p>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {linkedInPdfText && (
        <div className="mt-6 flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Profile Loaded & Ready</span>
          </div>
          <button 
            onClick={() => { setLinkedInPdfText(''); setLinkedInFileName(''); setLinkedInUrl(''); setPastedText(''); }}
            className="text-[9px] font-bold text-red-400 uppercase tracking-widest hover:text-red-300"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};
