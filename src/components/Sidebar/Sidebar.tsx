import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Layout, 
  Type, 
  Briefcase, 
  GraduationCap, 
  Code, 
  Layers, 
  Image as ImageIcon, 
  Sparkles,
  Eye,
  EyeOff,
  GripVertical,
  Trash2,
  Settings,
  Target,
  FileText,
  RefreshCw,
  Cpu,
  Zap,
  CheckCircle2,
  Search
} from 'lucide-react';
import { useResumeStore } from '../../store/useResumeStore';
import { ElementType, CanvasElement } from '../../types/resume';
import { cn } from '../../lib/utils';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors 
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { rewriteSectionWithAI } from '../../services/aiService';

interface SortableItemProps {
  id: string;
  element: any;
  key?: string;
}

const SortableItem = ({ id, element }: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const { toggleVisibility, removeElement, selectElement, selectedElementIds, darkMode } = useResumeStore();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : 1,
  };

  const isSelected = selectedElementIds.includes(id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 p-2 rounded-lg border transition-all mb-2 cursor-pointer",
        isSelected 
          ? (darkMode ? "border-indigo-500 bg-indigo-500/10" : "border-indigo-500 bg-indigo-50") 
          : (darkMode ? "border-transparent hover:bg-gray-700" : "border-transparent hover:bg-gray-50"),
        !element.isVisible && "opacity-50"
      )}
      onClick={() => selectElement(id)}
    >
      <div {...attributes} {...listeners} className={cn("cursor-grab active:cursor-grabbing", darkMode ? "text-gray-500" : "text-gray-400")}>
        <GripVertical size={16} />
      </div>
      
      <span className={cn("flex-1 text-sm font-medium capitalize truncate", darkMode ? "text-gray-200" : "text-gray-700")}>
        {element.type} - {element.content.substring(0, 20)}...
      </span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); toggleVisibility(id); }}
          className={cn("p-1 rounded transition-colors", darkMode ? "hover:bg-gray-600 text-gray-400" : "hover:bg-gray-200 text-gray-500")}
        >
          {element.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); removeElement(id); }}
          className={cn("p-1 rounded transition-colors", darkMode ? "hover:bg-red-500/20 text-red-400" : "hover:bg-red-100 text-red-500")}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export const Sidebar = () => {
  const { 
    addElement, 
    elements, 
    reorderElements, 
    resetResume, 
    jobDescription, 
    targetRole, 
    updateConfig,
    updateElement,
    aiEngine,
    audience,
    setComparisonData,
    darkMode
  } = useResumeStore();
  const [activeTab, setActiveTab] = useState<'tools' | 'config'>('tools');

  const audiences = [
    { id: 'Enterprise', name: 'Enterprise/Big Tech', desc: 'Focus on scale, leadership, and architecture.' },
    { id: 'Startup', name: 'Startup/Agile', desc: 'Focus on speed, versatility, and ownership.' },
    { id: 'Technical', name: 'Technical/Internal', desc: 'Deep dive into implementation and tooling.' },
  ];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = elements.findIndex((el) => el.id === active.id);
      const newIndex = elements.findIndex((el) => el.id === over.id);
      reorderElements(oldIndex, newIndex);
    }
  };

  const tools = [
    { type: 'text' as ElementType, icon: Type, label: 'Text Block' },
    { type: 'experience' as ElementType, icon: Briefcase, label: 'Experience' },
    { type: 'education' as ElementType, icon: GraduationCap, label: 'Education' },
    { type: 'skills' as ElementType, icon: Code, label: 'Skills' },
    { type: 'projects' as ElementType, icon: Layers, label: 'Projects' },
  ];

  const engines = [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', desc: 'Fast & Lightweight', icon: Zap },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', desc: 'Powerful & Accurate', icon: Cpu },
  ];

  return (
    <aside className={cn(
      "w-72 h-full border-r flex flex-col overflow-hidden transition-colors backdrop-blur-md",
      darkMode ? "bg-gray-800/80 border-gray-700/50" : "bg-white/80 border-gray-200/50"
    )}>
      {/* Tabs */}
      <div className={cn(
        "flex border-b transition-colors",
        darkMode ? "border-gray-700" : "border-gray-100"
      )}>
        <button 
          onClick={() => setActiveTab('tools')}
          className={cn(
            "flex-1 py-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all",
            activeTab === 'tools' 
              ? (darkMode ? "text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/10" : "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30") 
              : (darkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600")
          )}
        >
          <Layout size={16} />
          Tools
        </button>
        <button 
          onClick={() => setActiveTab('config')}
          className={cn(
            "flex-1 py-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all",
            activeTab === 'config' 
              ? (darkMode ? "text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/10" : "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30") 
              : (darkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600")
          )}
        >
          <Settings size={16} />
          Config
        </button>
      </div>

      <div className="p-4 py-3">
         <button 
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all text-left group",
            darkMode ? "bg-gray-900 border-gray-700 hover:border-gray-600" : "bg-gray-50 border-gray-200 hover:border-gray-300"
          )}
        >
          <Search size={16} className="opacity-40 group-hover:opacity-100 transition-opacity" />
          <span className="text-xs font-medium opacity-40 group-hover:opacity-70 transition-opacity flex-1">Search...</span>
          <div className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[9px] font-bold opacity-30">
            ⌘K
          </div>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {activeTab === 'tools' ? (
          <>
            {/* Add Elements */}
            <div>
              <h3 className={cn("text-xs font-semibold uppercase tracking-wider mb-3", darkMode ? "text-gray-500" : "text-gray-400")}>Add Elements</h3>
              <div className="grid grid-cols-2 gap-2">
                {tools.map((tool) => (
                  <button
                    key={tool.type}
                    onClick={() => addElement(tool.type)}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl border transition-all group",
                      darkMode 
                        ? "border-gray-700 hover:border-indigo-500/50 hover:bg-indigo-500/10" 
                        : "border-gray-100 hover:border-indigo-300 hover:bg-indigo-50"
                    )}
                  >
                    <tool.icon size={20} className={cn("mb-1 transition-colors", darkMode ? "text-gray-500 group-hover:text-indigo-400" : "text-gray-500 group-hover:text-indigo-600")} />
                    <span className={cn("text-[10px] font-medium transition-colors", darkMode ? "text-gray-400 group-hover:text-indigo-300" : "text-gray-600 group-hover:text-indigo-700")}>{tool.label}</span>
                  </button>
                ))}
                <button className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-xl border transition-all group",
                  darkMode 
                    ? "border-gray-700 hover:border-indigo-500/50 hover:bg-indigo-500/10" 
                    : "border-gray-100 hover:border-indigo-300 hover:bg-indigo-50"
                )}>
                  <ImageIcon size={20} className={cn("mb-1 transition-colors", darkMode ? "text-gray-500 group-hover:text-indigo-400" : "text-gray-500 group-hover:text-indigo-600")} />
                  <span className={cn("text-[10px] font-medium transition-colors", darkMode ? "text-gray-400 group-hover:text-indigo-300" : "text-gray-600 group-hover:text-indigo-700")}>Upload Image</span>
                </button>
              </div>
            </div>

            {/* Layers / Section List */}
            <div>
              <h3 className={cn("text-xs font-semibold uppercase tracking-wider mb-3", darkMode ? "text-gray-500" : "text-gray-400")}>Sections</h3>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={elements.map(el => el.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {elements.map((element) => (
                    <SortableItem key={element.id} id={element.id} element={element} />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          </>
        ) : (
          <div className="space-y-6">
            <div>
              <label className={cn("text-xs font-bold uppercase mb-2 flex items-center gap-2", darkMode ? "text-gray-400" : "text-gray-500")}>
                <Target size={14} className="text-indigo-500" />
                Target Role
              </label>
              <input 
                type="text"
                value={targetRole}
                onChange={(e) => updateConfig({ targetRole: e.target.value })}
                placeholder="e.g. Senior Frontend Engineer"
                className={cn(
                  "w-full p-3 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors",
                  darkMode ? "bg-gray-900 border-gray-700 text-gray-200" : "bg-gray-50 border-gray-200 text-gray-900"
                )}
              />
            </div>

            <div>
              <label className={cn("text-xs font-bold uppercase mb-2 flex items-center gap-2", darkMode ? "text-gray-400" : "text-gray-500")}>
                <FileText size={14} className="text-indigo-500" />
                Job Description
              </label>
              <textarea 
                value={jobDescription}
                onChange={(e) => updateConfig({ jobDescription: e.target.value })}
                placeholder="Paste the job description here to help AI optimize your resume..."
                className={cn(
                  "w-full h-48 p-3 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none transition-colors",
                  darkMode ? "bg-gray-900 border-gray-700 text-gray-200" : "bg-gray-50 border-gray-200 text-gray-900"
                )}
              />
            </div>

            <div>
              <label className={cn("text-xs font-bold uppercase mb-3 flex items-center gap-2", darkMode ? "text-gray-400" : "text-gray-500")}>
                <Target size={14} className="text-indigo-500" />
                Target Audience
              </label>
              <div className="space-y-2">
                {audiences.map((aud) => (
                  <button
                    key={aud.id}
                    onClick={() => updateConfig({ audience: aud.id })}
                    className={cn(
                      "w-full p-3 rounded-xl border transition-all flex items-center gap-3 text-left",
                      audience === aud.id 
                        ? (darkMode ? "border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500" : "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500") 
                        : (darkMode ? "border-gray-700 hover:border-gray-600 bg-gray-900" : "border-gray-100 hover:border-gray-200 bg-white")
                    )}
                  >
                    <div className="flex-1">
                      <div className={cn("text-xs font-bold", darkMode ? "text-gray-200" : "text-gray-900")}>{aud.name}</div>
                      <div className="text-[10px] text-gray-500">{aud.desc}</div>
                    </div>
                    {audience === aud.id && <CheckCircle2 size={16} className="text-indigo-600" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={cn("text-xs font-bold uppercase mb-3 flex items-center gap-2", darkMode ? "text-gray-400" : "text-gray-500")}>
                <Cpu size={14} className="text-indigo-500" />
                AI Engine
              </label>
              <div className="space-y-2">
                {engines.map((engine) => (
                  <button
                    key={engine.id}
                    onClick={async () => {
                      updateConfig({ aiEngine: engine.id });
                      try {
                        await fetch('/api/cache/clear', { method: 'POST' });
                      } catch (e) {
                        console.error('Failed to clear cache', e);
                      }
                    }}
                    className={cn(
                      "w-full p-3 rounded-xl border transition-all flex items-center gap-3 text-left",
                      aiEngine === engine.id 
                        ? (darkMode ? "border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500" : "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500") 
                        : (darkMode ? "border-gray-700 hover:border-gray-600 bg-gray-900" : "border-gray-100 hover:border-gray-200 bg-white")
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg",
                      aiEngine === engine.id 
                        ? (darkMode ? "bg-indigo-500 text-white" : "bg-indigo-600 text-white") 
                        : (darkMode ? "bg-gray-800 text-gray-500" : "bg-gray-100 text-gray-500")
                    )}>
                      <engine.icon size={16} />
                    </div>
                    <div className="flex-1">
                      <div className={cn("text-xs font-bold", darkMode ? "text-gray-200" : "text-gray-900")}>{engine.name}</div>
                      <div className="text-[10px] text-gray-500">{engine.desc}</div>
                    </div>
                    {aiEngine === engine.id && <CheckCircle2 size={16} className="text-indigo-600" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={cn(
        "p-4 border-t transition-colors",
        darkMode ? "bg-gray-900 border-gray-700" : "bg-gray-50 border-gray-100"
      )}>
        <button 
          onClick={resetResume}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all",
            darkMode ? "bg-white text-gray-900 hover:bg-gray-200" : "bg-gray-900 text-white hover:bg-black"
          )}
        >
          <Plus size={18} />
          New Template
        </button>
      </div>
    </aside>
  );
};
