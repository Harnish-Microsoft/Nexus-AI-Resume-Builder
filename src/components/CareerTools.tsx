import React, { useState, useEffect } from 'react';
import { Brain, Target, ArrowRightLeft, HelpCircle, Code, Briefcase, ChevronRight, MessageSquare, FileInput, IndianRupee, Linkedin, Key, Search } from 'lucide-react';
import { JobTracker } from './JobTracker';
import { CareerQuiz } from './CareerQuiz';
import { ATSAutofillHelper } from './ATSAutofillHelper';
import { LinkedInImporter } from './LinkedInImporter';

import { SkillExtractor } from './SkillExtractor';

import { User } from 'firebase/auth';

interface CareerToolsProps {
  isDarkMode: boolean;
  engineConfig: Record<string, any>;
  selectedEngine: 'gemini' | 'openai' | 'hybrid';
  resumeData: any;
  jobDescription?: string;
  user: User | null;
  onToolActive?: (isActive: boolean) => void;
  linkedinProps: any;
}

export const CareerTools: React.FC<CareerToolsProps> = ({ isDarkMode, engineConfig, selectedEngine, resumeData, jobDescription, user, onToolActive, linkedinProps }) => {
  const [activeTool, setActiveTool] = useState<string | null>(null);

  useEffect(() => {
    if (onToolActive) {
      onToolActive(activeTool !== null);
    }
  }, [activeTool, onToolActive]);

  const tools = [
    {
      id: 'stay_quit',
      title: 'Stay vs Quit Job Quiz',
      description: 'Take stock of your current work situation and decide if you should stay or leave.',
      icon: ArrowRightLeft,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10'
    },
    {
      id: 'tech',
      title: 'Tech Career Quiz',
      description: 'Find the best path for your skills, interests, and experience level in tech.',
      icon: Code,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10'
    },
    {
      id: 'tracker',
      title: 'AI Job Tracker',
      description: 'Intelligent pipeline management, data extraction, and predictive matching.',
      icon: Briefcase,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10'
    },
    {
      id: 'autofill',
      title: 'ATS Autofill Helper',
      description: 'Quickly copy-paste or use an extension to fill Workday and Greenhouse forms.',
      icon: FileInput,
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10'
    },
    {
      id: 'interview_coach',
      title: 'AI Interview Coach',
      description: 'Interactive one-on-one mock interview simulator. Practice common and role-specific questions with real-time feedback.',
      icon: MessageSquare,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10'
    },
    {
      id: 'negotiation',
      title: 'Salary & Negotiation Prep',
      description: 'Learn research-backed negotiation strategies and practice your pitch for higher compensation.',
      icon: IndianRupee,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10'
    },
    {
      id: 'skill_extractor',
      title: 'Portal Skill Optimization',
      description: 'Extract must-have keywords from JDs to pass portal filters and ATS. Optimize your profile for better visibility.',
      icon: Key,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10'
    }
  ];

  if (activeTool === 'tracker') {
    return <JobTracker isDarkMode={isDarkMode} engineConfig={engineConfig} selectedEngine={selectedEngine} user={user} onBack={() => setActiveTool(null)} />;
  }

  if (activeTool === 'autofill') {
    return <ATSAutofillHelper isDarkMode={isDarkMode} resumeData={resumeData} onBack={() => setActiveTool(null)} />;
  }

  if (activeTool === 'skill_extractor') {
    return <SkillExtractor isDarkMode={isDarkMode} resumeData={resumeData} onBack={() => setActiveTool(null)} engineConfig={engineConfig} initialJd={jobDescription} />;
  }

  if (activeTool) {
    const tool = tools.find(t => t.id === activeTool);
    return <CareerQuiz toolId={activeTool} title={tool?.title || ''} isDarkMode={isDarkMode} engineConfig={engineConfig} selectedEngine={selectedEngine} onBack={() => setActiveTool(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2">Career Tools & Quizzes</h2>
        <p className="text-sm opacity-70">Leverage Gemini 3.1 Pro to guide your career decisions and track your job applications.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className={`flex flex-col text-left p-5 rounded-2xl border transition-all hover:-translate-y-1 ${
                isDarkMode 
                  ? 'bg-white/5 border-white/10 hover:bg-white/10' 
                  : 'bg-white border-black/10 hover:shadow-lg'
              }`}
            >
              <div className={`p-3 rounded-xl w-fit mb-4 ${tool.bgColor}`}>
                <Icon className={`w-6 h-6 ${tool.color}`} />
              </div>
              <h3 className="font-bold mb-2">{tool.title}</h3>
              <p className="text-xs opacity-70 mb-4 flex-1">{tool.description}</p>
              <div className="flex items-center gap-2 text-xs font-semibold opacity-60 mt-auto">
                <span>Start</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

