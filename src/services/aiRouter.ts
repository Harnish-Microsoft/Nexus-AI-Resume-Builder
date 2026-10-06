import { EngineConfig } from './geminiService';
import { isEngineMode, providerFor } from '../lib/aiModels';
import type { EngineMode } from '../lib/aiModels';
import { getModelCatalog } from './modelCatalog';

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
  | 'optimize_about'
  | 'linkedin_top_choice'
  | 'classify_role'
  | 'rank_resumes';

export interface RouterConfig {
  /** The selected engine ("production" is the legacy name of Hybrid Gemini). */
  mode: EngineMode | 'production';
  geminiConfig: EngineConfig;
  openaiConfig: EngineConfig;
}

/** Tasks that write for the reader. Under Hybrid OpenAI these run on OpenAI; everything else reads or checks, on Gemini. */
const WRITING_TASKS = new Set<TaskType>(['rewrite_resume', 'cover_letter', 'recruiter_simulation', 'linkedin_analysis']);

/**
 * The provider and model a task runs on. Gemini and Hybrid Gemini use Gemini for
 * everything, OpenAI uses OpenAI for everything, and Hybrid OpenAI splits the
 * work. The model is always the provider's primary from the admins' catalog;
 * callAI adds the fallback.
 */
export function routeTask(task: TaskType, config: RouterConfig): EngineConfig {
  const mode: EngineMode = isEngineMode(config.mode) ? config.mode : 'hybrid-gemini';
  const provider = providerFor(mode, WRITING_TASKS.has(task) ? 'writing' : 'analysis');
  const engineConfig = provider === 'gemini' ? config.geminiConfig : config.openaiConfig;
  const model = getModelCatalog().providers[provider].primary;
  console.log(`[Router] Task: ${task} → ${provider} (${model || 'no model configured'})`);
  return { ...engineConfig, engine: provider, model };
}
