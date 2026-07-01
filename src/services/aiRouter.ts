import { EngineConfig, EngineType } from './geminiService';

export type TaskType = 
  | 'parse_resume'
  | 'extract_job_description'
  | 'extract_skills'
  | 'ats_scoring'
  | 'rewrite_resume'
  | 'multi_audience'
  | 'recruiter_simulation'
  | 'interview_questions'
  | 'cover_letter'
  | 'recruiter_message'
  | 'evaluate_suitability'
  | 'linkedin_analysis'
  | 'optimize_headline'
  | 'optimize_about';

export interface RouterConfig {
  mode: EngineType | 'production';
  geminiConfig: EngineConfig;
  openaiConfig: EngineConfig;
}

export function routeTask(task: TaskType, config: RouterConfig): EngineConfig {
  let selectedEngine: EngineType;

  if (config.mode === 'gemini' || config.mode === 'openai') {
    selectedEngine = config.mode;
  } else {
    // Production Mode Routing Logic
    switch (task) {
      // Tasks routed to Gemini (Cost-effective & High Performance)
      case 'parse_resume':
      case 'extract_job_description':
      case 'extract_skills':
      case 'ats_scoring':
      case 'evaluate_suitability':
      case 'multi_audience':
      case 'interview_questions':
      case 'recruiter_message':
      case 'optimize_headline':
      case 'optimize_about':
      case 'rewrite_resume':
      case 'cover_letter':
        selectedEngine = 'gemini';
        break;

      // Tasks routed to OpenAI (Premium Quality & Complex Reasoning)
      case 'recruiter_simulation':
      case 'linkedin_analysis':
        selectedEngine = 'openai';
        break;
        
      default:
        // Fallback to Gemini if task is unknown
        selectedEngine = 'gemini';
    }
  }

  const engineConfig = selectedEngine === 'gemini' ? config.geminiConfig : config.openaiConfig;
  
  // USER REQUIREMENT: Use gemini-3.1-flash-lite for all tasks EXCEPT resume optimization and cover letters
  if (selectedEngine === 'gemini' && task !== 'rewrite_resume' && task !== 'cover_letter') {
    return {
      ...engineConfig,
      model: 'gemini-3.1-flash-lite'
    };
  }

  // Log the routing decision
  console.log(`[Router] Task: ${task} → Engine: ${selectedEngine} (${engineConfig.model})`);
  
  return engineConfig;
}
