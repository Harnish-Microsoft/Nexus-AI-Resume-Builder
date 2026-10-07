import { create } from 'zustand';
import { CanvasElement, ElementStyle, ElementType } from '../types/resume';

interface ResumeStore {
  elements: CanvasElement[];
  selectedElementIds: string[];
  history: CanvasElement[][];
  historyIndex: number;
  zoom: number;
  showGrid: boolean;
  darkMode: boolean;
  isExporting: boolean;
  
  // AI Config
  jobDescription: string;
  targetRole: string;
  audience: string;
  isOptimizing: boolean;
  aiEngine: string;
  comparisonData: any | null;

  // Actions
  addElement: (type: ElementType, content?: string, x?: number, y?: number) => void;
  removeElement: (id: string) => void;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  updateMultipleElements: (ids: string[], updates: Partial<CanvasElement>) => void;
  updateElementStyle: (id: string, style: Partial<ElementStyle>) => void;
  selectElement: (id: string | null, isMulti?: boolean) => void;
  setIsExporting: (val: boolean) => void;
  setZoom: (zoom: number) => void;
  toggleGrid: () => void;
  toggleDarkMode: () => void;
  resetResume: () => void;
  updateConfig: (updates: { jobDescription?: string; targetRole?: string; audience?: string; aiEngine?: string }) => void;
  setIsOptimizing: (val: boolean) => void;
  setComparisonData: (data: any | null) => void;
  applyOptimization: (optimizedElements: CanvasElement[]) => void;
  toggleVisibility: (id: string) => void;
  setShowGrid: (show: boolean) => void;
  reorderElements: (startIndex: number, endIndex: number) => void;
  
  // History
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
}

const DEFAULT_STYLE: ElementStyle = {
  fontFamily: 'Inter',
  fontSize: 14,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  textAlign: 'left',
  lineHeight: 1.5,
  letterSpacing: 0,
  color: '#1a1a1a',
  backgroundColor: 'transparent',
  padding: 0,
  margin: 0,
  borderRadius: 0,
  opacity: 1,
};

const INITIAL_ELEMENTS: CanvasElement[] = [];

export const useResumeStore = create<ResumeStore>((set, get) => ({
  elements: INITIAL_ELEMENTS,
  selectedElementIds: [],
  history: [INITIAL_ELEMENTS],
  historyIndex: 0,
  zoom: 1,
  showGrid: false,
  darkMode: false,
  isExporting: false,
  jobDescription: '',
  targetRole: '',
  audience: 'Technical Recruiter',
  isOptimizing: false,
  aiEngine: 'gemini-3-flash-preview',
  comparisonData: null,

  saveToHistory: () => {
    const { elements, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...elements.map(el => ({ ...el, style: { ...el.style } }))]);
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  addElement: (type, content = 'New Element', x = 100, y = 100) => {
    const id = `${type}-${Date.now()}`;
    const newElement: CanvasElement = {
      id,
      type,
      content,
      x,
      y,
      width: 200,
      height: 50,
      style: { ...DEFAULT_STYLE },
    };

    set((state) => ({
      elements: [...state.elements, newElement],
      selectedElementIds: [id],
    }));
    get().saveToHistory();
  },

  removeElement: (id) => {
    set((state) => ({
      elements: state.elements.filter((el) => el.id !== id),
      selectedElementIds: state.selectedElementIds.filter((sid) => sid !== id),
    }));
    get().saveToHistory();
  },

  updateElement: (id, updates) => {
    set((state) => ({
      elements: state.elements.map((el) => (el.id === id ? { ...el, ...updates } : el)),
    }));
    get().saveToHistory();
  },

  updateMultipleElements: (ids, updates) => {
    set((state) => ({
      elements: state.elements.map((el) => (ids.includes(el.id) ? { ...el, ...updates } : el)),
    }));
    get().saveToHistory();
  },

  updateElementStyle: (id, style) => {
    set((state) => ({
      elements: state.elements.map((el) =>
        el.id === id ? { ...el, style: { ...el.style, ...style } } : el
      ),
    }));
    get().saveToHistory();
  },

  selectElement: (id, isMulti = false) => {
    set((state) => {
      if (!id) return { selectedElementIds: [] };
      if (isMulti) {
        const isSelected = state.selectedElementIds.includes(id);
        if (isSelected) {
          return { selectedElementIds: state.selectedElementIds.filter(sid => sid !== id) };
        } else {
          return { selectedElementIds: [...state.selectedElementIds, id] };
        }
      }
      return { selectedElementIds: [id] };
    });
  },

  setIsExporting: (isExporting) => set({ isExporting }),

  setZoom: (zoom) => set({ zoom }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  setShowGrid: (showGrid) => set({ showGrid }),
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  
  resetResume: () => {
    set({
      elements: INITIAL_ELEMENTS,
      selectedElementIds: [],
      history: [INITIAL_ELEMENTS],
      historyIndex: 0,
      zoom: 1,
      showGrid: false,
    });
  },

  updateConfig: (updates) => set((state) => ({ ...state, ...updates })),
  setIsOptimizing: (val) => set({ isOptimizing: val }),
  setComparisonData: (data) => set({ comparisonData: data }),
  
  applyOptimization: (optimizedElements) => {
    set({ elements: optimizedElements });
    get().saveToHistory();
  },

  toggleVisibility: (id) => {
    set((state) => ({
      elements: state.elements.map((el) =>
        el.id === id ? { ...el, isVisible: !el.isVisible } : el
      ),
    }));
    get().saveToHistory();
  },

  reorderElements: (startIndex, endIndex) => {
    set((state) => {
      const newElements = [...state.elements];
      const [removed] = newElements.splice(startIndex, 1);
      newElements.splice(endIndex, 0, removed);
      return { elements: newElements };
    });
    get().saveToHistory();
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      set({
        elements: [...history[newIndex]],
        historyIndex: newIndex,
      });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      set({
        elements: [...history[newIndex]],
        historyIndex: newIndex,
      });
    }
  },
}));
