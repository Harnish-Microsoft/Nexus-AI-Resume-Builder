import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import { DashboardShell } from './components/Dashboard/DashboardShell';
import { DashboardHeader } from './components/Dashboard/DashboardHeader';
import { NavigationRail } from './components/Dashboard/NavigationRail';
import { StatusFooter } from './components/Dashboard/StatusFooter';
import { ResumeIntelligencePanel } from './components/Dashboard/ResumeIntelligencePanel';
import { OptimizationPipelinePanel } from './components/Dashboard/OptimizationPipelinePanel';
import { MasterResumeIntelligencePanel } from './components/Dashboard/MasterResumeIntelligencePanel';
import { OptimizationResultsPanel } from './components/Dashboard/OptimizationResultsPanel';
import { AIInsightsPanel } from './components/Dashboard/AIInsightsPanel';
import { ActivityFeed } from './components/Dashboard/ActivityFeed';
import { RecommendationFeed } from './components/Dashboard/RecommendationFeed';
import { DashboardHome } from './components/Dashboard/DashboardHome';
import { 
  FileText, 
  Briefcase, 
  Target, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ChevronRight, 
  ChevronDown,
  ChevronLeft,
  Download, 
  Copy,
  Search,
  Layout,
  LayoutGrid,
  Cpu,
  BarChart3,
  Loader2,
  Info,
  Moon,
  Sun,
  Trash2,
  Square,
  Upload,
  Users,
  UserCircle,
  Eye,
  EyeOff,
  FileDown,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Building,
  HelpCircle,
  Maximize,
  HardDrive,
  Cloud,
  RefreshCw,
  ExternalLink,
  Edit2,
  Check,
  X,
  ImagePlus,
  ShieldCheck,
  ShieldAlert,
  Linkedin,
  Sparkles,
  Pin,
  PinOff,
  Menu,
  Palette
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableSection } from './components/SortableSection';
import { StatusIndicator } from './components/StatusIndicator';
import { Toast, ConfirmDialog } from './components/UI.tsx';
import { MODE_DESCRIPTIONS, AUDIENCES, MODEL_PRICING, TARGET_COMPANIES, BACKGROUND_THEMES } from './constants';
import { downloadDOCX, downloadJSON } from './services/exportService';
import { useResumeStore } from './store';
import { ResumeData, SuitabilityResult, Certification, MasterResume } from './types';
import { detectOverflow } from './overflowDetection';
import { useFormatting, DEFAULT_STYLE } from './context/FormattingContext';
import { optimizeResume, fetchJobDescription, analyzeBestAudiences, evaluateSuitability, OptimizationResult, EngineType, EngineConfig, autoSelectPlayerCoachRole, selectBestMasterResume, startDeepResearch, getDeepResearchStatus } from './services/geminiService';
import Markdown from 'react-markdown';
import { RouterConfig } from './services/aiRouter';
import { AtsOptimizationStudio } from './components/AtsOptimizationStudio';
import { OptimizationResultWorkspace } from './components/OptimizationResultWorkspace';
import { AIOptimizationOverlay } from './components/AIOptimizationOverlay';
import { extractTextFromPDFFile } from './lib/pdfUtils';
import { saveAs } from 'file-saver';
const LinkedInImporter = lazy(() => import('./components/LinkedInImporter').then(m => ({ default: m.LinkedInImporter })));
const ResumeJsonViewer = lazy(() => import('./components/ResumeJsonViewer').then(m => ({ default: m.ResumeJsonViewer })));
const CareerQuiz = lazy(() => import('./components/CareerQuiz').then(m => ({ default: m.CareerQuiz })));
const JobTracker = lazy(() => import('./components/JobTracker').then(m => ({ default: m.JobTracker })));
const SkillExtractor = lazy(() => import('./components/SkillExtractor').then(m => ({ default: m.SkillExtractor })));
const ComparisonModal = lazy(() => import('./components/ComparisonModal').then(m => ({ default: m.ComparisonModal })));
const CareerQuizHelp = lazy(() => import('./components/CareerQuiz').then(m => ({ default: m.CareerQuiz }))); // Reusing for consistency if needed
const NexusProInsights = lazy(() => import('./components/NexusProInsights').then(m => ({ default: m.NexusProInsights })));

import { auth, db, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  browserPopupRedirectResolver
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, addDoc, getDocs, query, orderBy, increment, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError } from './lib/firebaseUtils';
import { OperationType } from './types';
import { DriveFolderPicker } from './components/DriveFolderPicker';
import CloudArchitectureLoader from './components/CloudArchitectureLoader';
import PremiumEnterpriseLoader from './components/PremiumEnterpriseLoader';
import { AuthModal } from './components/AuthModal';
import { TermsModal } from './components/TermsModal';
import { AINeuralNetworkBackground } from './components/AINeuralNetworkBackground';

import defaultMasterResume from './services/master_resume.json';

// Lazy load heavy components for better initial performance
const CareerTools = lazy(() => import('./components/CareerTools').then(m => ({ default: m.CareerTools })));
const AdditionalTools = lazy(() => import('./components/AdditionalTools').then(m => ({ default: m.AdditionalTools })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const ProfessionalWelcomePage = lazy(() => import('./components/ProfessionalWelcomePage').then(m => ({ default: m.ProfessionalWelcomePage })));

const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center p-12">
    <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
    <span className="text-xs font-bold uppercase tracking-widest opacity-30">Loading Module...</span>
  </div>
);

type OptimizationMode = 'conservative' | 'balanced' | 'aggressive' | 'automatic' | 'Player-Coach';

import { CommandPalette } from './components/CommandPalette';

const GeminiAurora = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden z-[-2]">
    <motion.div
      animate={{
        scale: [1, 1.2, 1],
        x: [0, 50, 0],
        y: [0, -30, 0],
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] bg-cyan-500/20 mix-blend-screen opacity-40"
    />
    <motion.div
      animate={{
        scale: [1.2, 1, 1.2],
        x: [0, -40, 0],
        y: [0, 40, 0],
      }}
      transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] rounded-full blur-[140px] bg-indigo-600/20 mix-blend-screen opacity-30"
    />
    <motion.div
      animate={{
        opacity: [0.1, 0.3, 0.1],
        scale: [1, 1.1, 1],
      }}
      transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      className="absolute top-1/4 left-1/3 w-[50%] h-[50%] rounded-full blur-[100px] bg-purple-500/10 mix-blend-screen"
    />
    <motion.div
      animate={{
        opacity: [0.05, 0.15, 0.05],
        scale: [0.8, 1.2, 0.8],
      }}
      transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] rounded-full blur-[120px] bg-cyan-400/20 mix-blend-overlay"
    />
  </div>
);

const GeminiOmniAurora = () => (
  <div className="omni-aurora">
    <div className="omni-aurora-blob w-[80%] h-[80%] -top-[10%] -left-[10%]" style={{ background: '#4285f4', opacity: 0.15 }} />
    <div className="omni-aurora-blob w-[70%] h-[70%] top-[20%] right-[-10%]" style={{ background: '#a142f4', opacity: 0.12 }} />
    <div className="omni-aurora-blob w-[90%] h-[90%] -bottom-[20%] left-[10%]" style={{ background: '#ea4335', opacity: 0.1 }} />
    <div className="omni-aurora-blob w-[60%] h-[60%] bottom-[10%] right-[30%]" style={{ background: '#fbbc04', opacity: 0.08 }} />
    <div className="omni-aurora-blob w-[50%] h-[50%] top-[40%] left-[40%]" style={{ background: '#34a853', opacity: 0.07 }} />
  </div>
);

const DataStream = () => (
  <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-[-5] overflow-hidden">
    {Array.from({ length: 15 }).map((_, i) => (
      <motion.div
        key={i}
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: '100vh', opacity: [0, 1, 0] }}
        transition={{ 
          duration: 10 + Math.random() * 20, 
          repeat: Infinity, 
          delay: Math.random() * 20,
          ease: "linear" 
        }}
        className="absolute text-[8px] font-mono whitespace-nowrap text-cyan-500"
        style={{ left: `${i * 7}%` }}
      >
        {Array.from({ length: 50 }).map(() => Math.round(Math.random())).join('')}
      </motion.div>
    ))}
  </div>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthProcessing, setIsAuthProcessing] = useState(false);
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isApiKeySaved, setIsApiKeySaved] = useState(false);
  const [encryptedApiKey, setEncryptedApiKey] = useState('');
  const [isTestingDrive, setIsTestingDrive] = useState(false);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [isFetchingDriveFiles, setIsFetchingDriveFiles] = useState(false);
  const [renamingDriveFileId, setRenamingDriveFileId] = useState<string | null>(null);
  const [newDriveFileName, setNewDriveFileName] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isDriveConnected, setIsDriveConnected] = useState(() => {
    return localStorage.getItem('isDriveConnected') === 'true';
  });
  const [selectedDriveFolder, setSelectedDriveFolder] = useState<{id: string, name: string} | null>(() => {
    const saved = localStorage.getItem('selectedDriveFolder');
    return saved ? JSON.parse(saved) : null;
  });
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);
  const [firestoreReadCount, setFirestoreReadCount] = useState<number>(() => {
    const saved = localStorage.getItem('firestoreReadCount');
    return saved ? JSON.parse(saved) : 0;
  });

  const safeGetDoc = async (docRef: any) => {
    setFirestoreReadCount(prev => {
      const next = prev + 1;
      localStorage.setItem('firestoreReadCount', JSON.stringify(next));
      return next;
    });
    return await getDoc(docRef);
  };
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(() => {
    return localStorage.getItem('driveAccessToken');
  });
  const [versioningEnabled, setVersioningEnabled] = useState(() => {
    return localStorage.getItem('versioningEnabled') === 'true';
  });
  const [isAutosaveEnabled, setIsAutosaveEnabled] = useState(() => {
    return localStorage.getItem('isAutosaveEnabled') === 'true';
  });
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [showJsonViewer, setShowJsonViewer] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };

    const handleToggleJson = () => setShowJsonViewer(prev => !prev);
    const handleToggleAdmin = () => setShowAdminDashboard(prev => !prev);

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('toggle-json-viewer', handleToggleJson);
    document.addEventListener('toggle-admin-dashboard', handleToggleAdmin);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('toggle-json-viewer', handleToggleJson);
      document.removeEventListener('toggle-admin-dashboard', handleToggleAdmin);
    };
  }, []);

  const [isFetchingKeys, setIsFetchingKeys] = useState(false);

  const fetchKeysFromFirebase = async (isManual = false) => {
    // We use auth.currentUser (or the 'user' state)
    const currentUser = auth.currentUser || user;
    if (!currentUser && isManual) {
      showToast("Please login first to fetch keys from your profile.", "error");
      return;
    }
    
    setIsFetchingKeys(true);
    try {
      console.log("[App] Fetching keys from Firebase...");
      let finalEncryptedKey = '';
      let keyFound = false;

      if (currentUser) {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().encryptedApiKey) {
          finalEncryptedKey = docSnap.data().encryptedApiKey;
          keyFound = true;
        }
      }

      if (!keyFound) {
        // Fallback to admin key
        console.log("[App] Checking admin fallback...");
        const adminDoc = await getDoc(doc(db, 'users', 'admin')).catch(() => null);
        if (adminDoc && adminDoc.exists() && adminDoc.data().encryptedApiKey) {
          finalEncryptedKey = adminDoc.data().encryptedApiKey;
          keyFound = true;
        }
      }

      if (keyFound && finalEncryptedKey) {
        setEncryptedApiKey(finalEncryptedKey);
        setIsApiKeySaved(true);
        
        // Decrypt for UI
        try {
          const idToken = currentUser ? await currentUser.getIdToken() : "";
          const decryptResponse = await fetch('/api/decrypt-keys', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': idToken ? `Bearer ${idToken}` : ""
            },
            body: JSON.stringify({ encryptedKey: finalEncryptedKey })
          });
          
          if (decryptResponse.ok) {
            const decryptData = await decryptResponse.json();
            if (decryptData.keys) {
              setGeminiApiKey(decryptData.keys.gemini || '');
              setOpenaiApiKey(decryptData.keys.openai || '');
              if (isManual) showToast("Successfully get api and inserted in system", "success");
            }
          } else {
            const errData = await decryptResponse.json();
            if (errData.details && errData.details.includes('DECRYPTION_FAILED')) {
              showToast("Encryption key mismatch. Please re-save your API keys in Profile settings.", "error");
            } else if (isManual) {
              showToast("Fetched encrypted key, but decryption failed.", "error");
            }
          }
        } catch (decryptErr) {
          console.error("Failed to decrypt keys on fetch:", decryptErr);
          if (isManual) showToast("Failed to decrypt keys.", "error");
        }
      } else {
        if (isManual) showToast("No API keys found in your profile or system fallback.", "error");
      }
    } catch (err) {
      console.error("Error fetching keys:", err);
      if (isManual) showToast("Error fetching keys from Firebase.", "error");
    } finally {
      setIsFetchingKeys(false);
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // Add resumeSource state: 'local' (default) or 'firestore'
  const [resumeSource, setResumeSource] = useState<'local' | 'firestore'>('local');
  const isInitialLoad = useRef(true);
  const isSuitabilityCancelledRef = useRef<boolean>(false);

  // Load master resume when preference changes
  useEffect(() => {
    if (resumeSource === 'firestore' && user) {
       const loadFromFirestore = async () => {
         const docRef = doc(db, 'users', user.uid);
         const docSnap = await getDoc(docRef);
         if (docSnap.exists() && docSnap.data().masterResume) {
            setResumeText(docSnap.data().masterResume);
         }
       };
       loadFromFirestore();
    } else if (resumeSource === 'local') {
        setResumeText(JSON.stringify(defaultMasterResume, null, 2));
    }
  }, [resumeSource, user]);

  const [masterResumes, setMasterResumes] = useState<MasterResume[]>(() => {
    const saved = localStorage.getItem('masterResumes');
    return saved ? JSON.parse(saved) : [{ 
      id: 'default', 
      name: 'Default Resume', 
      description: 'Main master resume', 
      data: defaultMasterResume, 
      createdAt: Date.now(),
      isActive: true
    }];
  });                
  const [selectedResumeId, setSelectedResumeId] = useState<string>(() => {
      const saved = localStorage.getItem('selectedResumeId');
      return saved || 'default';
  });

  const handleSetActiveResume = (id: string) => {
    setMasterResumes(prev => prev.map(r => ({ ...r, isActive: r.id === id })));
    setSelectedResumeId(id);
    const selected = masterResumes.find(r => r.id === id) || masterResumes[0];
    localStorage.setItem('selectedResumeId', id);
    setResumeText(JSON.stringify(selected.data, null, 2));
  };

  const handleDuplicateResume = (id: string) => {
    if (masterResumes.length >= 5) return;
    const resumeToDuplicate = masterResumes.find(r => r.id === id);
    if (!resumeToDuplicate) return;
    const newResume: MasterResume = {
      ...resumeToDuplicate,
      id: Date.now().toString(),
      name: `${resumeToDuplicate.name} (Copy)`,
      createdAt: Date.now(),
      isActive: false
    };
    setMasterResumes([...masterResumes, newResume]);
  };

  const [resumeText, setResumeText] = useState(() => {
    const selected = masterResumes.find(r => r.id === selectedResumeId) || masterResumes[0];
    return (selected && selected.data) ? JSON.stringify(selected.data, null, 2) : "{}";
  });

  useEffect(() => {
    if (isInitialLoad.current) return;
    if (user) setHasUnsavedChanges(true);
  }, [resumeText, customPrompt, isDriveConnected, versioningEnabled, isAutosaveEnabled, selectedDriveFolder, driveAccessToken, user]);
  const [jobDescription, setJobDescription] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const activeTabOrigin = location.pathname.substring(1).split('/')[0] || 'dashboard';
  const activeTab = activeTabOrigin as 'dashboard' | 'build' | 'profile' | 'tools';
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [targetRole, setTargetRole] = useState('');
  const [targetCompany, setTargetCompany] = useState('none');
  const [brainDump, setBrainDump] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [showResultWorkspace, setShowResultWorkspace] = useState(false);
  const [currentResultWorkspaceArtifact, setCurrentResultWorkspaceArtifact] = useState<any | null>(null);
  const [mode, setMode] = useState<OptimizationMode>('balanced');
  const [fastMode, setFastMode] = useState(false);
  const [recruiterSimulationMode, setRecruiterSimulationMode] = useState(false);
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>(['microsoft']);
  const [customAudience, setCustomAudience] = useState('');
  const [isAudienceDropdownOpen, setIsAudienceDropdownOpen] = useState(false);
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const companyDropdownRef = useRef<HTMLDivElement>(null);
  const audienceDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jdTextareaRef = useRef<HTMLTextAreaElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up URL parameters if they exist (like ?origin=...)
  useEffect(() => {
    if (window.location.search) {
      const url = new URL(window.location.href);
      url.search = '';
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('versioningEnabled', versioningEnabled.toString());
    localStorage.setItem('isAutosaveEnabled', isAutosaveEnabled.toString());
    localStorage.setItem('selectedDriveFolder', selectedDriveFolder ? JSON.stringify(selectedDriveFolder) : '');
    localStorage.setItem('driveAccessToken', driveAccessToken || '');
    localStorage.setItem('masterResumes', JSON.stringify(masterResumes));
  }, [versioningEnabled, isAutosaveEnabled, selectedDriveFolder, driveAccessToken, masterResumes]);

  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string, onConfirm: () => void, onCancel: () => void } | null>(null);

  useEffect(() => {
    if (encryptedApiKey) {
      setEngineConfig(prev => ({
        ...prev,
        gemini: { ...prev.gemini, apiKey: encryptedApiKey },
        openai: { ...prev.openai, apiKey: encryptedApiKey },
      }));
    }
  }, [encryptedApiKey]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef).catch(err => {
            handleFirestoreError(err, OperationType.GET, 'users/' + currentUser.uid);
            return undefined;
          });
          
          let hasUserKey = false;
          if (docSnap && docSnap.exists()) {
            const data = docSnap.data();
            setShowTermsModal(false);
            if (data.masterResumes) {
              setMasterResumes(data.masterResumes);
            } else if (data.masterResume) {
              // Backward compatibility
                setResumeText(data.masterResume);
            }
            if (data.customPrompt) {
              setCustomPrompt(data.customPrompt);
            }
            if (data.settings) {
              if (typeof data.settings.versioningEnabled === 'boolean') {
                setVersioningEnabled(data.settings.versioningEnabled);
              }
              if (typeof data.settings.isAutosaveEnabled === 'boolean') {
                setIsAutosaveEnabled(data.settings.isAutosaveEnabled);
              }
              if (typeof data.settings.isDriveConnected === 'boolean') {
                setIsDriveConnected(data.settings.isDriveConnected);
              }
              if (data.settings.selectedDriveFolder) {
                setSelectedDriveFolder(data.settings.selectedDriveFolder);
              }
            }

            if (data.encryptedApiKey) {
              hasUserKey = true;
              setEncryptedApiKey(data.encryptedApiKey);
              setIsApiKeySaved(true);
              
              // Decrypt keys for the UI if possible
              try {
                const decryptResponse = await fetch('/api/decrypt-keys', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ encryptedKey: data.encryptedApiKey })
                });
                if (decryptResponse.ok) {
                  const decryptData = await decryptResponse.json();
                  if (decryptData.keys) {
                    if (decryptData.keys.gemini) setGeminiApiKey(decryptData.keys.gemini);
                    if (decryptData.keys.openai) setOpenaiApiKey(decryptData.keys.openai);
                  }
                }
              } catch (decryptErr) {
                console.error("Failed to decrypt keys on load:", decryptErr);
              }
            }
            if (data.driveAccessToken) {
              setDriveAccessToken(data.driveAccessToken);
              setIsDriveConnected(true);
            }
          }
          
              // Fallback to admin key if user has no key
              if (!hasUserKey) {
                console.log("[App] User has no key, checking admin fallback...");
                fetchKeysFromFirebase(false);
              }
            } catch (err) {
              console.error("Error fetching profile:", err);
            }
          } else {
            // Not signed in: Check for admin fallback automatically
            console.log("[App] Not signed in, checking admin fallback key...");
            fetchKeysFromFirebase(false);
            setDriveAccessToken(null);
            setIsDriveConnected(false);
            setShowTermsModal(false);
          }
      setIsAuthReady(true);
      // Allow state to settle before tracking changes
      setTimeout(() => {
        isInitialLoad.current = false;
        setHasUnsavedChanges(false);
      }, 500);
    });
    return () => unsubscribe();
  }, []);

  const handleTestDrive = async () => {
    setIsTestingDrive(true);
    try {
      const url = driveAccessToken 
        ? `/api/test-drive?accessToken=${driveAccessToken}` 
        : '/api/test-drive';
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        showToast(data.message, 'success');
        fetchDriveFiles();
      } else {
        if (data.error && data.error.includes('AUTH_EXPIRED')) {
          setDriveAccessToken(null);
        }
        showToast(data.error || 'Connection failed', 'error');
      }
    } catch (err) {
      showToast('Failed to reach server', 'error');
    } finally {
      setIsTestingDrive(false);
    }
  };

  const fetchDriveFiles = async () => {
    if (!driveAccessToken) {
      console.warn("Attempted to fetch drive files without access token.");
      showToast("Please connect your Google Drive account first.", "info");
      return;
    }
    setIsFetchingDriveFiles(true);
    try {
      const url = `/api/list-drive-files?accessToken=${driveAccessToken}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Drive list error: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setDriveFiles(data.files);
      } else if (data.error && data.error.includes('AUTH_EXPIRED')) {
        setDriveAccessToken(null);
      }
    } catch (err: any) {
      console.error('Failed to fetch Drive files:', err);
      if (err.message.includes('401') || err.message.includes('403')) {
        setDriveAccessToken(null);
      }
    } finally {
      setIsFetchingDriveFiles(false);
    }
  };

  const handleRenameDriveFile = async (fileId: string) => {
    if (!newDriveFileName.trim()) return;
    try {
      const response = await fetch('/api/rename-drive-file', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fileId, 
          newName: newDriveFileName,
          accessToken: driveAccessToken 
        })
      });
      const data = await response.json();
      if (data.success) {
        showToast('File renamed successfully', 'success');
        setRenamingDriveFileId(null);
        setNewDriveFileName('');
        fetchDriveFiles();
      } else {
        if (data.error && data.error.includes('AUTH_EXPIRED')) {
          setDriveAccessToken(null);
        }
        showToast(data.error || 'Failed to rename file', 'error');
      }
    } catch (err) {
      showToast('Failed to rename file', 'error');
    }
  };

  const handleDeleteDriveFile = async (fileId: string) => {
    setConfirmDialog({
      message: "Are you sure you want to delete this file from Google Drive? This action cannot be undone.",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const response = await fetch('/api/delete-drive-file', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              fileId,
              accessToken: driveAccessToken 
            })
          });
          const data = await response.json();
          if (data.success) {
            showToast('File deleted successfully', 'success');
            fetchDriveFiles();
          } else {
            if (data.error && data.error.includes('AUTH_EXPIRED')) {
              setDriveAccessToken(null);
            }
            showToast(data.error || 'Failed to delete file', 'error');
          }
        } catch (err) {
          showToast('Failed to delete file', 'error');
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  useEffect(() => {
    if (driveAccessToken || process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      fetchDriveFiles();
    }
  }, [driveAccessToken]);

  const handleGoogleLogin = async () => {
    if (isAuthProcessing) return;
    setIsAuthProcessing(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive');
      console.log("[Nexus AI] Initiating Google Popup...");
      const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      console.log("[Nexus AI] Google Result Success");
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken && auth.currentUser) {
        setDriveAccessToken(credential.accessToken);
        await setDoc(doc(db, 'users', auth.currentUser.uid), {
          driveAccessToken: credential.accessToken,
          settings: { isDriveConnected: true }
        }, { merge: true });
        showToast('Connected to Google successfully!', 'success');
      }
    } catch (err: any) {
      console.error('Google login error:', err);
      let msg = 'Google login failed. Please try again.';
      if (err.code === 'auth/popup-closed-by-user') {
        msg = 'Login cancelled: Popup was closed before completion.';
      } else if (err.code === 'auth/cancelled-popup-request') {
        msg = 'Another login attempt is already in progress.';
      } else if (err.code === 'auth/unauthorized-domain') {
        msg = 'Domain not authorized. Please add this domain to your Firebase Authorized Domains list.';
      } else if (err.message) {
        msg = `Google error: ${err.message}`;
      }
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsAuthProcessing(false);
    }
  };

  const handleConnectDrive = async () => {
    if (isAuthProcessing) return;
    setIsAuthProcessing(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive');
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setDriveAccessToken(credential.accessToken);
        setIsDriveConnected(true);
        localStorage.setItem('isDriveConnected', 'true');
        // Save token to Firestore for cross-device autoconnect
        if (user) {
          await setDoc(doc(db, 'users', user.uid), {
            userId: user.uid,
            driveAccessToken: credential.accessToken,
            settings: { isDriveConnected: true }
          }, { merge: true });
        }
        showToast('Google Drive connected successfully!', 'success');
      }
    } catch (error: any) {
      console.error('Drive connection error:', error);
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        showToast('Connection cancelled.', 'error');
      } else if (error.code === 'auth/unauthorized-domain') {
        showToast('This domain is not authorized for Google Drive access.', 'error');
      } else {
        showToast(`Failed to connect Drive: ${error.message || 'Unknown error'}`, 'error');
      }
    } finally {
      setIsAuthProcessing(false);
    }
  };

  const handleLogin = async () => {
    setIsAuthModalOpen(true);
  };

  const handleEmailLogin = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      console.error("Email Login Error:", err);
      let msg = "Failed to login.";
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = "Invalid email or password.";
      }
      throw new Error(msg);
    }
  };

  const handleEmailSignUp = async (email: string, pass: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
      showToast("Account created successfully!", "success");
    } catch (err: any) {
      console.error("Sign Up Error:", err);
      let msg = "Failed to create account.";
      if (err.code === 'auth/email-already-in-use') {
        msg = "Email already in use.";
      } else if (err.code === 'auth/weak-password') {
        msg = "Password is too weak.";
      }
      throw new Error(msg);
    }
  };

  const handlePasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      showToast("Password reset email sent!", "info");
    } catch (err: any) {
      console.error("Reset Password Error:", err);
      throw new Error("Failed to send reset email.");
    }
  };

  // Sync all user data to Firestore
  const syncAllData = async (silent = false) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const docRef = doc(db, 'users', user.uid);
      const dataToSync: any = {
        userId: user.uid,
        masterResumes: masterResumes, // Sync array of resumes
        customPrompt: customPrompt || "",
        settings: {
          versioningEnabled,
          isAutosaveEnabled,
          isDriveConnected: !!driveAccessToken || isDriveConnected
        },
        updatedAt: serverTimestamp()
      };
      
      if (typeof selectedDriveFolder !== 'undefined' && selectedDriveFolder !== null) {
        dataToSync.settings.selectedDriveFolder = selectedDriveFolder;
      }
      if (driveAccessToken) {
        dataToSync.driveAccessToken = driveAccessToken;
      }
      
      // Use setDoc for standard sync
      await setDoc(docRef, dataToSync, { merge: true });
      setHasUnsavedChanges(false);
      if (!silent) showToast('All data synced successfully', 'success');
    } catch (err) {
      console.error("Sync Error:", err);
      if (!silent) showToast('Failed to sync data', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Debounced auto-sync
  useEffect(() => {
    if (!user || !hasUnsavedChanges) return;

    const timeoutId = setTimeout(() => {
      syncAllData(true);
    }, 2000); // Sync 2 seconds after last change

    return () => clearTimeout(timeoutId);
  }, [hasUnsavedChanges, user, resumeText, customPrompt, isDriveConnected, versioningEnabled, isAutosaveEnabled, selectedDriveFolder, driveAccessToken]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user) {
        signOut(auth);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user]);

  const handleLogout = async () => {
    try {
      await syncAllData();
      clearInputs();
      await signOut(auth);
    } catch (err) {
      console.error("Logout Error:", err);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) {
      showToast("Please login first.", "error");
      return;
    }
    if (!resumeText) {
      showToast("Please provide your master resume.", "error");
      return;
    }

    setIsSavingProfile(true);
    try {
      let finalEncryptedKey = encryptedApiKey;

      // If the user entered a new API key (not the placeholder)
      if ((openaiApiKey && openaiApiKey !== '') || (geminiApiKey && geminiApiKey !== '')) {
        const keysToEncrypt = JSON.stringify({
          gemini: geminiApiKey !== '' ? geminiApiKey : '',
          openai: openaiApiKey !== '' ? openaiApiKey : ''
        });

        const response = await fetch('/api/encrypt-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            apiKey: keysToEncrypt,
            existingEncryptedKey: encryptedApiKey
          })
        });
        if (!response.ok) throw new Error("Failed to encrypt API keys");
        const data = await response.json();
        finalEncryptedKey = data.encryptedKey;
        setEncryptedApiKey(finalEncryptedKey);
        if (openaiApiKey) setOpenaiApiKey('');
        if (geminiApiKey) setGeminiApiKey('');
        setIsApiKeySaved(true);
      }

      await setDoc(doc(db, 'users', user.uid), {
        userId: user.uid,
        encryptedApiKey: finalEncryptedKey,
        masterResumes: masterResumes,
        customPrompt: customPrompt,
        settings: {
          versioningEnabled,
          isAutosaveEnabled,
          isDriveConnected: !!driveAccessToken || isDriveConnected
        },
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'users/' + user.uid));

      showToast("Successfully get api and inserted in system", "success");
    } catch (err) {
      console.error("Error saving profile:", err);
      showToast("Failed to save profile.", "error");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleResetKeys = async () => {
    if (!user) return;
    
    setConfirmDialog({
      message: "Are you sure you want to clear your saved API keys? You will need to re-enter them.",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await setDoc(doc(db, 'users', user.uid), {
            userId: user.uid,
            encryptedApiKey: "",
            updatedAt: serverTimestamp()
          }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'users/' + user.uid));
          setOpenaiApiKey('');
          setGeminiApiKey('');
          setEncryptedApiKey('');
          setIsApiKeySaved(false);
          showToast("API keys cleared successfully.", "success");
        } catch (err) {
          console.error("Error resetting keys:", err);
          showToast("Failed to reset keys.", "error");
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (audienceDropdownRef.current && !audienceDropdownRef.current.contains(event.target as Node)) {
        setIsAudienceDropdownOpen(false);
      }
    };

    if (isAudienceDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAudienceDropdownOpen]);
  const { state: formattingState, dispatch: formattingDispatch } = useFormatting();
  const { activeSection, styles: sectionStyles } = formattingState;
  const { 
    data,
    isOptimizing, 
    setIsOptimizing, 
    setData, 
    pages,
    results,
    setResults,
    activeAudience,
    setActiveAudience,
    currentOptimizingEngine,
    setCurrentOptimizingEngine
  } = useResumeStore();

  const [linkedInUrl, setLinkedInUrl] = useState(() => localStorage.getItem('linkedInUrl') || '');
  const [linkedInPdfText, setLinkedInPdfText] = useState(() => localStorage.getItem('linkedInPdfText') || '');
  const [linkedInFileName, setLinkedInFileName] = useState(() => localStorage.getItem('linkedInFileName') || '');
  const [jobUrl, setJobUrl] = useState('');
  const [usePremiumLoader, setUsePremiumLoader] = useState(true);
  const [isExtractingLinkedIn, setIsExtractingLinkedIn] = useState(false);
  const [isCareerToolActive, setIsCareerToolActive] = useState(false);
  const [isAdditionalToolActive, setIsAdditionalToolActive] = useState(false);
  const [isFetchingJob, setIsFetchingJob] = useState(false);
  const [suitabilityResult, setSuitabilityResult] = useState<SuitabilityResult | null>(null);
  const [multiSuitabilityResults, setMultiSuitabilityResults] = useState<Record<string, SuitabilityResult>>({});
  const [isCheckingSuitability, setIsCheckingSuitability] = useState(false);

  // Profile Overrides
  const [profileName, setProfileName] = useState(() => localStorage.getItem('profileName') || '');
  const [profileLocation, setProfileLocation] = useState(() => localStorage.getItem('profileLocation') || 'Hyderabad, Telangana, India');
  const [profileEmail, setProfileEmail] = useState(() => localStorage.getItem('profileEmail') || '');
  const [profilePhone, setProfilePhone] = useState(() => localStorage.getItem('profilePhone') || '');
  const [profileLinkedIn, setProfileLinkedIn] = useState(() => localStorage.getItem('profileLinkedIn') || '');
  const [profileLinkedInText, setProfileLinkedInText] = useState(() => localStorage.getItem('profileLinkedInText') || '');
  
  const [isResumePersistent, setIsResumePersistent] = useState(() => localStorage.getItem('isResumePersistent') !== 'false');

  useEffect(() => {
    localStorage.setItem('profileName', profileName || '');
    localStorage.setItem('profileLocation', profileLocation || '');
    localStorage.setItem('profileEmail', profileEmail || '');
    localStorage.setItem('profilePhone', profilePhone || '');
    localStorage.setItem('profileLinkedIn', profileLinkedIn || '');
    localStorage.setItem('profileLinkedInText', profileLinkedInText || '');
    
    // Save resume text depending on persistence setting
    if (isResumePersistent) {
      if (resumeText) {
        localStorage.setItem('resumeText', resumeText);
      } else {
        localStorage.removeItem('resumeText');
      }
      sessionStorage.removeItem('resumeText');
    } else {
      localStorage.removeItem('resumeText');
      if (resumeText) {
        sessionStorage.setItem('resumeText', resumeText);
      } else {
        sessionStorage.removeItem('resumeText');
      }
    }
    localStorage.setItem('isResumePersistent', isResumePersistent ? 'true' : 'false');
    
    localStorage.setItem('linkedInUrl', linkedInUrl || '');
    localStorage.setItem('linkedInPdfText', linkedInPdfText || '');
    localStorage.setItem('linkedInFileName', linkedInFileName || '');
  }, [
    profileName, 
    profileLocation, 
    profileEmail, 
    profilePhone, 
    profileLinkedIn, 
    profileLinkedInText, 
    resumeText, 
    isResumePersistent,
    linkedInUrl, 
    linkedInPdfText, 
    linkedInFileName
  ]);

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [resumeVersions, setResumeVersions] = useState<any[]>([]);

  useEffect(() => {
    /*
    if (user) {
      const loadVersions = async () => {
        const q = query(collection(db, 'users', user.uid, 'resumeVersions'), orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q).catch(err => {
          handleFirestoreError(err, OperationType.LIST, 'users/' + user.uid + '/resumeVersions');
          return undefined;
        });
        if (querySnapshot) {
          const versions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setResumeVersions(versions);
        }
      };
      loadVersions();
    } else {
      setResumeVersions([]);
    }
    */
  }, [user]);

  // Auto-fetch Job Description when a URL is pasted
  useEffect(() => {
    const timer = setTimeout(() => {
      const isValidUrl = (url: string) => {
        try {
          return Boolean(new URL(url));
        } catch (e) {
          return false;
        }
      };

      if (jobUrl && isValidUrl(jobUrl) && !jobDescription && !isFetchingJob) {
        handleFetchJobDescription();
      }
    }, 1000); // Wait 1 second after typing stops

    return () => clearTimeout(timer);
  }, [jobUrl]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [isDarkMode]);

  // Sync results with ResumeStore
  useEffect(() => {
    const res = activeAudience ? results[activeAudience] : null;
    if (res) {
      const newData: ResumeData = {
        personal_info: {
          name: profileName || res.personal_info?.name || '',
          location: profileLocation || res.personal_info?.location || '',
          email: profileEmail || res.personal_info?.email || '',
          phone: profilePhone || res.personal_info?.phone || '',
          linkedin: profileLinkedIn || res.personal_info?.linkedin || '',
          linkedinText: profileLinkedInText || res.personal_info?.linkedinText || '',
          summary: res.summary || ''
        },
        experience: (res.experience || []).map((e: any, i: number) => ({ ...e, id: `exp_${i}` })),
        skills: (res.skills || {}) as any,
        education: (res.education && res.education.length > 0) ? res.education as any : data.education,
        projects: (res.projects && res.projects.length > 0) 
          ? res.projects?.map((p: any) => typeof p === 'string' ? p : { title: (p as any).title, description: (p as any).description, isOptional: true as const }) as any
          : data.projects,
        certifications: res.certifications || []
      };

      // Use a more robust comparison to avoid infinite loops
      const currentDataStr = JSON.stringify(data);
      const newDataStr = JSON.stringify(newData);
      
      if (currentDataStr !== newDataStr) {
        setData(newData);
      }
    }
  }, [activeAudience, results, setData, profileName, profileLocation, profileEmail, profilePhone, profileLinkedIn, profileLinkedInText, data]);

  const overflow = detectOverflow(pages);
  const [expandedReports, setExpandedReports] = useState<Record<string, boolean>>({});
  const [showInsights, setShowInsights] = useState(true);
  
  const [engineConfig, setEngineConfig] = useState<Record<string, any>>({
    gemini: { 
      model: 'gemini-3.5-flash', 
      apiKey: (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '') || '' 
    },
    openai: { 
      model: 'gpt-4o', 
      apiKey: (typeof process !== 'undefined' ? process.env.OPENAI_API_KEY : '') || '' 
    },
    production: { model: 'auto', apiKey: '' }
  });
  const [selectedEngine, setSelectedEngine] = useState<'gemini' | 'openai' | 'hybrid-gemini' | 'hybrid-openai'>('gemini');
  const [showEngineSettings, setShowEngineSettings] = useState(false);
  
  const getSectionStyle = (sectionId: string) => {
    const style = sectionStyles[sectionId] || {};
    return { ...DEFAULT_STYLE, ...style };
  };

  const [configWidth, setConfigWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth >= 1600) return 30;
      if (window.innerWidth >= 1200) return 35;
      return 40;
    }
    return 40;
  }); // percentage
  const [isResizingWidth, setIsResizingWidth] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isAutoZoom, setIsAutoZoom] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [activeTheme, setActiveTheme] = useState(() => {
    const saved = localStorage.getItem('activeThemeId');
    if (saved) {
      return BACKGROUND_THEMES.find(t => t.id === saved) || BACKGROUND_THEMES[0];
    }
    return BACKGROUND_THEMES[0];
  });

  const getThemeStyles = () => {
    const isInfoGeneus = activeTheme.id === 'infogeneus';
    return {
      primary: isInfoGeneus ? 'cyan-500' : 'emerald-500',
      primaryText: isInfoGeneus ? 'text-cyan-400' : 'text-emerald-400',
      primaryBg: isInfoGeneus ? 'bg-cyan-500' : 'bg-emerald-500',
      primaryBorder: isInfoGeneus ? 'border-cyan-500/20' : 'border-emerald-500/20',
      primaryShadow: isInfoGeneus ? 'shadow-cyan-500/20' : 'shadow-emerald-500/20',
      primaryGlow: isInfoGeneus ? 'shadow-cyan-500/10' : 'shadow-emerald-500/10',
      secondary: isInfoGeneus ? 'indigo-400' : 'rose-400',
      secondaryText: isInfoGeneus ? 'text-indigo-400' : 'text-rose-400',
      secondaryBg: isInfoGeneus ? 'bg-indigo-400' : 'bg-rose-400',
    };
  };

  const theme = getThemeStyles();
  const themeInputRef = useRef<HTMLInputElement>(null);

  const handleCustomTheme = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (auth.currentUser) {
        try {
          const storageRef = ref(storage, `wallpapers/${auth.currentUser.uid}/custom`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          await setDoc(doc(db, 'users', auth.currentUser.uid), { wallpaperUrl: url }, { merge: true });
          setActiveTheme({ id: 'custom', label: 'Custom', url });
        } catch (error) {
          console.error("Error uploading wallpaper:", error);
          // Fallback to local URL if upload fails
          const url = URL.createObjectURL(file);
          setActiveTheme({ id: 'custom', label: 'Custom', url });
        }
      } else {
        const url = URL.createObjectURL(file);
        setActiveTheme({ id: 'custom', label: 'Custom', url });
        localStorage.setItem('nexus_custom_bg_url', url);
      }
      setIsThemeMenuOpen(false);
    }
  };
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(200);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [previewMode, setPreviewMode] = useState<'standard' | 'simplified'>('standard');
  const [viewMode, setViewMode] = useState<'resume' | 'insights'>('resume');
  const [isDownloading, setIsDownloading] = useState(false);

  const saveResumeVersion = async (customName?: string) => {
    const savedHistory = JSON.parse(localStorage.getItem('resumeHistory') || '[]');
    
    // Avoid saving if identical to last entry
    const lastEntry = savedHistory[0];
    if (lastEntry && 
        lastEntry.data.resumeText === resumeText && 
        JSON.stringify(lastEntry.data.results) === JSON.stringify(results)) {
      return;
    }

    if (!user) return;

    const timestamp = new Date().toISOString();
    let generatedName = customName;
    
    if (!generatedName) {
      if (companyName && targetRole) {
        generatedName = `${companyName} - ${targetRole} - ${new Date(timestamp).toLocaleString()}`;
      } else if (companyName) {
        generatedName = `${companyName} - ${new Date(timestamp).toLocaleString()}`;
      } else if (targetRole) {
        generatedName = `${targetRole} - ${new Date(timestamp).toLocaleString()}`;
      } else {
        generatedName = `Auto-save - ${new Date(timestamp).toLocaleString()}`;
      }
    }

    const newVersion = {
      id: Date.now(),
      timestamp,
      name: generatedName,
      data: {
        resumeText,
        jobDescription,
        targetRole,
        companyName,
        results,
        activeAudience,
        selectedAudiences,
        formatting: formattingState
      }
    };

    /*
    await addDoc(collection(db, 'users', user.uid, 'resumeVersions'), {
        userId: user.uid,
        timestamp: serverTimestamp(),
        name: generatedName,
        data: {
          resumeText,
          jobDescription,
          targetRole,
          companyName,
          results,
          activeAudience,
          selectedAudiences,
          formatting: formattingState
        }
      }).catch(err => handleFirestoreError(err, OperationType.CREATE, 'users/' + user.uid + '/resumeVersions'));
    */
    window.dispatchEvent(new CustomEvent('resumeHistoryUpdated'));
  };

  // Auto-save to history mechanism
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (!resumeText || resumeText.length < 50) return; // Don't save empty or very short resumes
    
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    
    autoSaveTimerRef.current = setTimeout(() => {
      saveResumeVersion();
    }, 30000); // Auto-save every 30 seconds of inactivity

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [resumeText, jobDescription, targetRole, companyName, results, formattingState]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const savedThemeId = localStorage.getItem('nexus_bg_theme');
    
    const loadTheme = async () => {
      if (savedThemeId) {
        if (savedThemeId === 'custom') {
          // If logged in, fetch from Firestore, otherwise from localStorage
          if (auth.currentUser) {
            try {
              const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
              const wallpaperUrl = userDoc.data()?.wallpaperUrl;
              if (wallpaperUrl) {
                setActiveTheme({ id: 'custom', label: 'Custom', url: wallpaperUrl });
                return; // success
              }
            } catch (e) {
              console.error("Error loading wallpaper from firestore", e);
            }
          }
          const customUrl = localStorage.getItem('nexus_custom_bg_url');
          if (customUrl) {
            setActiveTheme({ id: 'custom', label: 'Custom', url: customUrl });
          }
        } else {
          const theme = BACKGROUND_THEMES.find(t => t.id === savedThemeId);
          if (theme) {
            setActiveTheme(theme);
          } else {
            setActiveTheme(BACKGROUND_THEMES[0]);
            localStorage.setItem('nexus_bg_theme', BACKGROUND_THEMES[0].id);
          }
        }
      }
    };
    loadTheme();
  }, [user]);


  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme.id);
    document.documentElement.style.setProperty('--glass-bg-image', `url('${activeTheme.url}')`);
    if ((activeTheme as any).blobs) {
      document.documentElement.style.setProperty('--blob-color', (activeTheme as any).blobs[0]);
      document.documentElement.style.setProperty('--blob-color-secondary', (activeTheme as any).blobs[1] || (activeTheme as any).blobs[0]);
    }
    if ((activeTheme as any).font) {
      document.documentElement.style.setProperty('--font-sans', (activeTheme as any).font);
    }
    if ((activeTheme as any).isSolid) {
      document.documentElement.classList.add('theme-solid');
    } else {
      document.documentElement.classList.remove('theme-solid');
    }
    localStorage.setItem('nexus_bg_theme', activeTheme.id);
    if (activeTheme.id === 'custom') {
      localStorage.setItem('nexus_custom_bg_url', activeTheme.url);
    }
  }, [activeTheme]);

  const [error, setError] = useState<string | null>(null);
  const [showModeInfo, setShowModeInfo] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAutoSelectingAudiences, setIsAutoSelectingAudiences] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [optimizationProgress, setOptimizationProgress] = useState(0);
  const [showOptimizeSuccess, setShowOptimizeSuccess] = useState(false);
  const [optimizationStatus, setOptimizationStatus] = useState('');
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [tokenUsage, setTokenUsage] = useState({
    gemini: { input: 0, output: 0 },
    openai: { input: 0, output: 0 }
  });

  const [isRefreshingTokens, setIsRefreshingTokens] = useState(false);
  const [deepResearchId, setDeepResearchId] = useState<string | null>(null);
  const [deepResearchReport, setDeepResearchReport] = useState<string | null>(null);
  const [isDeepResearching, setIsDeepResearching] = useState(false);
  const deepResearchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getCurrentMonthStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  // Fetch token usage manually
  const fetchTokenUsage = async () => {
    if (!user) return;
    setIsRefreshingTokens(true);
    const currentMonth = getCurrentMonthStr();
    const path = `users/${user.uid}/tokenUsage/${currentMonth}`;
    const usageRef = doc(db, path);
    
    try {
      const docSnap = await safeGetDoc(usageRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        setTokenUsage({
          gemini: data.gemini || { input: 0, output: 0 },
          openai: data.openai || { input: 0, output: 0 }
        });
      } else {
        setTokenUsage({
          gemini: { input: 0, output: 0 },
          openai: { input: 0, output: 0 }
        });
      }
      showToast('Token usage updated', 'success');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.GET, path);
      console.error('Failed to refresh tokens:', err);
      showToast('Failed to refresh tokens', 'error');
    } finally {
      setIsRefreshingTokens(false);
    }
  };

  // Sync token usage to Firestore when it changes
  const syncTokenUsage = async (engine: 'gemini' | 'openai', input: number, output: number) => {
    if (!user) return;
    const currentMonth = getCurrentMonthStr();
    const path = `users/${user.uid}/tokenUsage/${currentMonth}`;
    const usageRef = doc(db, path);
    try {
      await setDoc(usageRef, {
        userId: user.uid,
        month: currentMonth,
        [engine]: {
          input: increment(input),
          output: increment(output)
        },
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const generateTokenReport = async () => {
    if (!user) return;
    setIsDownloading(true);
    try {
      const usageCol = collection(db, 'users', user.uid, 'tokenUsage');
      const q = query(usageCol, orderBy('month', 'desc'));
      const querySnapshot = await getDocs(q);
      
      let csv = "Month,Gemini Input,Gemini Output,OpenAI Input,OpenAI Output\n";
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        csv += `${d.month},${d.gemini?.input || 0},${d.gemini?.output || 0},${d.openai?.input || 0},${d.openai?.output || 0}\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv' });
      const fileName = `TokenUsageReport_${user.uid}_${getTodayStr()}.csv`;
      
      // Save locally
      saveAs(blob, fileName);

      // Save to Google Drive if connected
      if (driveAccessToken || process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64data = (reader.result as string).split(',')[1];
          try {
            const response = await fetch('/api/save-to-drive', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pdfData: base64data,
                fileName: fileName,
                versioningEnabled: false,
                accessToken: driveAccessToken,
                parentFolderId: selectedDriveFolder?.id
              })
            });
            const data = await response.json();
            if (data.success) {
              showToast("Report saved to Google Drive", "success");
            }
          } catch (err) {
            console.error("Error saving report to Drive:", err);
          }
        };
      }
      
      showToast("Token usage report generated", "success");
    } catch (err) {
      console.error("Error generating report:", err);
      showToast("Failed to generate report", "error");
    } finally {
      setIsDownloading(false);
    }
  };
  
  const resumePreviewRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [printScale, setPrintScale] = useState(1);

  // Pure visual layout scaling engine - completely removes aggressive text-slicing
  useEffect(() => {
    const calculateFit = () => {
      const resumeEl = document.getElementById('resume-container');
      if (!resumeEl) return;

      // Reset scale to measure baseline layout parameters accurately
      resumeEl.style.transform = 'none';
      resumeEl.style.width = '100%';

      const MAX_SAFE_HEIGHT = 2050; // Strict 2-page structural boundary box
      const actualHeight = resumeEl.scrollHeight;

      if (actualHeight > MAX_SAFE_HEIGHT) {
        // Apply smooth scaling, but CAP IT at 0.92 so fonts never become unreadable
        const newScale = Math.max(0.92, MAX_SAFE_HEIGHT / actualHeight);
        setPrintScale(newScale);
      } else {
        setPrintScale(1);
      }
    };

    const timeoutId = setTimeout(calculateFit, 500);
    return () => clearTimeout(timeoutId);
  }, [resumeText, results, activeAudience, previewMode, zoom, data]);
  const [contentHeight, setContentHeight] = useState(1123);
  const [isPiiMasked, setIsPiiMasked] = useState(false);
  const [customFonts, setCustomFonts] = useState<{name: string, url: string, format: string}[]>([]);

  // Autosave to Drive logic
  useEffect(() => {
    if (!isOptimizing && Object.keys(results).length > 0 && isAutosaveEnabled && (driveAccessToken || process.env.GOOGLE_SERVICE_ACCOUNT_KEY)) {
      // Small delay to ensure DOM is updated
      const timer = setTimeout(() => {
        handleDriveAutosave();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isOptimizing, results, isAutosaveEnabled]);

  const handleDriveAutosave = async () => {
    try {
      const element = document.getElementById('resume-container');
      if (!element) return;

      // Get all styles and imports
      const allStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(el => {
          if (el.tagName === 'STYLE') return el.innerHTML;
          if (el.tagName === 'LINK') {
            const href = (el as HTMLLinkElement).href;
            if (href.includes('fonts.googleapis.com')) return `@import url('${href}');`;
          }
          return '';
        })
        .join('\n');

      const scaleCSS = `
        #resume-container {
          transform: scale(${printScale}) !important;
          transform-origin: top left !important;
          width: calc(100% / ${printScale}) !important;
        }
      `;

      const role = targetRole || 'Resume';
      const company = companyName ? `-${companyName}` : '';
      const driveFileName = `${role}${company}-Harnish Jariwala.pdf`;
      const pdfTitle = driveFileName.replace('.pdf', '');

      const sessionResponse = await fetch('/api/pdf-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: element.outerHTML,
          css: allStyles + '\n' + scaleCSS,
          title: pdfTitle,
          fonts: customFonts.map(font => `
            @font-face {
              font-family: '${font.name}';
              src: url('${font.url}') format('${font.format}');
            }
          `).join('\n')
        }),
      });

      if (!sessionResponse.ok) {
        throw new Error('PDF session creation failed');
      }
      const { sessionId } = await sessionResponse.json();
      
      const pdfResponse = await fetch(`/api/download-pdf/${sessionId}`);
      if (!pdfResponse.ok) {
        throw new Error('PDF download failed');
      }
      
      const blob = await pdfResponse.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];
        
        const saveResponse = await fetch('/api/save-to-drive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pdfData: base64data,
            fileName: driveFileName,
            versioningEnabled: versioningEnabled,
            accessToken: driveAccessToken,
            parentFolderId: selectedDriveFolder?.id
          })
        });
        
        const saveData = await saveResponse.json();
        if (saveResponse.ok && saveData.success) {
          showToast('Autosaved to Google Drive', 'success');
          fetchDriveFiles();
        } else if (saveData.error && saveData.error.includes('AUTH_EXPIRED')) {
          setDriveAccessToken(null);
        }
      };
    } catch (err) {
      console.error('Autosave error:', err);
    }
  };

  const handleFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const fontName = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '');
      const format = file.name.endsWith('.woff2') ? 'woff2' : file.name.endsWith('.woff') ? 'woff' : 'truetype';
      
      const style = document.createElement('style');
      style.innerHTML = `
        @font-face {
          font-family: '${fontName}';
          src: url('${base64}') format('${format}');
        }
      `;
      document.head.appendChild(style);

      setCustomFonts(prev => [...prev, { name: fontName, url: base64, format }]);
    };
    reader.readAsDataURL(file);
  };

  const [sectionOrder, setSectionOrder] = useState<string[]>([
    'header', 'summary', 'skills', 'certifications', 'experience', 'projects', 'education'
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSectionOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  useEffect(() => {
    if (!previewContainerRef.current) return;
    
    let animationFrameId: number;
    
    const calculateZoom = () => {
      if (!previewContainerRef.current) return;
      
      const container = previewContainerRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      if (containerWidth === 0 || containerHeight === 0) return;

      const resumeElement = document.getElementById('resume-container');
      if (!resumeElement) return;

      const currentZoom = zoom || 1;
      
      // Use offsetWidth directly as it represents the unscaled CSS dimensions (e.g. 210mm = 794px)
      // Dividing by currentZoom was causing the scaling loop to minimum zoom
      const contentWidth = resumeElement.scrollWidth;
      const contentHeight = resumeElement.scrollHeight;
      
      if (contentWidth === 0 || contentHeight === 0) return;
      
      // Update state for exact container sizing ALWAYS so it doesn't clip
      setContentHeight(contentHeight);

      // Early return if we shouldn't adjust zoom
      if (!isAutoZoom) return;

      const padding = window.innerWidth < 768 ? 8 : 32; 
      const availableWidth = containerWidth - padding;
      const availableHeight = containerHeight - padding;
      
      const scaleX = availableWidth / contentWidth;
      const scaleY = availableHeight / contentHeight;
      
      let newZoom;
      const isMobile = window.innerWidth < 640;

      if (isMobile) {
        // On mobile, fit width exactly so it doesn't overflow
        newZoom = Math.max(0.1, Math.min(scaleX, 1.0));
      } else {
        // On desktop/laptop, prioritize width fitting but allow some vertical fitting
        // Increase minimum zoom to 60% (0.6) to avoid the "zoom only 20%" issue
        newZoom = Math.max(0.6, Math.min(scaleX, 1.1));
        
        // If it's still way too tall for the screen, we can slightly nudge it but not to 20%
        if (scaleY < newZoom) {
          newZoom = Math.max(0.6, Math.min(newZoom, scaleY * 1.5));
        }
      }
      
      if (Math.abs(newZoom - currentZoom) > 0.01) {
        setZoom(newZoom);
      }
    };

    const observer = new ResizeObserver((entries) => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      animationFrameId = requestAnimationFrame(() => {
        calculateZoom();
      });
    });

    if (previewContainerRef.current) {
      observer.observe(previewContainerRef.current);
    }
    
    // Also observe the resume element itself if it exists, so changes in content size trigger zoom updates
    const resumeEl = document.getElementById('resume-container');
    if (resumeEl) {
      observer.observe(resumeEl);
    }
    
    // Initial calculation
    calculateZoom();

    // Re-calculate after a short delay to ensure DOM is fully updated
    const timeoutId = setTimeout(calculateZoom, 100);

    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [activeAudience, isAutoZoom, results, data, previewMode, isFocusMode, isOptimizing]); // Re-run when content or mode changes

  const extractTextFromPDF = async (file: File) => {
    setIsExtracting(true);
    setFileName(file.name);
    try {
      const text = await extractTextFromPDFFile(file);
      setResumeText(text);
    } catch (err) {
      console.error('Error extracting PDF text:', err);
      setError('Failed to extract text from PDF. Please try pasting the text manually.');
    } finally {
      setIsExtracting(false);
    }
  };

  const extractLinkedInTextFromPDF = async (file: File) => {
    setIsExtractingLinkedIn(true);
    setLinkedInFileName(file.name);
    try {
      const text = await extractTextFromPDFFile(file);
      setLinkedInPdfText(text);
    } catch (err) {
      console.error('Error extracting LinkedIn PDF text:', err);
      setError('Failed to extract text from LinkedIn PDF.');
    } finally {
      setIsExtractingLinkedIn(false);
    }
  };

  useEffect(() => {
    if (!jobDescription) return;
    
    const jdLower = jobDescription.toLowerCase();
    const companies = [
      { id: 'amazon', keywords: ['amazon', 'aws', 'blue origin'] },
      { id: 'google', keywords: ['google', 'alphabet', 'youtube', 'waymo'] },
      { id: 'microsoft', keywords: ['microsoft', 'azure', 'linkedin', 'github'] },
      { id: 'meta', keywords: ['meta', 'facebook', 'instagram', 'whatsapp'] },
      { id: 'apple', keywords: ['apple', 'iphone', 'macos', 'ios'] },
      { id: 'accenture', keywords: ['accenture'] },
      { id: 'infosys', keywords: ['infosys'] },
    ];
    
    for (const company of companies) {
      if (company.keywords.some(keyword => {
        // Use word boundary to avoid partial matches (e.g., "amazons" matches but "amaz" doesn't)
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        return regex.test(jdLower);
      })) {
        console.log(`[Nexus Pro] Auto-detected company: ${company.id}`);
        setTargetCompany(company.id as any);
        return;
      }
    }
  }, [jobDescription]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        extractTextFromPDF(file);
      } else if (file.type === 'text/plain' || file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          if (file.type === 'application/json') {
            try {
              const json = JSON.parse(content);
              setResumeText(JSON.stringify(json, null, 2));
            } catch (e) {
              setError('Invalid JSON file.');
              return;
            }
          } else {
            setResumeText(content);
          }
          setFileName(file.name);
        };
        reader.readAsText(file);
      } else {
        setError('Please upload a PDF, TXT, or JSON file.');
      }
    }
  };

  const handleLinkedInFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        extractLinkedInTextFromPDF(file);
      } else if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (event) => {
          setLinkedInPdfText(event.target?.result as string);
          setLinkedInFileName(file.name);
        };
        reader.readAsText(file);
      } else {
        setError('Please upload a PDF or TXT file.');
      }
    }
  };

  const getEffectiveResumeText = () => {
    if (resumeText) return resumeText;
    
    // Fallback to empty if no text uploaded
    return "";
  };

  const restoreVersion = (version: any) => {
    if (version.data.resumeText) setResumeText(version.data.resumeText);
    if (version.data.jobDescription) setJobDescription(version.data.jobDescription);
    if (version.data.results) setResults(version.data.results);
    if (version.data.activeAudience) setActiveAudience(version.data.activeAudience);
    else if (version.data.results && Object.keys(version.data.results).length > 0) {
      setActiveAudience(Object.keys(version.data.results)[0]);
    }
    if (version.data.selectedAudiences) setSelectedAudiences(version.data.selectedAudiences);
    if (version.data.targetRole) setTargetRole(version.data.targetRole);
    if (version.data.companyName) setCompanyName(version.data.companyName);
    if (version.data.formatting) {
      formattingDispatch({ type: 'SET_ALL_STYLES', styles: version.data.formatting.styles || {} });
    }
    
    navigate('/build');
  };

  const handleAutoSelectAudiences = async () => {
    if (!jobDescription) return;
    setIsAutoSelectingAudiences(true);
    try {
      const bestAudiences = await analyzeBestAudiences(jobDescription, targetRole, getRouterConfig());
      setSelectedAudiences(bestAudiences);
      showToast('Audience auto-selected!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to auto-select audience', 'error');
    } finally {
      setIsAutoSelectingAudiences(false);
    }
  };

  const toggleAudience = (id: string) => {
    setSelectedAudiences(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const getRouterConfig = (): RouterConfig => {
    return {
      mode: selectedEngine as any,
      geminiConfig: {
        engine: 'gemini',
        model: engineConfig.gemini.model,
        apiKey: geminiApiKey || (typeof encryptedApiKey === 'string' && encryptedApiKey.includes(':') ? encryptedApiKey : '') || engineConfig.gemini.apiKey
      },
      openaiConfig: {
        engine: 'openai',
        model: engineConfig.openai.model,
        apiKey: openaiApiKey || (typeof encryptedApiKey === 'string' && encryptedApiKey.includes(':') ? encryptedApiKey : '') || engineConfig.openai.apiKey
      }
    };
  };

  const handleFetchJobDescription = async () => {
    if (!jobUrl) {
      setError('Please enter a job URL first.');
      return;
    }
    
    setIsFetchingJob(true);
    setError(null);
    try {
      const text = await fetchJobDescription(jobUrl, getRouterConfig());
      
      const lowerText = text.toLowerCase();
      if (
        lowerText.includes('anti-scraping') || 
        lowerText.includes('blocked by linkedin') || 
        lowerText.includes('security policies currently block') ||
        lowerText.includes('unable to retrieve specific')
      ) {
        setError('LinkedIn prevents automated extraction of this job posting. Please copy and paste the job description text manually into the text area below.');
        setJobDescription('');
      } else {
        setJobDescription(text);
      }
    } catch (err: any) {
      console.error('Error fetching job description:', err);
      setError(`Failed to fetch job description: ${err.message || 'Unknown error'}. You can still paste it manually.`);
    } finally {
      setIsFetchingJob(false);
    }
  };

  const handleCheckSuitability = async () => {
    if (!resumeText || (!jobDescription && !jobUrl)) {
      setError('Please provide both a resume and a job description (or URL).');
      return;
    }

    setIsCheckingSuitability(true);
    setSuitabilityResult(null);
    setMultiSuitabilityResults({});
    setError(null);
    isSuitabilityCancelledRef.current = false;

    try {
      let finalJobDescription = jobDescription;
      if (!finalJobDescription && jobUrl) {
        finalJobDescription = await fetchJobDescription(jobUrl, getRouterConfig());
      }

      // Check all master resumes
      const results: Record<string, SuitabilityResult> = {};
      const jobDesc = finalJobDescription;
      const config = getRouterConfig();

      // We run them in parallel for speed
      await Promise.all(masterResumes.map(async (resume) => {
        try {
          const resText = JSON.stringify(resume.data, null, 2);
          const evaluation = await evaluateSuitability(resText, jobDesc, config, true);
          if (!isSuitabilityCancelledRef.current) {
            results[resume.id] = evaluation;
          }
        } catch (e) {
          console.error(`Failed to evaluate resume ${resume.id}:`, e);
        }
      }));

      if (!isSuitabilityCancelledRef.current) {
        setMultiSuitabilityResults(results);
        
        // Find the resume ID with the highest match score
        let bestResumeId = selectedResumeId;
        let highestScore = -1;

        Object.entries(results).forEach(([id, result]) => {
          if (result.matchScore > highestScore) {
            highestScore = result.matchScore;
            bestResumeId = id;
          }
        });

        const primaryResult = results[bestResumeId];
        if (primaryResult) {
          setSuitabilityResult(primaryResult);
          
          // Auto-select the best resume for the user
          const bestResume = masterResumes.find(r => r.id === bestResumeId);
          if (bestResume) {
            setSelectedResumeId(bestResumeId);
            setResumeText(JSON.stringify(bestResume.data, null, 2));
          }
        } else {
          throw new Error("Failed to evaluate any of the resumes.");
        }
      }
    } catch (err: any) {
      console.error("Suitability check failed:", err);
      setError(err.message || 'Failed to check suitability. Please try again.');
    } finally {
      setIsCheckingSuitability(false);
    }
  };

  const handleDeepResearch = async () => {
    if (!jobDescription || !resumeText) {
      showToast("Please provide job description and resume content", "info");
      return;
    }
    
    setIsDeepResearching(true);
    setDeepResearchReport(null);
    try {
      const interactionId = await startDeepResearch(resumeText, jobDescription);
      setDeepResearchId(interactionId);
      
      // Stop old polling if any
      if (deepResearchIntervalRef.current) clearInterval(deepResearchIntervalRef.current);
      
      // Start polling
      deepResearchIntervalRef.current = setInterval(async () => {
        try {
          const status = await getDeepResearchStatus(interactionId);
          if (status.status === "completed") {
            setDeepResearchReport(status.output);
            setIsDeepResearching(false);
            if (deepResearchIntervalRef.current) clearInterval(deepResearchIntervalRef.current);
            showToast("Deep Research Completed", "success");
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 5000);
    } catch (err: any) {
      setIsDeepResearching(false);
      showToast(err.message, "error");
    }
  };

  const handleOptimize = async (overrideResumeText?: string) => {
    console.log("[Nexus AI] handleOptimize started. Engine:", selectedEngine);
    if (isExtracting) return;
    setError(null);
    setOptimizationStatus("Initializing Nexus Pipeline...");
    
    const routerConfig = getRouterConfig();
    
    // STRICT CHECK: Ensure at least one API key is present for the selected engine
    const geminiKeyToUse = geminiApiKey || (typeof encryptedApiKey === 'string' && encryptedApiKey.includes(':') ? encryptedApiKey : '') || engineConfig.gemini.apiKey;
    const openaiKeyToUse = openaiApiKey || (typeof encryptedApiKey === 'string' && encryptedApiKey.includes(':') ? encryptedApiKey : '') || engineConfig.openai.apiKey;

    // Additional check: if they are still only encrypted strings, we can't really "use" them reliably on the frontend 
    // but the backend might handle them. However, we should warn if no key was actually decrypted and no fallback exists.
    
    // Final check for missing API keys with the specific requested message
    const isGeminiNeeded = selectedEngine === 'gemini' || selectedEngine === 'hybrid-gemini';
    const isOpenAINeeded = selectedEngine === 'openai' || selectedEngine === 'hybrid-openai';
    
    const hasGKey = !!geminiApiKey || (!!encryptedApiKey && encryptedApiKey.includes(':'));
    const hasOKey = !!openaiApiKey || (!!encryptedApiKey && encryptedApiKey.includes(':'));

    if (isGeminiNeeded && !hasGKey) {
      const msg = "At least 1 API key needed. Please insert your Gemini API key.";
      setError(msg);
      showToast(msg, "error");
      return;
    }
    if (isOpenAINeeded && !hasOKey) {
      const msg = "At least 1 API key needed. Please insert your OpenAI API key.";
      setError(msg);
      showToast(msg, "error");
      return;
    }
    if (!hasGKey && !hasOKey) {
      const msg = "At least 1 API key needed. Please insert your API key in the Profile tab.";
      setError(msg);
      showToast(msg, "error");
      return;
    }

    if (!targetRole.trim() || !companyName.trim()) {
      console.warn("[Nexus AI] Mandatory fields missing");
      const msg = 'Target Role and Company Name are mandatory.';
      setError(msg);
      showToast(msg, "error");
      return;
    }

    if (!jobDescription && !jobUrl) {
      console.warn("[Nexus AI] Job description/URL missing");
      const msg = 'Please provide a job description or job URL to optimize against.';
      setError(msg);
      showToast(msg, "error");
      return;
    }

    let currentAudiences = [...selectedAudiences];
    console.log("[Nexus AI] Current Audiences:", currentAudiences);

    if (currentAudiences.length === 0) {
      console.log("[Nexus AI] No audiences selected, analyzing best audiences...");
      setIsOptimizing(true);
      
      try {
        const bestAudiences = await analyzeBestAudiences(jobDescription || jobUrl || "", targetRole || "Professional Candidate", getRouterConfig(), fastMode);
        console.log("[Nexus AI] Best Audiences matched:", bestAudiences);
        if (bestAudiences && bestAudiences.length > 0) {
          setSelectedAudiences(bestAudiences);
          currentAudiences = bestAudiences;
        } else {
          console.warn("[Nexus AI] Could not auto-select audience");
          setError('Could not auto-select audience. Please select at least one manually.');
          setIsOptimizing(false);
          return;
        }
      } catch (err) {
        console.error("[Nexus AI] Auto-selection failed:", err);
        setError('Auto-selection failed. Please select an audience manually.');
        setIsOptimizing(false);
        return;
      }
    } else {
      setIsOptimizing(true);
    }

    console.log("[Nexus AI] Optimization state active. Proceeding with", currentAudiences.length, "audiences");
    setCurrentOptimizingEngine(selectedEngine);
    setResults({});
    setActiveAudience(null);
    setOptimizationProgress(5);
    
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    progressIntervalRef.current = setInterval(() => {
      setOptimizationProgress(prev => {
        if (prev < 90) {
          // Move much slower: close 1% of the distance to 90 every 100ms
          return prev + (90 - prev) * 0.01;
        }
        return prev;
      });
    }, 100);
    
    const engineNameMap: Record<string, string> = {
      'gemini': 'Google Gemini 2.0',
      'openai': 'OpenAI GPT-4o',
      'hybrid-gemini': 'Hybrid Strategy (Gemini + Flash)',
      'hybrid-openai': 'Hybrid Premium (OpenAI + Gemini Flash)'
    };
    const engineName = engineNameMap[selectedEngine as keyof typeof engineNameMap] || selectedEngine.toUpperCase();
    setOptimizationStatus(`Initializing ${engineName}...`);

    const controller = new AbortController();
    setAbortController(controller);
    
    let finalResumeText = overrideResumeText || resumeText || "";

    // SMART MASTER SELECTION STRATEGY
    // If there are multiple resumes in Nexus Master, help the user pick the right base
    if (masterResumes.length > 0) {
      setOptimizationStatus("Scanning for best master resume profile...");
      try {
        // Add artificial delay to show scanning process as requested by user
        await new Promise(r => setTimeout(r, 800));
        setOptimizationStatus("Selecting Best Master Resume profile...");
        
        const bestId = await selectBestMasterResume(
          jobDescription || jobUrl || "",
          masterResumes,
          getRouterConfig()
        );
        
        let selectedMasterName = masterResumes.length > 0 ? masterResumes[0].name : "Default Profile";
        
        if (bestId) {
          const selectedMaster = masterResumes.find(r => r.id === bestId);
          if (selectedMaster) {
            selectedMasterName = selectedMaster.name;
            setMasterResumes(prev => prev.map(r => ({ ...r, isActive: r.id === bestId })));
            
            const masterData = typeof selectedMaster.data === 'string' 
              ? selectedMaster.data 
              : JSON.stringify(selectedMaster.data, null, 2);
              
            finalResumeText = masterData;
            setResumeText(masterData);
          }
        }
        showToast(`Using Profile: ${selectedMasterName}`, 'success');
      } catch (err) {
        console.error("[Nexus AI] Master selection failed, proceeding with default base:", err);
      }
    }

    try {
      const finalTargetRole = targetRole || "Professional Candidate";
      let finalMode = mode;
      try {
        const isPC = await autoSelectPlayerCoachRole(jobDescription, getRouterConfig());                
        if (isPC) {
          console.log("[Nexus AI] Auto-detected Player-Coach role based on JD.");
          finalMode = 'Player-Coach';
        }
      } catch (err) {
        console.warn("[Nexus AI] Auto-detection of Player-Coach failed, using user selection:", err);
      }
      
      const routerConfig = getRouterConfig();
      let completedAudiences = 0;
      const totalAudiences = currentAudiences.length;
      const engineName = engineNameMap[selectedEngine as keyof typeof engineNameMap] || selectedEngine.toUpperCase();

      // Set a combined status for all audiences to avoid rapid overwriting
      const allAudienceLabels = currentAudiences.map(audienceId => 
        audienceId === 'custom' 
          ? (customAudience || 'Custom Persona') 
          : (AUDIENCES.find(a => a.id === audienceId)?.label || audienceId)
      );
      setOptimizationStatus(`Optimizing for: \n${allAudienceLabels.join(', ')}`);

      // Run all audience optimizations in parallel
      const optimizationPromises = currentAudiences.map(async (audienceId, index) => {
        const audienceLabel = audienceId === 'custom' 
          ? (customAudience || 'Custom Persona') 
          : (AUDIENCES.find(a => a.id === audienceId)?.label || audienceId);
        
        // Progress reporting for hybrid mode (only set by first one to prevent overlap)
        if (selectedEngine.includes('hybrid') && index === 0) {
          setTimeout(() => {
            if (isOptimizing) setOptimizationStatus(`Step 2: Internal Logic & Content Trimming for ${allAudienceLabels.length} audiences...`);
          }, 4000);
          setTimeout(() => {
            if (isOptimizing) setOptimizationStatus(`Step 3: Final Synthesis with ${selectedEngine.includes('openai') ? 'OpenAI' : 'Gemini 3.1 Pro'}...`);
          }, 8000);
        }
        
        const data = await optimizeResume(
          finalResumeText, 
          jobDescription, 
          finalTargetRole, 
          finalMode, 
          audienceLabel, 
          routerConfig, 
          linkedInUrl, 
          linkedInPdfText, 
          jobUrl, 
          fastMode, 
          recruiterSimulationMode,
          customPrompt,
          selectedEngine.includes('hybrid') ? selectedEngine : undefined,
          targetCompany,
          brainDump
        );
        
        completedAudiences++;
        setOptimizationProgress(Math.min(95, (completedAudiences / currentAudiences.length) * 100));
        
        // Update token usage
        if (data._engine === 'hybrid-v2') {
          // Handle V2 Pipeline (OpenAI + Gemini)
          if (data._usage) {
            const openaiInput = data._usage.promptTokenCount || 0;
            const openaiOutput = data._usage.candidatesTokenCount || 0;
            setTokenUsage(prev => ({
              ...prev,
              openai: {
                input: (prev.openai.input || 0) + openaiInput,
                output: (prev.openai.output || 0) + openaiOutput
              }
            }));
            syncTokenUsage('openai', openaiInput, openaiOutput);
          }
          if (data._geminiUsage) {
            const geminiInput = data._geminiUsage.promptTokenCount || 0;
            const geminiOutput = data._geminiUsage.candidatesTokenCount || 0;
            setTokenUsage(prev => ({
              ...prev,
              gemini: {
                input: (prev.gemini.input || 0) + geminiInput,
                output: (prev.gemini.output || 0) + geminiOutput
              }
            }));
            syncTokenUsage('gemini', geminiInput, geminiOutput);
          }
        } else if (data._usage && data._engine) {
          // Handle Legacy Pipeline
          const engine = data._engine === 'gemini' ? 'gemini' : 'openai';
          const inputDelta = data._usage!.promptTokenCount || 0;
          const outputDelta = data._usage!.candidatesTokenCount || 0;
          
          setTokenUsage(prev => ({
            ...prev,
            [engine]: {
              input: (prev[engine].input || 0) + inputDelta,
              output: (prev[engine].output || 0) + outputDelta
            }
          }));
          
          syncTokenUsage(engine, inputDelta, outputDelta);
        }

        // Update results
        setResults(prev => {
          const newResults = { 
            ...prev, 
            [audienceId]: { 
              ...data, 
              _engine: selectedEngine, 
              _model: engineConfig[selectedEngine]?.model || (selectedEngine.includes('openai') ? engineConfig.openai.model : engineConfig.gemini.model)
            } as any
          };
          
          if (!activeAudience) {
            setActiveAudience(audienceId);
          }
          
          return newResults;
        });

        return data;
      });

      const optimizationResults = await Promise.all(optimizationPromises);
      const matchScore = optimizationResults[0]?.match_score || 0;

      // Construct a full results mapping
      const compiledResults: Record<string, any> = {};
      currentAudiences.forEach((audId, idx) => {
        if (optimizationResults[idx]) {
          compiledResults[audId] = {
            ...optimizationResults[idx],
            _engine: selectedEngine,
            _model: engineConfig[selectedEngine]?.model || (selectedEngine.includes('openai') ? engineConfig.openai.model : engineConfig.gemini.model)
          };
        }
      });
      
      // Save version immediately after optimization
      saveResumeVersion(`Optimized - ${companyName} - ${new Date().toLocaleString()}`);

      // Feature 1: Build and save the persistent artifact
      const artifactId = `artifact-${Date.now()}`;
      const activeAud = activeAudience || currentAudiences[0] || 'Default';
      const activeResumeName = masterResumes.find(r => r.id === selectedResumeId)?.name || 'Master Profile';
      
      const newArtifact = {
        id: artifactId,
        resumeId: selectedResumeId,
        resumeName: activeResumeName,
        targetRole: targetRole || 'Professional Candidate',
        targetCompany: companyName || 'Unknown Company',
        atsScore: matchScore,
        timestamp: Date.now(),
        status: 'Complete',
        results: compiledResults,
        activeAudience: activeAud,
        mode: mode,
        jobDescription: jobDescription,
        customPrompt: customPrompt
      };

      try {
        const storedStr = localStorage.getItem('nexus_optimized_resumes');
        const existingArtifacts = storedStr ? JSON.parse(storedStr) : [];
        const fortyEightHoursAgo = Date.now() - 48 * 60 * 60 * 1000;
        const freshArtifacts = existingArtifacts.filter((item: any) => item.timestamp >= fortyEightHoursAgo);
        const updatedArtifacts = [newArtifact, ...freshArtifacts];
        localStorage.setItem('nexus_optimized_resumes', JSON.stringify(updatedArtifacts));
        
        window.dispatchEvent(new Event('nexus_optimization_complete'));
      } catch (e) {
        console.error("Error saving to local optimization artifact center", e);
      }

      // Feature 2: Set Result Workspace Trigger active
      setCurrentResultWorkspaceArtifact(null);
      setShowResultWorkspace(true);

      // Sync to Job Tracker (Firestore)
      if (user) {
        try {
          const docRef = await addDoc(collection(db, 'users', user.uid, 'jobs'), {
            company: companyName || 'Unknown Company',
            role: targetRole || 'Professional Candidate',
            salary: 'Not specified',
            skills: [],
            status: 'Saved',
            dateAdded: Date.now(),
            jd: jobDescription || jobUrl || '',
            score: matchScore,
            updatedAt: serverTimestamp()
          });
          setLastJobId(docRef.id);
        } catch (e) {
          console.error("Failed to sync to Job Tracker (Firestore)", e);
        }
      } else {
        // Fallback to localStorage for guest users
        try {
          const savedJobs = localStorage.getItem('ai_job_tracker');
          const jobs = savedJobs ? JSON.parse(savedJobs) : [];
          const newId = Date.now().toString();
          const newJob = {
            id: newId,
            company: companyName,
            role: targetRole,
            salary: 'Not specified',
            skills: [],
            status: 'Saved',
            dateAdded: Date.now(),
            jd: jobDescription || jobUrl || '',
            score: matchScore
          };
          localStorage.setItem('ai_job_tracker', JSON.stringify([newJob, ...jobs]));
          setLastJobId(newId);
        } catch (e) {
          console.error("Failed to sync to Job Tracker", e);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Optimization aborted');
      } else {
        console.error(err);
        const errorMessage = err.message || 'Failed to optimize resume. Please try again.';
        if (errorMessage.includes('DECRYPTION_FAILED')) {
          setError('Your session or encryption key has changed. Please go to the Profile tab and re-save your API keys.');
        } else {
          setError(errorMessage);
        }
      }
    } finally {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setOptimizationProgress(100);
      setShowOptimizeSuccess(true);
      setTimeout(() => setShowOptimizeSuccess(false), 5000);
      setIsOptimizing(false);
      setAbortController(null);

      // On mobile, auto-switch to Focus Mode (Preview mode) so the user can easily see the result and the download button
      if (window.innerWidth < 640) {
        setIsFocusMode(true);
      }
    }
  };

  const handleStop = () => {
    if (abortController) {
      abortController.abort();
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setIsOptimizing(false);
      setOptimizationProgress(0);
      setAbortController(null);
      showToast("Optimization stopped.", "info");
    }
  };

  const toggleReport = (id: string) => {
    setExpandedReports(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyResumeText = () => {
    if (!activeAudience || !results[activeAudience]) return;
    const res = results[activeAudience];
    
    const skillsText = Array.isArray(res.skills) 
      ? res.skills.join(', ') 
      : Object.entries(res.skills).map(([cat, items]) => `${cat.toUpperCase()}: ${(items as string[]).join(', ')}`).join('\n');

    const projectsText = res.projects?.map(p => typeof p === 'string' ? p : `${p.title}: ${p.description}`).join('\n');

    const text = `
${profileName}
${profileLocation} | ${profileEmail} | ${profilePhone}

PROFESSIONAL SUMMARY
${res.summary}

SKILLS
${skillsText}

PROFESSIONAL EXPERIENCE
${res.experience.map(exp => `
${exp.role} | ${exp.duration}
${exp.company}
${exp.bullets.join('\n')}
`).join('\n')}

${projectsText ? `PROJECTS\n${projectsText}\n` : ''}

CERTIFICATIONS
${(res.certifications || [] as any[]).map(cert => typeof cert === 'string' ? cert : `${cert.name}`).join('\n')}

EDUCATION
${(res.education || [] as any[]).map(edu => typeof edu === 'string' ? edu : `${edu.degree} - ${edu.institution} (Expected : ${edu.expected_completion})`).join('\n')}
    `.trim();
    
    navigator.clipboard.writeText(text);
    showToast('Resume text copied to clipboard! You can paste this into Word or any other editor.', 'success');
  };

  const leftPanelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDownDivider = (e: React.MouseEvent) => {
    setIsResizingWidth(true);
    e.preventDefault();
  };

  const handleMouseDownSidebarDivider = (e: React.MouseEvent) => {
    setIsResizingSidebar(true);
    e.preventDefault();
  };

  const resetLayout = () => {
    if (window.innerWidth >= 1600) setConfigWidth(30);
    else if (window.innerWidth >= 1200) setConfigWidth(35);
    else setConfigWidth(40);
    setIsSidebarOpen(true);
    setSidebarWidth(256);
  };

  useEffect(() => {
    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingSidebar) return;
      
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      animationFrameId = requestAnimationFrame(() => {
        if (isResizingSidebar) {
           // Sidebar is absolute left or flex left, so cursor X matches roughly its intended width
           const newWidth = Math.max(80, Math.min(600, e.clientX));
           setSidebarWidth(newWidth);
           if (newWidth < 120) {
             setIsSidebarOpen(false);
           } else {
             setIsSidebarOpen(true);
           }
        }
      });
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
    };

    if (isResizingSidebar) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp, { capture: true });
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp, { capture: true });
      if (!isResizingWidth) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
  }, [isResizingSidebar, isResizingWidth]);

  useEffect(() => {
    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingWidth || !containerRef.current) return;
      
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      animationFrameId = requestAnimationFrame(() => {
        if (isResizingWidth) {
          const rect = containerRef.current!.getBoundingClientRect();
          const newWidthPx = e.clientX - rect.left;
          const newWidthPercent = (newWidthPx / rect.width) * 100;
          // SaaS constraints: 25% to 55%
          setConfigWidth(Math.max(25, Math.min(55, newWidthPercent)));
        }
      });
    };

    const handleMouseUp = () => {
      setIsResizingWidth(false);
    };

    if (isResizingWidth) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp, { capture: true });
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp, { capture: true });
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingWidth]);

  const syncJobTrackerApplied = async () => {
    if (!lastJobId) return;

    if (user) {
      try {
        const jobRef = doc(db, 'users', user.uid, 'jobs', lastJobId);
        await updateDoc(jobRef, {
          status: 'Applied',
          appliedDate: Date.now(),
          updatedAt: serverTimestamp()
        });
        showToast("Job status updated to Applied in Tracker", "success");
      } catch (e) {
        console.error("Failed to update job status in Firestore", e);
      }
    } else {
      try {
        const savedJobs = localStorage.getItem('ai_job_tracker');
        if (savedJobs) {
          const jobs = JSON.parse(savedJobs);
          const updatedJobs = jobs.map((j: any) => 
            j.id === lastJobId ? { ...j, status: 'Applied', appliedDate: Date.now() } : j
          );
          localStorage.setItem('ai_job_tracker', JSON.stringify(updatedJobs));
          showToast("Job status updated to Applied in Tracker", "success");
        }
      } catch (e) {
        console.error("Failed to update job status in localStorage", e);
      }
    }
  };

  const downloadPDF = async () => {
    const element = document.getElementById('resume-container');
    if (!element) return;

    // Save version automatically
    saveResumeVersion();

    // Sync to Job Tracker as Applied
    syncJobTrackerApplied();


    // Temporarily clear active section for clean PDF
    const previousActiveSection = activeSection;
    formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: null });
    setIsDownloading(true);

    try {
      // Small delay to allow React to re-render without highlights
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const targetOuterHTML = element.outerHTML;

      // Show the loader UI overlay
      setOptimizationProgress(0);
      setOptimizationStatus("Compiling Final PDF Asset...");
      setIsOptimizing(true);

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = setInterval(() => {
        setOptimizationProgress(prev => {
           const next = prev + 5;
           if (next > 30 && prev <= 30) setOptimizationStatus("Configuring Print Scaling...");
           if (next > 60 && prev <= 60) setOptimizationStatus("Rendering PDF Document...");
           if (next > 85 && prev <= 85) setOptimizationStatus("Finalizing PDF Download...");
           return Math.min(95, next);
        });
      }, 500);

      // Extract all styles from the document to ensure the PDF matches the preview
      const styles = Array.from(document.styleSheets)
        .map((styleSheet) => {
          try {
            return Array.from(styleSheet.cssRules)
              .map((rule) => rule.cssText)
              .join("");
          } catch (e) {
            // Handle cross-origin stylesheets (like Google Fonts)
            return "";
          }
        })
        .join("\n");

      // Get all styles and imports
      const allStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(el => {
          if (el.tagName === 'STYLE') {
            return el.innerHTML;
          } else if (el.tagName === 'LINK') {
            // For link tags, we can't easily get the content, but we can try to include the import if it's a font
            const href = (el as HTMLLinkElement).href;
            if (href.includes('fonts.googleapis.com')) {
              return `@import url('${href}');`;
            }
          }
          return '';
        })
        .join('\n');

      const scaleCSS = `
        #resume-container {
          transform: scale(${printScale}) !important;
          transform-origin: top left !important;
          width: calc(100% / ${printScale}) !important;
        }
      `;

      const role = targetRole || 'Resume';
      const companyStr = companyName ? `-${companyName}` : '';
      const driveFileName = `${role}${companyStr}-Harnish Jariwala.pdf`;
      const downloadFileName = `${role}-Harnish Jariwala.pdf`;
      const pdfTitle = driveFileName.replace('.pdf', '');

      const sessionResponse = await fetch('/api/pdf-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html: targetOuterHTML,
          css: allStyles + '\n' + scaleCSS,
          title: pdfTitle,
          fonts: customFonts.map(font => `
            @font-face {
              font-family: '${font.name}';
              src: url('${font.url}') format('${font.format}');
            }
          `).join('\n')
        }),
      });

      if (!sessionResponse.ok) {
        const contentType = sessionResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await sessionResponse.json();
          throw new Error(errorData.error || 'Failed to create PDF session');
        } else {
          throw new Error('Failed to create PDF session (Server Error)');
        }
      }

      const { sessionId } = await sessionResponse.json();
      
      const downloadUrl = `/api/download-pdf/${sessionId}`;
      const pdfResponse = await fetch(downloadUrl);
      
      if (!pdfResponse.ok) {
        const errText = await pdfResponse.text();
        throw new Error(`Failed to download PDF: ${errText}`);
      }
      
      const contentType = pdfResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/pdf')) {
        throw new Error('Server did not return a valid PDF file.');
      }
      
      const blob = await pdfResponse.blob();

      // Convert blob to base64 for Drive saving
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];
        
        // Save to Google Drive
        try {
          const driveSaveResponse = await fetch('/api/save-to-drive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pdfData: base64data,
              fileName: driveFileName,
              versioningEnabled: versioningEnabled,
              accessToken: driveAccessToken,
              parentFolderId: selectedDriveFolder?.id
            })
          });
          
          if (driveSaveResponse.ok) {
            showToast('Resume saved to Google Drive!', 'success');
          } else {
            const driveError = await driveSaveResponse.json();
            console.error('Drive save error:', driveError);
            
            if (driveError.error && driveError.error.includes('AUTH_EXPIRED')) {
              setDriveAccessToken(null);
            }

            // Only show error if it's not just a missing env var (which is expected until configured)
            if (driveError.error && !driveError.error.includes("GOOGLE_SERVICE_ACCOUNT_KEY")) {
              showToast('Failed to save to Google Drive', 'error');
            }
          }
        } catch (driveErr) {
          console.error('Drive save fetch error:', driveErr);
        }
      };

      // Trigger download
      saveAs(blob, downloadFileName);
      showToast('PDF Downloaded successfully!', 'success');

    } catch (err: any) {
      console.error('PDF Generation Error:', err);
      showToast(err.message || 'Failed to generate PDF. Please try again.', 'error');
    } finally {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setOptimizationProgress(100);
      setOptimizationStatus("PDF Generated Successfully!");
      
      setTimeout(() => {
        setIsOptimizing(false);
        // Restore active section
        if (previousActiveSection) {
          formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: previousActiveSection });
        }
        setIsDownloading(false);
      }, 1500);
    }
  };

  const handleDownloadDOCX = async () => {
    const res = results[activeAudience!] || data;
    await downloadDOCX(res, targetRole, companyName, showToast);
    
    // Sync to Job Tracker as Applied
    syncJobTrackerApplied();
  };

  const handleOpenResultWorkspace = (artifact: any) => {
    setResults(artifact.results);
    setActiveAudience(artifact.activeAudience);
    setTargetRole(artifact.targetRole);
    setCompanyName(artifact.targetCompany);
    setJobDescription(artifact.jobDescription);
    if (artifact.customPrompt) setCustomPrompt(artifact.customPrompt);
    
    setCurrentResultWorkspaceArtifact(artifact);
    setShowResultWorkspace(true);
    navigate('/build');
  };

  const handleDownloadPDFForArtifact = async (artifact: any) => {
    setResults(artifact.results);
    setActiveAudience(artifact.activeAudience);
    setTargetRole(artifact.targetRole);
    setCompanyName(artifact.targetCompany);
    setJobDescription(artifact.jobDescription);
    
    showToast("Preparing PDF compiling pipeline...", "info");
    setTimeout(() => {
      downloadPDF();
    }, 500);
  };

  const handleDownloadDOCXForArtifact = (artifact: any) => {
    const activeAud = artifact.activeAudience || Object.keys(artifact.results)[0];
    const resultsData = artifact.results[activeAud];
    if (resultsData) {
      downloadDOCX(resultsData, artifact.targetRole, artifact.targetCompany, showToast);
      syncJobTrackerApplied();
    } else {
      showToast("No optimization data found inside this artifact", "error");
    }
  };

  const handleDownloadJSONForArtifact = (artifact: any) => {
    const activeAud = artifact.activeAudience || Object.keys(artifact.results)[0];
    const resultsData = artifact.results[activeAud];
    if (resultsData) {
      downloadJSON(resultsData, artifact.targetRole, artifact.targetCompany, showToast);
    } else {
      showToast("No optimization data found", "error");
    }
  };

  const handleSaveToDriveForArtifact = async (artifact: any) => {
    setResults(artifact.results);
    setActiveAudience(artifact.activeAudience);
    setTargetRole(artifact.targetRole);
    setCompanyName(artifact.targetCompany);
    setJobDescription(artifact.jobDescription);
    
    showToast("Synching compiled PDF artifact to Google Drive...", "info");
    setTimeout(() => {
      downloadPDF();
    }, 500);
  };

  const handleOpenOptimizationInSession = (artifact: any) => {
    setResults(artifact.results);
    setActiveAudience(artifact.activeAudience);
    setTargetRole(artifact.targetRole);
    setCompanyName(artifact.targetCompany);
    setJobDescription(artifact.jobDescription);
    if (artifact.customPrompt) setCustomPrompt(artifact.customPrompt);
    
    showToast(`Loaded Optimization for ${artifact.targetCompany}`, "success");
    setShowResultWorkspace(false);
    setCurrentResultWorkspaceArtifact(null);
    navigate('/build');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const clearInputs = () => {
    setJobDescription('');
    setTargetRole('');
    setTargetCompany('none');
    setBrainDump('');
    setCompanyName('');
    setJobUrl('');
    setResults({});
    setActiveAudience(null);
    setSuitabilityResult(null);
    setOptimizationProgress(0);
    setSelectedAudiences(['microsoft']);
    
    // Clear the backend cache
    fetch('/api/cache/clear', { method: 'POST' }).catch(err => console.error("Failed to clear backend cache", err));
    
    showToast("Job details and cache cleared.", "info");
  };

  const renderSimplifiedResume = () => {
    const res = results[activeAudience!] || data;
    if (!res) return null;

    return (
      <div className="bg-white text-black leading-tight max-w-[210mm] min-w-[210mm] min-h-[297mm] mx-auto shadow-sm" style={{ padding: '25mm', fontFamily: '"Calibri", "Open Sans", sans-serif' }}>
        {/* Header */}
        <div className="text-center mb-5 border-b border-black pb-2">
          <h1 className="font-bold uppercase mb-0.5 tracking-[0.1em]" style={{ fontSize: '18pt' }}>{res.personal_info?.name || ''}</h1>
          <p className="font-medium tracking-wide" style={{ fontSize: '10.5pt' }}>
            {res.personal_info?.location || ''} | {res.personal_info?.email || ''} | {res.personal_info?.phone || ''} | {res.personal_info?.linkedin || ''}
          </p>
        </div>

        {/* Summary */}
        <div className="mb-4">
          <h2 className="font-bold border-b border-black mb-1 uppercase tracking-[0.05em]" style={{ fontSize: '13pt' }}>Summary</h2>
          <p className="leading-normal text-justify" style={{ fontSize: '10.5pt' }}>{(res as any).summary || (res as any).personal_info?.summary || ""}</p>
          <div style={{ height: '1.25em' }} /> {/* Skip one line after summary has been completed */}
        </div>

        {/* Skills */}
        <div className="mb-4">
          <h2 className="font-bold border-b border-black mb-1 uppercase tracking-[0.05em]" style={{ fontSize: '13pt' }}>Skills</h2>
          <div className="leading-normal" style={{ fontSize: '10.5pt' }}>
            {Array.isArray(res.skills) 
              ? res.skills.join(", ") 
              : Object.entries(res.skills).map(([cat, skills]) => (
                  <div key={cat} className="flex">
                    <span className="font-bold mr-2">{cat}:</span>
                    <span>{(skills as string[]).join(", ")}</span>
                  </div>
                ))}
          </div>
        </div>

        {/* Experience */}
        <div className="mb-4">
          <h2 className="font-bold border-b border-black mb-1 uppercase tracking-[0.05em]" style={{ fontSize: '13pt' }}>Experience</h2>
          {Array.isArray(res.experience) && res.experience.map((exp: any, i: number) => (
            <div key={i} className="mb-3">
              <div className="flex justify-between font-bold" style={{ fontSize: '11.5pt' }}>
                <span>{exp.role}</span>
                <span className="font-medium">{exp.duration}</span>
              </div>
              <div className="font-bold mb-0.5" style={{ fontSize: '11pt' }}>{exp.company}</div>
              <div className="space-y-0.5">
                {Array.isArray(exp.bullets) && exp.bullets.map((bullet: string, bi: number) => (
                  <div key={bi} className="flex gap-2">
                    <span className="shrink-0 text-[10.5pt]">•</span>
                    <span className="leading-normal" style={{ fontSize: '10.5pt' }}>{bullet}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Projects */}
        {Array.isArray(res.projects) && res.projects.length > 0 && (
          <div className="mb-3">
            <h2 className="font-bold border-b border-black/10 mb-1 uppercase tracking-[0.05em]" style={{ fontSize: '13pt' }}>Projects</h2>
            {res.projects.map((proj: any, i: number) => (
              <div key={i} className="mb-1.5">
                <div className="font-bold" style={{ fontSize: '11.5' }}>{typeof proj === 'string' ? proj : proj.title}</div>
                {typeof proj !== 'string' && proj.description && (
                  <div className="flex gap-2">
                    <span className="shrink-0 text-[10.5pt]">•</span>
                    <span className="leading-normal" style={{ fontSize: '10.5pt' }}>{proj.description}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Certifications */}
        {Array.isArray(res.certifications) && res.certifications.length > 0 && (
          <div className="mb-3">
            <h2 className="font-bold border-b border-black/10 mb-1 uppercase tracking-[0.05em]" style={{ fontSize: '13pt' }}>Certifications</h2>
            <div className="space-y-0.5">
              {res.certifications.map((cert: any, i: number) => (
                <div key={i} className="text-[10.5pt]">
                  • {typeof cert === 'string' ? cert : `${cert.name}`}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Education */}
        {Array.isArray(res.education) && res.education.length > 0 && (
          <div className="mb-3">
            <h2 className="font-bold border-b border-black/10 mb-1 uppercase tracking-[0.05em]" style={{ fontSize: '13pt' }}>Education</h2>
            <div className="space-y-0.5">
              {res.education.map((edu: any, i: number) => (
                <div key={i} className="text-[10.5pt] font-medium">
                  • {typeof edu === 'string' ? edu : `${edu.degree} - ${edu.institution} (Expected : ${edu.expected_completion})`}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSection = (
    sectionId: string, 
    customExp?: any[], 
    isContinuation?: boolean,
    customProj?: any[],
    customEdu?: any[]
  ) => {
    switch (sectionId) {
      case 'header':
        const personalInfo = {
          ...(results[activeAudience!]?.personal_info as any || {}),
          name: profileName || results[activeAudience!]?.personal_info?.name || data.personal_info?.name || '',
          location: isPiiMasked ? '[REDACTED LOCATION]' : (profileLocation || results[activeAudience!]?.personal_info?.location || data.personal_info?.location || ''),
          email: isPiiMasked ? '[REDACTED EMAIL]' : (profileEmail || results[activeAudience!]?.personal_info?.email || data.personal_info?.email || ''),
          phone: isPiiMasked ? '[REDACTED PHONE]' : (profilePhone || results[activeAudience!]?.personal_info?.phone || data.personal_info?.phone || ''),
          linkedin: profileLinkedIn || results[activeAudience!]?.personal_info?.linkedin || data.personal_info?.linkedin || '',
          linkedinText: profileLinkedInText || results[activeAudience!]?.personal_info?.linkedinText || '',
          summary: results[activeAudience!]?.summary || data.personal_info?.summary || ''
        } as any;
        return (
          <div 
            key="header"
            onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'header' })}
            className={`cursor-pointer transition-all rounded p-2 mb-2 resume-section ${activeSection === 'header' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
            style={{ 
              fontFamily: getSectionStyle('header').fontFamily, 
              textAlign: 'center',
              lineHeight: getSectionStyle('header').lineHeight,
              color: getSectionStyle('header').color,
              letterSpacing: `${getSectionStyle('header').letterSpacing}em`,
              padding: `${getSectionStyle('header').padding}px`,
              marginBottom: `${getSectionStyle('header').margin}px`,
            }}
          >
            <h1 className="font-bold uppercase tracking-[0.1em] mb-1" style={{ fontSize: '18pt' }}>
              {personalInfo.name}
            </h1>
            <div className="font-medium border-t border-black/10 pt-2 flex justify-center items-center gap-x-4 gap-y-1 flex-wrap" style={{ fontSize: '10.5pt', lineHeight: '1.2' }}>
              <span className="whitespace-nowrap">{personalInfo.location}</span>
              <span className="opacity-30"></span>
              <span className="whitespace-nowrap">{personalInfo.email}</span>
              <span className="opacity-30"></span>
              <span className="whitespace-nowrap">{personalInfo.phone}</span>
              {personalInfo.linkedin && (
                <>
                  <span className="opacity-30"></span>
                  <span className="whitespace-nowrap">LinkedIn: {personalInfo.linkedinText || personalInfo.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '')}</span>
                </>
              )}
            </div>
          </div>
        );
      case 'summary':
        return (
          <div 
            key="summary"
            onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'summary' })}
            className={`mb-2 cursor-pointer transition-all rounded p-2 resume-section ${activeSection === 'summary' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
            style={{ 
              fontFamily: getSectionStyle('summary').fontFamily, 
              textAlign: 'justify',
              lineHeight: getSectionStyle('summary').lineHeight,
              color: getSectionStyle('summary').color,
              letterSpacing: `${getSectionStyle('summary').letterSpacing}em`,
              padding: `${getSectionStyle('summary').padding}px`,
              marginBottom: `${getSectionStyle('summary').margin}px`,
              fontSize: `${getSectionStyle('summary').fontSize}px`,
            }}
          >
            <h2 className="font-bold mb-1 uppercase tracking-[0.05em] border-b border-black/10 pb-0.5" style={{ fontSize: '13pt' }}>
              Summary
            </h2>
            <p className="leading-normal" style={{ fontSize: '10.5pt' }}>{results[activeAudience!]?.summary || data.personal_info.summary}</p>
            <div style={{ height: '1.25em' }} /> {/* Skip one line after summary has been completed */}
          </div>
        );
      case 'skills':
        return (
          <div 
            key="skills"
            onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'skills' })}
            className={`mb-2 cursor-pointer transition-all rounded p-2 resume-section ${activeSection === 'skills' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
            style={{ 
              fontFamily: getSectionStyle('skills').fontFamily, 
              lineHeight: getSectionStyle('skills').lineHeight,
              color: getSectionStyle('skills').color,
              letterSpacing: `${getSectionStyle('skills').letterSpacing}em`,
              padding: `${Math.max(4, getSectionStyle('skills').padding / 2)}px`,
              marginBottom: `${Math.max(4, getSectionStyle('skills').margin / 2)}px`,
              fontSize: `${getSectionStyle('skills').fontSize}px`,
            }}
          >
            <h2 className="font-bold mb-1 uppercase tracking-[0.05em] border-b border-black/10 pb-0.5" style={{ fontSize: '13pt' }}>
              Skills
            </h2>
            {results[activeAudience!]?.skills && !Array.isArray(results[activeAudience!].skills) ? (
              <div className="grid grid-cols-1 gap-y-1">
                {Object.entries(results[activeAudience!].skills).map(([category, items]) => (
                  <div key={category} className="grid grid-cols-[160px_1fr] gap-2 text-[10.5pt] leading-tight">
                    <span className="font-bold">{category}:</span>
                    <span className="">{(items as unknown as string[]).join(', ')}</span>
                  </div>
                ))}
              </div>
            ) : typeof data.skills === 'object' && !Array.isArray(data.skills) ? (
              <div className="grid grid-cols-1 gap-y-1">
                {Object.entries(data.skills as any).map(([category, items]) => (
                  <div key={category} className="grid grid-cols-[160px_1fr] gap-2 text-[10.5pt] leading-tight">
                    <span className="font-bold">{category}:</span>
                    <span className="">{(items as unknown as string[]).join(', ')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[10.5pt] leading-normal">
                {((
                  activeAudience && results[activeAudience]?.skills 
                    ? (Array.isArray(results[activeAudience].skills) 
                        ? results[activeAudience].skills 
                        : Object.values(results[activeAudience].skills).flat())
                    : data.skills
                ) as string[]).join(', ')}
              </div>
            )}
          </div>
        );
      case 'certifications':
        return (
          <div 
            key="certifications"
            onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'certifications' })}
            className={`mb-2 cursor-pointer transition-all rounded p-2 resume-section ${activeSection === 'certifications' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
            style={{ 
              fontFamily: getSectionStyle('certifications').fontFamily, 
              lineHeight: getSectionStyle('certifications').lineHeight,
              color: getSectionStyle('certifications').color,
              letterSpacing: `${getSectionStyle('certifications').letterSpacing}em`,
              padding: `${getSectionStyle('certifications').padding}px`,
              marginBottom: `${getSectionStyle('certifications').margin}px`,
              fontSize: `${getSectionStyle('certifications').fontSize}px`,
            }}
          >
            <h2 className="font-bold mb-1 uppercase tracking-[0.05em] border-b border-black/10 pb-0.5" style={{ fontSize: '13pt' }}>
              Certifications
            </h2>
            <div className="grid grid-cols-1 gap-0.5">
              {(results[activeAudience!]?.certifications || data.certifications || []).map((cert: any, i) => (
                <div key={i} className="text-[10.5pt]">
                  • {typeof cert === 'string' ? cert : cert.name}
                </div>
              ))}
            </div>
          </div>
        );
      case 'experience':
        const allExp = customExp || results[activeAudience!]?.experience || data.experience;
        if (!Array.isArray(allExp) || allExp.length === 0) return null;
        return (
          <div 
            key={isContinuation ? "experience-split-2" : "experience"}
            onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'experience' })}
            className={`cursor-pointer transition-all rounded p-2 mb-2 resume-section ${activeSection === 'experience' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
            style={{ 
              fontFamily: getSectionStyle('experience').fontFamily, 
              lineHeight: getSectionStyle('experience').lineHeight,
              color: getSectionStyle('experience').color,
              letterSpacing: `${getSectionStyle('experience').letterSpacing}em`,
              padding: `${getSectionStyle('experience').padding}px`,
              marginBottom: `${getSectionStyle('experience').margin}px`,
              fontSize: `${getSectionStyle('experience').fontSize}px`,
            }}
          >
            {!isContinuation && (
              <h2 className="font-bold mb-1 uppercase tracking-[0.05em] border-b border-black/10 pb-0.5" style={{ fontSize: '13pt' }}>
                Experience
              </h2>
            )}
            {allExp.map((exp: any, i: number) => (
              <div key={i} className="experience-item mb-2 last:mb-0">
                <div className="flex justify-between font-bold items-baseline mb-0">
                  <span style={{ fontSize: '11.5pt' }}>{exp.role}</span>
                  <span className="font-medium" style={{ fontSize: '11pt' }}>{exp.duration}</span>
                </div>
                <div className="font-bold mb-1" style={{ fontSize: '11.5pt' }}>{exp.company}</div>
                <ul className="space-y-0.5 list-none p-0 m-0">
                  {Array.isArray(exp.bullets) && exp.bullets.map((b: string, bi: number) => (
                    <li key={bi} className="flex gap-2">
                      <span className="shrink-0">•</span>
                      <span className="leading-normal" style={{ fontSize: '10.5pt' }}>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        );
      case 'projects':
        const allProjects = customProj || (
          (Array.isArray(results[activeAudience!]?.projects) && results[activeAudience!]?.projects.length > 0) 
            ? results[activeAudience!]?.projects 
            : data.projects
        );
        if (!Array.isArray(allProjects) || allProjects.length === 0) return null;
        return (
          <div 
            key="projects"
            onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'projects' })}
            className={`mb-2 cursor-pointer transition-all rounded p-2 resume-section ${activeSection === 'projects' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
            style={{ 
              fontFamily: getSectionStyle('projects').fontFamily, 
              lineHeight: getSectionStyle('projects').lineHeight,
              color: getSectionStyle('projects').color,
              letterSpacing: `${getSectionStyle('projects').letterSpacing}em`,
              padding: `${getSectionStyle('projects').padding}px`,
              marginBottom: `${getSectionStyle('projects').margin}px`,
              fontSize: `${getSectionStyle('projects').fontSize}px`,
            }}
          >
            <h2 className="font-bold mb-1 uppercase tracking-[0.05em] border-b border-black/10 pb-0.5" style={{ fontSize: '13pt' }}>
              Projects
            </h2>
            <div className="space-y-1.5">
              {allProjects.map((proj: any, i: number) => (
                <div key={i} className="project-item mb-1 last:mb-0">
                  <div className="font-bold mb-0" style={{ fontSize: '11.5pt' }}>
                    {typeof proj === 'string' ? proj : (proj as any).title}
                  </div>
                  {typeof proj !== 'string' && (proj as any).description && (
                    <div className="flex gap-2">
                      <span className="shrink-0">•</span>
                      <span className="leading-normal" style={{ fontSize: '10.5pt' }}>
                        {(proj as any).description}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      case 'education':
        const allEdu = customEdu || (
          (Array.isArray(results[activeAudience!]?.education) && results[activeAudience!]?.education.length > 0) 
            ? results[activeAudience!]?.education 
            : data.education || []
        );
        if (!Array.isArray(allEdu) || allEdu.length === 0) return null;
        return (
          <div 
            key="education"
            onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'education' })}
            className={`mb-2 cursor-pointer transition-all rounded p-2 resume-section ${activeSection === 'education' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
            style={{ 
              fontFamily: getSectionStyle('education').fontFamily, 
              lineHeight: getSectionStyle('education').lineHeight,
              color: getSectionStyle('education').color,
              letterSpacing: `${getSectionStyle('education').letterSpacing}em`,
              padding: `${getSectionStyle('education').padding}px`,
              marginBottom: `${getSectionStyle('education').margin}px`,
              fontSize: `${getSectionStyle('education').fontSize}px`,
            }}
          >
            <h2 className="font-bold mb-1 uppercase tracking-[0.05em] border-b border-black/10 pb-0.5" style={{ fontSize: '13pt' }}>
              Education
            </h2>
            {allEdu.map((edu: any, i: number) => (
              <div key={i} className="mb-0.5 last:mb-0" style={{ pageBreakInside: 'avoid' }}>
                <div className="text-[10.5pt] font-medium">
                  • {typeof edu === 'string' 
                    ? edu 
                    : (edu.degree || edu.institution)
                      ? `${edu.degree || 'Degree'} - ${edu.institution || 'Institution'}${edu.expected_completion ? ` (Expected : ${edu.expected_completion})` : ''}`
                      : JSON.stringify(edu)
                  }
                </div>
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  if (showAdminDashboard) {
    return <AdminDashboard onBack={() => setShowAdminDashboard(false)} isDarkMode={isDarkMode} />;
  }

  if (!isAuthReady) {
    return (
      <div className={`h-screen flex flex-col items-center justify-center ${isDarkMode ? 'bg-neutral-950 text-white' : 'bg-neutral-50 text-neutral-900'}`}>
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-bold tracking-tighter opacity-50 uppercase">Securing Nexus AI...</h2>
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={
        <div 
          className={`h-screen flex flex-col items-center justify-center ${isDarkMode ? 'text-white' : 'text-neutral-900'} relative`}
          style={{ backgroundImage: 'var(--glass-bg-image)', backgroundSize: 'cover', backgroundPosition: 'center' }}
        >
          <div className="absolute inset-0 bg-black/20 pointer-events-none" />
          <div className="liquid-container z-0 opacity-30">
            <div className="liquid-blob w-[110vw] h-[110vh] bg-blue-500/20 -top-1/2 -left-1/4" />
          </div>
          <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
          <h2 className="text-xl font-bold tracking-tighter opacity-50 uppercase">Loading Welcome Suite...</h2>
        </div>
      }>
        <ProfessionalWelcomePage 
          onLogin={handleGoogleLogin} 
          onEmailLogin={handleEmailLogin}
          onEmailSignUp={handleEmailSignUp}
          onPasswordReset={handlePasswordReset}
          externalError={error}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
        />
      </Suspense>
    );
  }

  return (
    <DashboardShell
      isDarkMode={isDarkMode}
      header={
        <DashboardHeader
          user={user}
          onAuthTrigger={() => setIsAuthModalOpen(true)}
          onLogout={handleLogout}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          onCommandPaletteOpen={() => setIsCommandPaletteOpen(true)}
          geminiApiKey={geminiApiKey || ""}
          openaiApiKey={openaiApiKey || ""}
          encryptedApiKey={encryptedApiKey || ""}
          isFetchingKeys={isFetchingKeys}
          onSyncKeys={() => fetchKeysFromFirebase(true)}
        />
      }
      navigationRail={
        <NavigationRail
          activeTab={activeTab}
          isDarkMode={isDarkMode}
        />
      }
      footer={
        <StatusFooter
          isDarkMode={isDarkMode}
          syncStatus={isSyncing ? 'syncing' : 'synced'}
          currentEngine={mode}
          isDriveConnected={isDriveConnected}
          isExporting={isDownloading}
          exportType="pdf"
          activeAudience={activeAudience}
          optimizationProgress={isOptimizing ? Math.round(optimizationProgress) : 100}
        />
      }
    >
      <div 
        className="w-full h-full relative overflow-hidden"
        style={{ backgroundImage: 'var(--glass-bg-image)', backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div className={`absolute inset-0 transition-colors duration-1000 ${user ? 'bg-black/40' : 'bg-black/10 dark:bg-black/30'} pointer-events-none -z-10`} />
        <div className="workspace-overlay -z-5" />
        <GeminiOmniAurora />
        <AINeuralNetworkBackground isDarkMode={isDarkMode} opacity={0.25} />
        {activeTheme.id === 'infogeneus' && (
          <>
            <GeminiAurora />
            <DataStream />
            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/5 via-transparent to-indigo-500/5 pointer-events-none z-[-1]" />
          </>
        )}
        <div className="liquid-container z-10 opacity-30">
          <div className="liquid-blob w-[110vw] h-[110vh] -top-1/2 -left-1/4" style={{ animationDelay: '-2s' }} />
          <div className="liquid-blob liquid-blob-secondary w-[80vw] h-[80vh] top-1/2 right-1/4" style={{ animationDelay: '-5s' }} />
          <div className="liquid-blob w-[90vw] h-[90vh] top-1/2 -right-1/4" style={{ animationDelay: '-12s' }} />
          <div className="liquid-blob liquid-blob-secondary w-[100vw] h-[100vh] -bottom-1/4 left-1/3" style={{ animationDelay: '-18s' }} />
        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        
        {/* Futuristic Premium FAANG-Level AI Scanning Animation Overlay */}
        <AIOptimizationOverlay
          isOptimizing={isOptimizing}
          onStop={handleStop}
          progress={optimizationProgress}
          statusText={optimizationStatus}
          targetRole={targetRole}
          targetCompany={companyName}
        />
        <DriveFolderPicker 
            isOpen={isSelectingFolder}
            onClose={() => setIsSelectingFolder(false)}
            onSelect={(folder) => {
              setSelectedDriveFolder(folder);
              setIsSelectingFolder(false);
              showToast(`Target folder set to: ${folder.name}`, 'success');
            }}
            accessToken={driveAccessToken}
            isDarkMode={isDarkMode}
          />
          {confirmDialog && (
            <ConfirmDialog 
              message={confirmDialog.message} 
              onConfirm={confirmDialog.onConfirm} 
              onCancel={confirmDialog.onCancel} 
              isDarkMode={isDarkMode} 
            />
          )}

          {/* Main Workspace Area with Feature 2 overlay condition */}
          {showResultWorkspace && activeTab === 'build' ? (
            <OptimizationResultWorkspace
              isDarkMode={isDarkMode}
              artifact={currentResultWorkspaceArtifact}
              activeAudience={activeAudience}
              results={results}
              previewMode={previewMode}
              setPreviewMode={setPreviewMode}
              onClose={() => {
                setShowResultWorkspace(false);
                setCurrentResultWorkspaceArtifact(null);
                setZoom(0.85); // Reset to optimal workspace zoom
              }}
              onDownloadPDF={() => {
                if (currentResultWorkspaceArtifact) {
                  handleDownloadPDFForArtifact(currentResultWorkspaceArtifact);
                } else {
                  downloadPDF();
                }
              }}
              onDownloadDOCX={() => {
                if (currentResultWorkspaceArtifact) {
                  handleDownloadDOCXForArtifact(currentResultWorkspaceArtifact);
                } else {
                  handleDownloadDOCX();
                }
              }}
              onDownloadJSON={() => {
                if (currentResultWorkspaceArtifact) {
                  handleDownloadJSONForArtifact(currentResultWorkspaceArtifact);
                } else {
                  downloadJSON(activeAudience ? results[activeAudience] : data, targetRole, companyName, showToast);
                }
              }}
              onSaveToDrive={() => {
                if (currentResultWorkspaceArtifact) {
                  handleSaveToDriveForArtifact(currentResultWorkspaceArtifact);
                } else {
                  downloadPDF();
                }
              }}
              onOpenResumeBuilder={() => {
                setShowResultWorkspace(false);
                setCurrentResultWorkspaceArtifact(null);
                setIsFocusMode(true);
                showToast("Resume Builder inline editing mode active.", "info");
              }}
            >
              {/* Section 4 Preview Window Re-integration */}
              <div 
                className="mx-auto relative overflow-hidden bg-white text-black p-4 rounded-xl shadow-2xl"
                style={{
                  width: `${794 * zoom}px`, // Approx width of A4 210mm
                  height: `${contentHeight * zoom}px`,
                  transition: 'width 0.3s ease, height 0.3s ease'
                }}
              >
                <div 
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                    width: 'max-content'
                  }}
                >
                  <div 
                    id="resume-container"
                    className={`transition-all duration-300 relative ${activeSection ? 'ring-2 ring-emerald-500/20' : ''} ${isDownloading ? 'legacy-colors' : 'shadow-2xl'}`}
                  >
                    {previewMode === 'standard' ? (
                      <div className="resume-page" style={{ paddingBottom: isDownloading ? '0' : '2rem' }}>
                        {renderSection('header')}
                        {renderSection('summary')}
                        {renderSection('skills')}
                        {renderSection('certifications')}
                        {renderSection('experience', (currentResultWorkspaceArtifact?.activeAudience ? currentResultWorkspaceArtifact.results[currentResultWorkspaceArtifact.activeAudience]?.experience : results[activeAudience!]?.experience) || data.experience)}
                        {renderSection(
                          'projects', 
                          undefined, 
                          false, 
                          (currentResultWorkspaceArtifact?.activeAudience ? currentResultWorkspaceArtifact.results[currentResultWorkspaceArtifact.activeAudience]?.projects : results[activeAudience!]?.projects) || data.projects
                        )}
                        {renderSection(
                          'education', 
                          undefined, 
                          false, 
                          undefined, 
                          (currentResultWorkspaceArtifact?.activeAudience ? currentResultWorkspaceArtifact.results[currentResultWorkspaceArtifact.activeAudience]?.education : results[activeAudience!]?.education) || data.education
                        )}
                      </div>
                    ) : (
                      renderSimplifiedResume()
                    )}
                  </div>
                </div>
              </div>
            </OptimizationResultWorkspace>
          ) : (
            <main className="flex-1 flex flex-col sm:flex-row overflow-hidden relative w-full h-full bg-transparent" ref={containerRef}>
              
              {/* Only show Config Pane if NOT on tools or dashboard */}
              {activeTab !== 'tools' && activeTab !== 'dashboard' && (
                <div 
                  ref={leftPanelRef}
                  className={`flex flex-col h-full relative transition-all duration-200 ease-in-out ${isDarkMode ? 'glass-panel' : 'glass-panel-light'} gemini-glow-panel z-10 w-full`}
                  style={{ 
                    width: '100%',
                    minWidth: '100%',
                    maxWidth: 'none'
                  }}
                >
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            <AnimatePresence mode="wait">
              {activeTab === 'build' && (
                <motion.div 
                  key="build-tab"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6 h-full flex flex-col"
                >
                  <AtsOptimizationStudio 
                      isDarkMode={isDarkMode}
                      targetRole={targetRole}
                      setTargetRole={setTargetRole}
                      companyName={companyName}
                      setCompanyName={setCompanyName}
                      targetCompany={targetCompany}
                      setTargetCompany={setTargetCompany}
                      jobUrl={jobUrl}
                      setJobUrl={setJobUrl}
                      jobDescription={jobDescription}
                      setJobDescription={setJobDescription}
                      resumeText={resumeText}
                      clearInputs={clearInputs}
                      selectedAudiences={selectedAudiences}
                      setSelectedAudiences={setSelectedAudiences}
                      customAudience={customAudience}
                      setCustomAudience={setCustomAudience}
                      isAutoSelectingAudiences={isAutoSelectingAudiences}
                      handleAutoSelectAudiences={handleAutoSelectAudiences}
                      isAudienceDropdownOpen={isAudienceDropdownOpen}
                      setIsAudienceDropdownOpen={setIsAudienceDropdownOpen}
                      audienceDropdownRef={audienceDropdownRef}
                      toggleAudience={toggleAudience}
                      AUDIENCES={AUDIENCES}
                      customPrompt={customPrompt}
                      setCustomPrompt={setCustomPrompt}
                      isOptimizing={isOptimizing}
                      handleStop={handleStop}
                      isExtracting={isExtracting}
                      handleOptimize={handleOptimize}
                      optimizationProgress={optimizationProgress}
                      showOptimizeSuccess={showOptimizeSuccess}
                      tokenUsage={tokenUsage}
                      fetchTokenUsage={fetchTokenUsage}
                      isRefreshingTokens={isRefreshingTokens}
                      generateTokenReport={generateTokenReport}
                      isDownloading={isDownloading}
                      deepResearchReport={deepResearchReport}
                      setDeepResearchReport={setDeepResearchReport}
                      selectedEngine={selectedEngine}
                      setSelectedEngine={setSelectedEngine}
                      engineConfig={engineConfig}
                      setEngineConfig={setEngineConfig}
                      suitabilityResult={suitabilityResult}
                      setSuitabilityResult={setSuitabilityResult}
                      isCheckingSuitability={isCheckingSuitability}
                      handleCheckSuitability={handleCheckSuitability}
                      multiSuitabilityResults={multiSuitabilityResults}
                      masterResumes={masterResumes}
                      selectedResumeId={selectedResumeId}
                      recruiterSimulationMode={recruiterSimulationMode}
                      setRecruiterSimulationMode={setRecruiterSimulationMode}
                      fastMode={fastMode}
                      setFastMode={setFastMode}
                      mode={mode as any}
                      setMode={setMode as any}
                      showModeInfo={showModeInfo}
                      setShowModeInfo={setShowModeInfo}
                      results={results}
                      activeAudience={activeAudience}
                      usePremiumLoader={usePremiumLoader}
                      setUsePremiumLoader={setUsePremiumLoader}
                      isFetchingJob={isFetchingJob}
                      jdTextareaRef={jdTextareaRef}
                      isCompanyDropdownOpen={isCompanyDropdownOpen}
                      setIsCompanyDropdownOpen={setIsCompanyDropdownOpen}
                      companyDropdownRef={companyDropdownRef}
                      TARGET_COMPANIES={TARGET_COMPANIES}
                      MODE_DESCRIPTIONS={MODE_DESCRIPTIONS}
                      onOpenWorkspace={() => setShowResultWorkspace(true)}
                    />
                </motion.div>
              )}

                {activeTab === 'profile' && (
                <motion.div 
                  key="profile-tab"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <section className={`rounded-2xl border p-6 shadow-xl transition-colors ${isDarkMode ? 'glass-panel border-white/10' : 'glass-panel-light border-black/5'}`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <Users className={`w-5 h-5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                        <h2 className="font-semibold text-lg">Account Settings</h2>
                      </div>
                      <button 
                        onClick={user ? handleLogout : handleLogin}
                        className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-full transition-colors ${
                          isDarkMode 
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30' 
                            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200'
                        }`}
                      >
                        {user ? 'Logout' : 'Login'}
                      </button>
                    </div>
                    
                    {user ? (
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                          <p className="text-sm font-medium">Logged in as: {user.email}</p>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50">Gemini API Key</label>
                          <input 
                            type="password"
                            placeholder="Enter your Gemini API Key (Optional)"
                            value={geminiApiKey}
                            onChange={(e) => {
                              setGeminiApiKey(e.target.value);
                              setIsApiKeySaved(false);
                            }}
                            className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${
                              isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
                            }`}
                          />
                          <p className="mt-1 text-[9px] opacity-40 italic">Note: If left empty, the system-wide Gemini key will be used.</p>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50">OpenAI API Key</label>
                          <input 
                            type="password"
                            placeholder="Enter your OpenAI API Key (Optional)"
                            value={openaiApiKey}
                            onChange={(e) => {
                              setOpenaiApiKey(e.target.value);
                              setIsApiKeySaved(false);
                            }}
                            className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${
                              isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
                            }`}
                          />
                        </div>

                        <button
                          onClick={handleSaveProfile}
                          disabled={isSavingProfile}
                          className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                            isSavingProfile
                               ? 'bg-gray-400 text-white cursor-not-allowed'
                               : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                          }`}
                        >
                          {isSavingProfile ? 'Saving...' : 'Save API Settings'}
                        </button>

                        <div className="mt-8 pt-8 border-t border-white/10">
                          <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50">Master Resume Source</label>
                          <div className="flex gap-4 mb-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" value="local" checked={resumeSource === 'local'} onChange={(e) => setResumeSource(e.target.value as 'local')} className="text-emerald-500" />
                              <span className="text-xs">Local (Code)</span>
                            </label>
                            {user && <label className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" value="firestore" checked={resumeSource === 'firestore'} onChange={(e) => setResumeSource(e.target.value as 'firestore')} className="text-emerald-500" />
                              <span className="text-xs">Firestore</span>
                            </label>}
                          </div>
                          

                          {resumeSource === 'local' && user && (
                            <button
                                onClick={async () => {
                                    setIsSyncing(true);
                                    await setDoc(doc(db, 'users', user.uid), { masterResume: resumeText }, { merge: true });
                                    setIsSyncing(false);
                                    showToast("Synced to Firestore", "success");
                                }}
                                disabled={isSyncing}
                                className="w-full py-2 mb-4 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 text-xs font-bold uppercase tracking-widest"
                            >
                                {isSyncing ? "Syncing..." : "Sync Resume to Firestore"}
                            </button>
                          )}

                          <button
                              onClick={() => {
                                  setResumeText(JSON.stringify(defaultMasterResume, null, 2));
                                  showToast("Master resume reloaded from local file", "info");
                              }}
                              className="w-full py-2 mb-4 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 text-xs font-bold uppercase tracking-widest"
                          >
                              Reload Master Resume from Local
                          </button>

                          <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50">Upload Master Resume (PDF, JSON, TXT)</label>
                          <input 
                            type="file"
                            accept=".pdf,.json,.txt"
                            onChange={handleFileUpload}
                            className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${
                              isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
                            }`}
                          />
                          {fileName && (
                            <p className="mt-2 text-[10px] font-bold text-emerald-500 flex items-center gap-1.5 uppercase tracking-widest">
                              <FileText className="w-3 h-3" />
                              Active: {fileName}
                            </p>
                          )}
                          <label className="flex items-center gap-2 mt-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isResumePersistent}
                              onChange={(e) => setIsResumePersistent(e.target.checked)}
                              className="w-4 h-4 text-emerald-500 rounded border-black/10 focus:ring-emerald-500 focus:ring-offset-0 bg-transparent"
                            />
                            <span className="text-xs opacity-70">Save for all sessions</span>
                          </label>
                        </div>

                        <button
                          onClick={() => {
                            setConfirmDialog({
                              message: "Are you sure you want to clear your saved API keys?",
                              onConfirm: async () => {
                                if (!user) return;
                                setConfirmDialog(null);
                                setOpenaiApiKey('');
                                setEncryptedApiKey('');
                                setIsApiKeySaved(false);
                                // Also update Firestore
                                await setDoc(doc(db, 'users', user.uid), {
                                  userId: user.uid,
                                  encryptedApiKey: ''
                                }, { merge: true });
                                showToast("API keys cleared.", "success");
                              },
                              onCancel: () => setConfirmDialog(null)
                            });
                          }}
                          className="w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20"
                        >
                          Clear Saved API Keys
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-8 opacity-60">
                        <p>Please login to save your API key and master resume.</p>
                      </div>
                    )}
                  </section>

                  {/* Google Drive Status/Reconnect */}
                  {!driveAccessToken && user && (
                    <div className="mt-6 p-4 rounded-xl border border-dashed border-blue-500/30 bg-blue-500/5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-blue-500/20 text-blue-500">
                          <Cloud className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm">Cloud Backups</h3>
                          <p className="text-[10px] opacity-60">Save & version your PDFs to Google Drive</p>
                        </div>
                      </div>
                      <button
                        onClick={handleConnectDrive}
                        disabled={isAuthProcessing}
                        className="w-full py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                      >
                        {isAuthProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                        {isAuthProcessing ? "Connecting..." : "Connect Google Drive"}
                      </button>
                    </div>
                  )}

                  {/* Google Drive Backups - Now integrated as a vertical component in profile */}
                  {driveAccessToken && (
                    <div className={`mt-6 rounded-xl border overflow-hidden transition-all duration-300 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-black/5'}`}>
                      <div className="p-4 border-b border-black/5 dark:border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-500/20 text-blue-500">
                            <Cloud className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm">Cloud Backups</h3>
                            <p className="text-[10px] opacity-50">PDF Archive in Google Drive</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={fetchDriveFiles}
                            disabled={isFetchingDriveFiles}
                            className={`p-2 rounded-lg hover:bg-white/5 transition-colors ${isFetchingDriveFiles ? 'animate-spin opacity-50' : ''}`}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setIsSelectingFolder(true)}
                            className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 transition-colors"
                          >
                            Change Folder
                          </button>
                        </div>
                      </div>
                      <div className="px-4 py-2 text-[10px] opacity-60">
                        Current folder: {selectedDriveFolder?.name || 'Default (Root)'}
                      </div>
                      <div className="p-2 max-h-60 overflow-y-auto custom-scrollbar">
                        {isFetchingDriveFiles && driveFiles.length === 0 ? (
                          <div className="py-8 text-center opacity-40 text-[10px] uppercase tracking-widest">
                            Scanning cloud...
                          </div>
                        ) : driveFiles.length > 0 ? (
                          <div className="space-y-1">
                            {driveFiles.map((file) => (
                              <div 
                                key={file.id}
                                className={`p-2 rounded-lg flex items-center justify-between group transition-colors ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}
                              >
                                <div className="flex items-center gap-2 overflow-hidden flex-1">
                                  <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                  <p className="text-[11px] font-medium truncate">{file.name}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <a 
                                    href={file.webViewLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 px-2 rounded bg-white/5 text-[9px] font-bold uppercase hover:bg-emerald-500/20 transition-colors"
                                  >
                                    View
                                  </a>
                                  <button 
                                    onClick={() => handleDeleteDriveFile(file.id)}
                                    className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-8 text-center opacity-40 text-[10px] uppercase tracking-widest">
                            No cloud backups
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

        {/* Vertical Resize Handle (Left/Right) */}
          {!isFocusMode && activeTab !== 'tools' && activeTab !== 'dashboard' && activeTab !== 'build' && activeTab !== 'profile' && (
            <div 
              onMouseDown={handleMouseDownDivider}
              onDoubleClick={resetLayout}
              className={`hidden md:flex w-[3px] cursor-col-resize justify-center items-center group z-30 transition-colors hover:w-1.5 ${isResizingWidth ? 'bg-emerald-500 w-1.5' : 'hover:bg-emerald-500/30'}`}
            >
              <div className={`w-0.5 h-12 rounded-full transition-colors ${isResizingWidth ? 'bg-white' : 'bg-neutral-300 dark:bg-neutral-700 group-hover:bg-emerald-500'}`} />
            </div>
          )}

          {/* Result Section */}
          {(activeTab === 'tools' || activeTab === 'dashboard') && (
            <div className={`flex-1 min-w-0 flex flex-col h-full overflow-hidden border-l border-black/5 dark:border-white/10 shadow-2xl relative z-20 ${isDarkMode ? 'glass-panel' : 'glass-panel-light'} gemini-glow-panel ${isMobile ? (isFocusMode ? 'h-full flex-1' : 'h-1/2 sm:h-full') : 'flex'}`}>
            <AnimatePresence mode="wait">
              {activeTab === 'tools' ? (
                <motion.div 
                  key="tools-pane"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  className={`h-full flex flex-col p-4 md:p-8 overflow-y-auto custom-scrollbar rounded-3xl border border-dashed ${
                    isDarkMode ? 'glass-panel border-white/20' : 'glass-panel-light border-black/10'
                  }`}
                >
                  <div className="max-w-4xl w-full mx-auto">
                    {(!isCareerToolActive && !isAdditionalToolActive) && (
                      <div className="mb-6 px-4 py-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                        <h2 className="text-xl font-bold text-emerald-500 flex items-center gap-2">
                          <Zap className="w-5 h-5" /> Professional Career Tools
                        </h2>
                        <p className="text-sm opacity-70 mt-1">Enhance your application with AI-powered coaching, interview prep, and networking features.</p>
                      </div>
                    )}

                    {!isAdditionalToolActive && (
                      <CareerTools 
                        isDarkMode={isDarkMode} 
                        engineConfig={engineConfig} 
                        selectedEngine={selectedEngine as any} 
                        resumeData={activeAudience && results[activeAudience] ? results[activeAudience] : data}
                        jobDescription={jobDescription}
                        user={user}
                        onToolActive={setIsCareerToolActive}
                        linkedinProps={{
                          linkedInUrl,
                          setLinkedInUrl,
                          linkedInFileName,
                          setLinkedInFileName,
                          setLinkedInPdfText,
                          linkedInPdfText,
                          isDarkMode,
                          isExtracting: isExtractingLinkedIn,
                          setIsExtracting: setIsExtractingLinkedIn,
                          onImport: (text: string) => {
                            showToast("LinkedIn data loaded successfully!", "success");
                          }
                        }}
                      />
                    )}
                    
                    {!isCareerToolActive && (
                      <div className={`mt-8`}>
                        <AdditionalTools 
                          masterResumes={masterResumes}
                          setMasterResumes={setMasterResumes}
                          selectedResumeId={selectedResumeId}
                          setSelectedResumeId={setSelectedResumeId}
                          onSetActive={handleSetActiveResume}
                          onDuplicate={handleDuplicateResume}
                          resumeText={getEffectiveResumeText()}
                          jobDescription={jobDescription}
                          targetRole={targetRole}
                          companyName={companyName}
                          isDarkMode={isDarkMode}
                          engineConfig={engineConfig}
                          selectedEngine={selectedEngine as any}
                          onRestore={restoreVersion}
                          currentResults={results}
                          activeAudience={activeAudience}
                          selectedAudiences={selectedAudiences}
                          setResumeText={setResumeText}
                          runOptimization={handleOptimize}
                          currentHeadline={""}
                          resumeSummary={data?.personal_info?.summary || ""}
                          keySkills={typeof data?.skills === 'object' && !Array.isArray(data?.skills) ? Object.values(data.skills).flat() : (data?.skills as string[]) || []}
                          onToolActive={setIsAdditionalToolActive}
                          linkedinProps={{
                            linkedInUrl,
                            setLinkedInUrl,
                            linkedInFileName,
                            setLinkedInFileName,
                            setLinkedInPdfText,
                            linkedInPdfText,
                            isDarkMode,
                            isExtracting: isExtractingLinkedIn,
                            setIsExtracting: setIsExtractingLinkedIn,
                            onImport: (text: string) => {
                              showToast("LinkedIn data loaded successfully!", "success");
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : activeTab === 'dashboard' ? (
                <motion.div
                  key="dashboard-pane"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  className="h-full flex flex-col overflow-hidden"
                >
                  <DashboardHome 
                    isDarkMode={isDarkMode}
                    masterResumes={masterResumes}
                    selectedResumeId={selectedResumeId}
                    onSelectResume={handleSetActiveResume}
                    isSyncing={isSavingProfile}
                    isDownloading={isDownloading}
                    results={results}
                    activeAudience={activeAudience}
                    mode={((mode as any) === 'hybrid' ? 'hybrid' : ((mode as any) === 'editorial' ? 'openai' : 'gemini')) as any}
                    isDriveConnected={isDriveConnected}
                    user={user}
                    onOpenResultWorkspace={handleOpenResultWorkspace}
                    onDownloadPDF={handleDownloadPDFForArtifact}
                    onDownloadDOCX={handleDownloadDOCXForArtifact}
                    onDownloadJSON={handleDownloadJSONForArtifact}
                    onSaveToDrive={handleSaveToDriveForArtifact}
                    onOpenOptimization={handleOpenOptimizationInSession}
                  />
                </motion.div>
              ) : (Object.keys(results).length === 0 && !isOptimizing && activeTab !== 'build') ? (
                <motion.div 
                  key="empty-state"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  className={`h-full min-h-[500px] flex flex-col items-center justify-start text-center p-8 md:p-16 rounded-3xl border border-dashed relative overflow-y-auto custom-scrollbar ${
                    isDarkMode ? 'glass-panel border-white/20' : 'glass-panel-light border-black/10'
                  }`}
                >
                  {/* Background Accents */}
                  <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                    <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px]" />
                    <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px]" />
                  </div>

                  <div className="w-full max-w-4xl space-y-6 md:space-y-10 relative z-10 py-12 my-auto">
                    <div className="space-y-4 md:space-y-6">
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] md:text-xs font-bold uppercase tracking-widest border border-emerald-500/20">
                        <Zap className="w-3 h-3" />
                        AI-Powered Optimization
                      </div>
                      <h3 className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tight leading-[1.1] ${isDarkMode ? 'text-white' : 'text-black'}`}>
                        Transform Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500">Professional Identity</span>
                      </h3>
                      <p className="opacity-60 text-sm sm:text-base md:text-lg lg:text-xl max-w-2xl mx-auto leading-relaxed font-medium px-4">
                        Upload your resume and target a specific role. Our AI will craft a high-impact version tailored for ATS success.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="space-y-2 md:space-y-4 group text-center focus:outline-none"
                      >
                        <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-black/5'}`}>
                          <Upload className="w-6 h-6 md:w-8 md:h-8 text-emerald-500" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-[10px] md:text-sm uppercase tracking-widest">1. Input</h4>
                          <p className="text-[9px] md:text-xs opacity-40">Load your current experience</p>
                        </div>
                      </button>
                      <button 
                        onClick={() => {
                          jdTextareaRef.current?.focus();
                          jdTextareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className="space-y-2 md:space-y-4 group text-center focus:outline-none"
                      >
                        <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-black/5'}`}>
                          <Target className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-[10px] md:text-sm uppercase tracking-widest">2. Target</h4>
                          <p className="text-[9px] md:text-xs opacity-40">Define your dream role</p>
                        </div>
                      </button>
                      <button 
                        onClick={() => {
                          if (isOptimizing) {
                            handleStop();
                            return;
                          }
                          if (isExtracting) return;
                          handleOptimize();
                        }}
                        disabled={isExtracting}
                        className={`space-y-2 md:space-y-4 group text-center focus:outline-none ${isExtracting ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-black/5'}`}>
                          <Zap className="w-6 h-6 md:w-8 md:h-8 text-yellow-500" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-[10px] md:text-sm uppercase tracking-widest">3. Optimize</h4>
                          <p className="text-[9px] md:text-xs opacity-40">Get your ATS-ready resume</p>
                        </div>
                      </button>
                    </div>

                    <div className="pt-4 md:pt-8">
                      <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 opacity-30 grayscale hover:grayscale-0 transition-all duration-500">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">Hybrid Engine</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Layout className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">Smart Layout</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">ATS Scoring</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="preview"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6 h-full flex flex-col"
                >
                  {/* Resume Preview Pane */}
                  <div className={`flex-1 flex flex-col rounded-3xl overflow-hidden ${isDarkMode ? 'glass-panel border border-white/10' : 'glass-panel-light border border-black/5 shadow-2xl'}`}>
                    <div className={`p-2 md:p-4 border-b flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 md:gap-4 ${isDarkMode ? 'glass-thin border-white/5' : 'bg-black/5 border-black/5'}`}>
                      <div className="flex flex-row items-center gap-2 md:gap-3">
                        <div className="flex flex-row gap-1 bg-black/20 dark:bg-white/5 p-1 rounded-lg">
                          <button 
                            onClick={() => setPreviewMode('standard')}
                            className={`px-2 md:px-3 py-1 md:py-1.5 text-[8px] md:text-[9px] font-bold uppercase tracking-widest rounded-md transition-all flex items-center justify-center gap-1 md:gap-2 ${
                              previewMode === 'standard' 
                                ? 'bg-emerald-500 text-white shadow-sm' 
                                : 'opacity-40 hover:opacity-100'
                            }`}
                          >
                            <Layout className="w-2.5 h-2.5 md:w-3 md:h-3" />
                            <span className="hidden xs:inline">Standard</span>
                          </button>
                          <button 
                            onClick={() => setPreviewMode('simplified')}
                            className={`px-2 md:px-3 py-1 md:py-1.5 text-[8px] md:text-[9px] font-bold uppercase tracking-widest rounded-md transition-all flex items-center justify-center gap-1 md:gap-2 ${
                              previewMode === 'simplified' 
                                ? 'bg-emerald-500 text-white shadow-sm' 
                                : 'opacity-40 hover:opacity-100'
                            }`}
                          >
                            <AlignLeft className="w-2.5 h-2.5 md:w-3 md:h-3" />
                            <span className="hidden xs:inline">Workday</span>
                          </button>
                        </div>
                        <div className="h-6 md:h-8 w-[1px] bg-white/10 mx-0.5 md:mx-1" />
                        <div className="flex flex-row gap-1 bg-purple-500/10 dark:bg-purple-500/5 p-1 rounded-lg border border-purple-500/20">
                          <button 
                            onClick={() => setViewMode('resume')}
                            className={`px-2 md:px-3 py-1 md:py-1.5 text-[8px] md:text-[9px] font-bold uppercase tracking-widest rounded-md transition-all flex items-center justify-center gap-1 md:gap-2 ${
                              viewMode === 'resume' 
                                ? 'bg-purple-600 text-white shadow-sm' 
                                : 'text-purple-600/60 dark:text-purple-400/60 hover:text-purple-600 dark:hover:text-purple-400'
                            }`}
                          >
                            <FileText className="w-2.5 h-2.5 md:w-3 md:h-3" />
                            <span className="hidden xs:inline">Resume</span>
                          </button>
                          <button 
                            onClick={() => setViewMode('insights')}
                            className={`px-2 md:px-3 py-1 md:py-1.5 text-[8px] md:text-[9px] font-bold uppercase tracking-widest rounded-md transition-all flex items-center justify-center gap-1 md:gap-2 ${
                              viewMode === 'insights' 
                                ? 'bg-purple-600 text-white shadow-sm' 
                                : 'text-purple-600/60 dark:text-purple-400/60 hover:text-purple-600 dark:hover:text-purple-400'
                            }`}
                          >
                            <Sparkles className="w-2.5 h-2.5 md:w-3 md:h-3" />
                            <span className="hidden xs:inline">Nexus Insights</span>
                          </button>
                        </div>
                        <div className="h-6 md:h-8 w-[1px] bg-white/10 mx-0.5 md:mx-1" />
                        <div className="flex flex-col justify-center">
                          <span className="text-[7px] md:text-[8px] font-bold uppercase tracking-widest opacity-30 mb-0.5">Editing Section</span>
                          <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-emerald-400 truncate max-w-[80px] md:max-w-none">
                            {activeSection || 'Full Resume'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2">
                        <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded-lg p-0.5 mr-2">
                          <button 
                            onClick={() => downloadJSON(activeAudience ? results[activeAudience] : data, targetRole, companyName, showToast)}
                            className={`p-1.5 rounded-md transition-colors hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400`}
                            title="Download Resume JSON"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <div className="w-[1px] h-3 bg-black/10 dark:bg-white/10" />
                          <button 
                            onClick={() => setShowJsonViewer(true)}
                            className={`px-2 py-1.5 rounded-md transition-colors hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest`}
                            title="View Resume JSON"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            JSON
                          </button>
                        </div>
                        {overflow.isOverflowing && (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-500 text-[10px] font-bold animate-pulse">
                            <AlertCircle className="w-3 h-3" />
                            <span>OVERFLOW</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1.5 md:gap-2">
                          <div className={`flex items-center gap-0.5 md:gap-1 px-1 md:px-1.5 py-0.5 md:py-1 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-black/5'}`}>
                            <button 
                              onClick={() => {
                                setIsAutoZoom(false);
                                setZoom(z => Math.max(0.1, z - 0.1));
                              }}
                              className="p-0.5 md:p-1 hover:bg-white/10 rounded transition-colors"
                              title="Zoom Out"
                            >
                              <span className="text-[8px] md:text-[10px] font-bold">-</span>
                            </button>
                            <button
                              onClick={() => setIsAutoZoom(!isAutoZoom)}
                              className={`text-[8px] md:text-[9px] font-mono w-10 md:w-12 text-center hover:text-emerald-500 transition-colors ${isAutoZoom ? 'text-emerald-500' : ''}`}
                              title={isAutoZoom ? "Disable Auto-Zoom" : "Enable Auto-Zoom"}
                            >
                              {Math.round(zoom * 100)}%
                            </button>
                            <button 
                              onClick={() => {
                                setIsAutoZoom(false);
                                setZoom(z => Math.min(2, z + 0.1));
                              }}
                              className="p-0.5 md:p-1 hover:bg-white/10 rounded transition-colors"
                              title="Zoom In"
                            >
                              <span className="text-[8px] md:text-[10px] font-bold">+</span>
                            </button>
                          </div>

                          <button 
                            onClick={copyResumeText}
                            className={`p-1.5 md:p-2 rounded-lg transition-colors text-[8px] md:text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 md:gap-2 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
                            title="Copy text for selectable use"
                          >
                            <Copy className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            <span className="hidden lg:inline">Copy</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 md:gap-2">
                          <div className={`flex items-center gap-1.5 md:gap-2 px-1.5 md:px-2 py-1 md:py-1.5 rounded-lg border transition-all cursor-pointer hover:opacity-80 ${
                            versioningEnabled 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                              : 'bg-gray-500/10 border-gray-500/20 text-gray-500'
                          }`}
                          onClick={() => setVersioningEnabled(!versioningEnabled)}
                          title={versioningEnabled ? "Versioning is ON" : "Versioning is OFF"}
                          >
                            <HardDrive className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest">
                              V: {versioningEnabled ? 'ON' : 'OFF'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button 
                              onClick={handleDownloadDOCX}
                              className="px-2 md:px-3 py-1.5 md:py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors text-[8px] md:text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 md:gap-2 shadow-lg shadow-blue-500/10"
                              title="Download as Word Document"
                            >
                              <FileDown className="w-3.5 h-3.5 md:w-4 md:h-4" />
                              <span>DOCX</span>
                            </button>
                            <button 
                              onClick={downloadPDF}
                              disabled={isDownloading}
                              className="px-2 md:px-3 py-1.5 md:py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors text-[8px] md:text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 md:gap-2 disabled:opacity-50 shadow-lg shadow-emerald-500/10"
                            >
                              {isDownloading ? (
                                <div className="w-3.5 h-3.5 md:w-4 md:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Download className="w-3.5 h-3.5 md:w-4 md:h-4" />
                              )}
                              <span>PDF</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div 
                      ref={previewContainerRef}
                      className={`w-full flex-1 min-h-0 overflow-auto flex items-start justify-center ${isDarkMode ? 'bg-[#1A1A1A]' : 'bg-gray-200/50'} custom-scrollbar`}
                    >
                      {viewMode === 'resume' ? (
                        <div 
                          className="mx-auto relative overflow-hidden"
                          style={{
                            width: `${794 * zoom}px`, // Approx width of A4 210mm
                            height: `${contentHeight * zoom}px`,
                            transition: 'width 0.3s ease, height 0.3s ease'
                          }}
                        >
                          <div 
                            style={{
                              transform: `scale(${zoom})`,
                              transformOrigin: 'top left',
                              width: 'max-content'
                            }}
                          >
                            <div 
                              id="resume-container"
                              className={`transition-all duration-300 relative ${activeSection ? 'ring-2 ring-emerald-500/20' : ''} ${isDownloading ? 'legacy-colors' : 'shadow-2xl'}`}
                            >
                          {previewMode === 'standard' ? (
                            <div className="resume-page" style={{ paddingBottom: isDownloading ? '0' : '2rem' }}>
                              {renderSection('header')}
                              {renderSection('summary')}
                              {renderSection('skills')}
                              {renderSection('certifications')}
                              {/* Pass the FULL array, do not slice. Let the print engine handle pagination */}
                              {renderSection('experience', (currentResultWorkspaceArtifact?.activeAudience ? currentResultWorkspaceArtifact.results[currentResultWorkspaceArtifact.activeAudience]?.experience : results[activeAudience!]?.experience) || data.experience)}
                              
                              {/* CRITICAL FIX: Pass the project array variables correctly */}
                              {renderSection(
                                'projects', 
                                undefined, 
                                false, 
                                (currentResultWorkspaceArtifact?.activeAudience ? currentResultWorkspaceArtifact.results[currentResultWorkspaceArtifact.activeAudience]?.projects : results[activeAudience!]?.projects) || data.projects
                               )}
                              
                              {/* CRITICAL FIX: Pass the education array variables correctly */}
                              {renderSection(
                                'education', 
                                undefined, 
                                false, 
                                undefined, 
                                (currentResultWorkspaceArtifact?.activeAudience ? currentResultWorkspaceArtifact.results[currentResultWorkspaceArtifact.activeAudience]?.education : results[activeAudience!]?.education) || data.education || []
                              )}
                            </div>
                          ) : (
                            renderSimplifiedResume()
                          )}
                          </div>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full max-w-7xl mx-auto h-full p-4 md:p-8 overflow-y-auto custom-scrollbar">
                          {/* Grid layout containing left main workspace and right board panel */}
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            
                            {/* Main Workspace Structure (Left Column - Cols: 7) */}
                            <div className="lg:col-span-7 flex flex-col gap-6">
                              <ResumeIntelligencePanel 
                                isDarkMode={isDarkMode} 
                                results={results} 
                                activeAudience={activeAudience} 
                                data={data}
                                jobDescription={jobDescription}
                                targetRole={targetRole}
                                companyName={companyName}
                              />
                              <OptimizationPipelinePanel 
                                isDarkMode={isDarkMode} 
                                jobDescription={jobDescription}
                                isFetchingJob={isFetchingJob}
                                isCheckingSuitability={isCheckingSuitability}
                                selectedResumeId={selectedResumeId}
                                isOptimizing={isOptimizing}
                                results={results}
                                isDownloading={isDownloading}
                              />
                              <MasterResumeIntelligencePanel 
                                isDarkMode={isDarkMode} 
                                masterResumes={masterResumes} 
                                selectedResumeId={selectedResumeId} 
                                onSelectResume={handleSetActiveResume} 
                                results={results}
                                activeAudience={activeAudience}
                              />
                              <OptimizationResultsPanel 
                                isDarkMode={isDarkMode} 
                                results={results} 
                                activeAudience={activeAudience} 
                              />
                            </div>

                            {/* Right Panel Structure (Right Column - Cols: 5) */}
                            <div className="lg:col-span-5 flex flex-col gap-6">
                              <AIInsightsPanel 
                                isDarkMode={isDarkMode} 
                                isOptimizing={isOptimizing}
                                isFetchingJob={isFetchingJob}
                                isCheckingSuitability={isCheckingSuitability}
                                isDownloading={isDownloading}
                              />
                              <ActivityFeed 
                                isDarkMode={isDarkMode} 
                                selectedResumeId={selectedResumeId} 
                                masterResumes={masterResumes} 
                                isOptimizing={isOptimizing} 
                                isSyncing={isSavingProfile} 
                                isDownloading={isDownloading} 
                                results={results} 
                                activeAudience={activeAudience} 
                              />
                              <RecommendationFeed 
                                isDarkMode={isDarkMode} 
                                results={results} 
                                activeAudience={activeAudience} 
                              />
                              
                              <Suspense fallback={<div className="text-white/40 text-[10px] uppercase font-mono tracking-widest text-center py-4">Loading critical scenarios...</div>}>
                                <div className={`p-6 rounded-3xl border select-none transition-all duration-300 relative overflow-hidden backdrop-blur-xl text-left ${
                                  isDarkMode 
                                    ? 'glass-card-dark border-white/10 text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)]' 
                                    : 'glass-card border-black/10 text-slate-800 shadow-[0_12px_30px_rgba(0,0,0,0.05)]'
                                }`}>
                                  <span className="text-[9px] font-black uppercase tracking-[0.2em] mb-4 block text-emerald-400">Deep Behavioral Star Scenarios & Auditing</span>
                                  <NexusProInsights 
                                     isDarkMode={isDarkMode} 
                                     starStories={activeAudience ? results[activeAudience]?.star_stories : undefined}
                                     auditReport={activeAudience ? results[activeAudience]?.audit_report : undefined}
                                  />
                                </div>
                              </Suspense>
                            </div>

                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-2 border-t border-white/10 flex justify-center bg-white/5">
                      <button 
                        onClick={downloadPDF}
                        disabled={isDownloading || optimizationProgress < 100}
                        className="px-6 py-2 rounded-lg bg-stone-900 text-white hover:bg-stone-800 transition-all transform hover:scale-[1.02] font-semibold text-sm flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:hover:scale-100"
                      >
                        {isDownloading ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Generating PDF...
                          </>
                        ) : (
                          <>
                            <Download className="w-5 h-5" />
                            Finalize & Download Resume
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          )}
        </main>
      )}

        <AnimatePresence>
          {/* Mobile toggle removed to keep panels together */}
        </AnimatePresence>

        <AuthModal 
          isOpen={isAuthModalOpen} 
          onClose={() => setIsAuthModalOpen(false)} 
          isDarkMode={isDarkMode}
          onSuccess={() => {
            setIsAuthModalOpen(false);
          }}
        />
        <TermsModal
          isOpen={showTermsModal}
          onAccept={() => {
            setShowTermsModal(false);
          }}
          isDarkMode={isDarkMode}
        />
        <ResumeJsonViewer isOpen={showJsonViewer} onClose={() => setShowJsonViewer(false)} />
        <DriveFolderPicker
          isOpen={isSelectingFolder}
          onClose={() => setIsSelectingFolder(false)}
          onSelect={(folder) => {
            setSelectedDriveFolder(folder);
            setIsSelectingFolder(false);
            showToast(`Selected folder: ${folder.name}`, 'success');
          }}
          accessToken={driveAccessToken}
          isDarkMode={isDarkMode}
        />
        <CommandPalette 
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          isDarkMode={isDarkMode}
          resumeData={data}
        />
      </div>
    </DashboardShell>
  );
}