import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Send, Bot, User, Loader2, RefreshCw, Pause, Play, CheckCircle2 } from 'lucide-react';
import { getDecryptedKey } from '../services/geminiService';
import { AutoResizeTextarea } from './AutoResizeTextarea';
import { GoogleGenAI } from "@google/genai";

interface CareerQuizProps {
  toolId: string;
  title: string;
  isDarkMode: boolean;
  engineConfig: Record<string, any>;
  selectedEngine: 'gemini' | 'openai' | 'hybrid';
  onBack: () => void;
}

interface Message {
  role: 'user' | 'model';
  content: string;
}

export const CareerQuiz: React.FC<CareerQuizProps> = ({ toolId, title, isDarkMode, engineConfig, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [chatSession, setChatSession] = useState<any>(null);
  const [status, setStatus] = useState<'active' | 'paused' | 'completed' | 'idle'>('idle');

  const getSystemPrompt = () => {
    switch (toolId) {
      case 'personality':
        return "You are an expert career counselor. Conduct a Career Personality Test. Ask 5-7 insightful questions one by one to identify the user's professional strengths, weaknesses, and ideal work environments. After gathering enough information, provide a comprehensive personality profile and career recommendations.";
      case 'goals':
        return "You are a career coach. Help the user define their career goals and create a Career Goal Tracker. Ask questions to understand their short-term and long-term aspirations, then help them break these down into actionable steps. Provide a structured plan at the end.";
      case 'stay_quit':
        return "You are an empathetic career advisor. Conduct a 'Stay vs Quit' assessment. Ask probing questions about the user's current job satisfaction, growth opportunities, toxic traits, and market value. Help them weigh the pros and cons, and provide a thoughtful recommendation on whether they should stay or leave.";
      case 'change':
        return "You are a career transition specialist. Conduct a Career Change Quiz. Ask questions to evaluate the user's transferable skills, interests, and professional goals. Suggest 3-5 new career paths that match their profile and explain why.";
      case 'tech':
        return "You are a tech career mentor. Conduct a Tech Career Quiz. Ask questions about the user's coding experience, problem-solving style, and interests (e.g., frontend, backend, data, security, AI). Recommend the best tech career paths for them.";
      case 'interview_coach':
        return "You are a seasoned hiring manager. Conduct an interactive Mock Interview. Ask one interview question at a time (mix of behavioral and role-specific). After the user answers, provide brief constructive feedback (STAR method) and then move to the next question. Conduct 5 questions total.";
      case 'negotiation':
        return "You are a compensation specialist. Help the user prepare for a salary negotiation. Ask about their current role, target role, and any offers they have. Provide data-backed strategies and practice the 'Big Ask' scenario with them.";
      default:
        return "You are a helpful career assistant.";
    }
  };

  // Initialize chat
  const initChat = useCallback(async (isReset = false) => {
    setIsLoading(true);
    if (isReset) {
      setMessages([]);
      setChatSession(null);
    }
    
    try {
      const apiKey = await getDecryptedKey(engineConfig.gemini.apiKey || "");
      if (!apiKey) throw new Error("API key missing");

      const ai = new GoogleGenAI({ apiKey });
      const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: getSystemPrompt(),
          temperature: 0.7,
        }
      });
      setChatSession(chat);
      setStatus('active');
      
      // Start conversation
      const response = await chat.sendMessage({ message: "Hello! I'm ready to start." });
      setMessages([{ role: 'model', content: response.text || "Let's begin." }]);
    } catch (error) {
      console.error("Error initializing chat:", error);
      setMessages([{ role: 'model', content: "Sorry, there was an error starting the session. Please check your API key." }]);
      setStatus('idle');
    }
    setIsLoading(false);
  }, [toolId, engineConfig.gemini.apiKey]);

  useEffect(() => {
    if (engineConfig.gemini.apiKey && status === 'idle') {
      initChat();
    } else if (!engineConfig.gemini.apiKey) {
      setMessages([{ role: 'model', content: "Please configure your Gemini API key in Settings to use this feature." }]);
    }
  }, [toolId, engineConfig.gemini.apiKey, status, initChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !chatSession || isLoading || status !== 'active') return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const response = await chatSession.sendMessage({ message: userMsg });
      if (status === 'active') { // Only add if still active (not paused/completed while waiting)
        setMessages(prev => [...prev, { role: 'model', content: response.text || "" }]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [...prev, { role: 'model', content: "Sorry, I encountered an error processing your response." }]);
    }
    setIsLoading(false);
  };

  const handlePause = () => {
    setStatus(prev => prev === 'active' ? 'paused' : 'active');
  };

  const handleComplete = () => {
    setStatus('completed');
    setMessages(prev => [...prev, { role: 'model', content: "Conversation marked as completed. You can start a new one anytime." }]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-h-[800px] relative">
      <div className={`flex items-center justify-between mb-6 p-4 -mx-4 border-b ${isDarkMode ? 'bg-[#141414] border-white/5' : 'bg-white border-black/5'}`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            <div className="flex items-center gap-2">
              <p className="text-xs opacity-70">Powered by Gemini 1.5 Pro</p>
              <div className={`w-1.5 h-1.5 rounded-full ${
                status === 'active' ? 'bg-emerald-500 animate-pulse' : 
                status === 'paused' ? 'bg-amber-500' : 
                status === 'completed' ? 'bg-blue-500' : 'bg-gray-500'
              }`} />
              <span className="text-[10px] uppercase tracking-widest font-bold opacity-40">{status}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status !== 'completed' && (
            <button
              onClick={handlePause}
              disabled={isLoading || status === 'idle'}
              className={`p-2 rounded-lg transition-all ${
                isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'
              } ${status === 'paused' ? 'text-amber-500 bg-amber-500/10' : ''}`}
              title={status === 'paused' ? "Resume" : "Pause"}
            >
              {status === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
          )}
          
          <button
            onClick={() => initChat(true)}
            className={`p-2 rounded-lg transition-all ${
              isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'
            }`}
            title="Start New Conversation"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {status !== 'completed' && (
            <button
              onClick={handleComplete}
              disabled={status === 'idle'}
              className={`p-2 rounded-lg transition-all text-emerald-500 hover:bg-emerald-500/10`}
              title="Complete Conversation"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto p-4 rounded-2xl border mb-4 space-y-4 relative ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-black/10'}`}>
        {status === 'paused' && (
          <div className="absolute inset-0 z-10 bg-black/20 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
            <div className={`px-4 py-2 rounded-full font-bold text-xs uppercase tracking-widest shadow-xl border ${
              isDarkMode ? 'bg-neutral-900 border-white/10 text-amber-500' : 'bg-white border-black/10 text-amber-600'
            }`}>
              Conversation Paused
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'user' 
                ? 'bg-emerald-500 text-black' 
                : (isDarkMode ? 'bg-white/10' : 'bg-black/10')
            }`}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={`max-w-[80%] p-3 rounded-2xl text-sm whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-emerald-500 text-black rounded-tr-sm'
                : (isDarkMode ? 'bg-neutral-800 rounded-tl-sm' : 'bg-white border rounded-tl-sm shadow-sm')
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-white/10' : 'bg-black/10'}`}>
              <Bot className="w-4 h-4" />
            </div>
            <div className={`p-3 rounded-2xl text-sm ${isDarkMode ? 'bg-neutral-800 rounded-tl-sm' : 'bg-white border rounded-tl-sm shadow-sm'}`}>
              <Loader2 className="w-4 h-4 animate-spin opacity-50" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2">
        <AutoResizeTextarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onSubmit={handleSend}
          placeholder={status === 'completed' ? "Conversation completed" : status === 'paused' ? "Conversation paused" : "Type your answer..."}
          disabled={isLoading || !chatSession || status !== 'active'}
          className={`flex-1 p-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-y ${
            isDarkMode 
              ? 'bg-white/5 border-white/10 text-white placeholder-white/30' 
              : 'bg-white border-black/10 text-black placeholder-black/30'
          } ${status !== 'active' ? 'opacity-50 cursor-not-allowed' : ''}`}
          minHeight="48px"
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim() || !chatSession || status !== 'active'}
          className="p-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black disabled:opacity-50 transition-colors h-12 mt-auto"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
