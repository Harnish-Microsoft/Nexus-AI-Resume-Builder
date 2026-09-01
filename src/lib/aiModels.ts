/**
 * Single source of truth for AI model identity in the UI.
 *
 * Previously the header badge and the progress messages each hardcoded their own
 * model name ("Google Gemini 2.0", "OpenAI GPT-4o", "Gemini 3.1 Pro"). None of
 * them matched what actually ran, and the badge always said "GEMINI" even when
 * OpenAI was selected - so the UI actively misreported which engine was in use.
 *
 * The resolver below mirrors the real routing decision made by routeTask() in
 * aiRouter.ts, the fastMode override in optimizeResume(), and the model the V2
 * hybrid pipeline picks server-side. If any of those change, change this too.
 */

/** Display names for every model the app can actually run. */
export const MODEL_LABELS: Record<string, string> = {
  'gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
  'gemini-3.6-flash': 'Gemini 3.6 Flash',
  'gemini-3.5-flash': 'Gemini 3.5 Flash',
  'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
  'gemini-3-flash-preview': 'Gemini 3 Flash',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'o3-mini': 'OpenAI o3-mini',
};

/** Human label for a raw model id, falling back to the id itself. */
export function modelLabel(model?: string): string {
  if (!model) return 'Unknown model';
  return MODEL_LABELS[model] || model;
}

/** The model the V2 hybrid pipeline uses server-side (see /api/v2/optimize). */
const V2_MODEL: Record<string, string> = {
  'hybrid-openai': 'gpt-4o',
  'hybrid-gemini': 'gemini-3.1-pro-preview',
};

export interface ActiveModel {
  engine: 'gemini' | 'openai';
  model: string;
  /** e.g. "Gemini 3.1 Pro" */
  modelName: string;
  /** e.g. "Hybrid - Gemini 3.1 Pro" - what the user should see. */
  label: string;
  /** True when the request is executed by the V2 server pipeline. */
  viaHybridPipeline: boolean;
}

export interface ResolveArgs {
  selectedEngine: string;
  engineConfig: Record<string, any>;
  fastMode?: boolean;
  recruiterSimulationMode?: boolean;
}

/**
 * Works out which engine and model a resume optimization will actually use.
 * Mirrors routeTask('rewrite_resume' | 'recruiter_simulation') plus the
 * fastMode and V2-pipeline overrides applied inside optimizeResume().
 */
export function resolveActiveModel({
  selectedEngine,
  engineConfig,
  fastMode = false,
  recruiterSimulationMode = false,
}: ResolveArgs): ActiveModel {
  const geminiModel = engineConfig?.gemini?.model || 'gemini-3.6-flash';
  const openaiModel = engineConfig?.openai?.model || 'gpt-4o';
  const isHybrid = selectedEngine === 'hybrid-gemini' || selectedEngine === 'hybrid-openai';

  const build = (
    engine: 'gemini' | 'openai',
    model: string,
    viaHybridPipeline: boolean,
    prefix?: string,
  ): ActiveModel => {
    const modelName = modelLabel(model);
    return {
      engine,
      model,
      modelName,
      label: prefix ? `${prefix} - ${modelName}` : modelName,
      viaHybridPipeline,
    };
  };

  // Recruiter simulation is always routed to OpenAI, and always bypasses V2.
  if (recruiterSimulationMode) {
    if (selectedEngine === 'gemini') {
      // routeTask honours an explicit single-engine choice over the task default,
      // but then force-downgrades Gemini to flash-lite for every task except
      // rewrite_resume/cover_letter (aiRouter.ts:66).
      return build('gemini', fastMode ? 'gemini-3.6-flash' : 'gemini-3.1-flash-lite', false, 'Recruiter Simulation');
    }
    return build('openai', fastMode ? 'gpt-4o-mini' : openaiModel, false, 'Recruiter Simulation');
  }

  // Fast Mode forces the cheaper model and skips the V2 pipeline entirely.
  if (fastMode) {
    if (selectedEngine === 'openai') {
      return build('openai', 'gpt-4o-mini', false, 'Fast Mode');
    }
    // Both Gemini and either hybrid mode resolve to Gemini Flash here.
    return build('gemini', 'gemini-3.6-flash', false, 'Fast Mode');
  }

  // Hybrid modes hand the whole rewrite to the V2 server pipeline, which picks
  // its own model rather than using the one in the settings dropdown.
  if (isHybrid) {
    const model = V2_MODEL[selectedEngine] || 'gemini-3.1-pro-preview';
    const engine: 'gemini' | 'openai' = selectedEngine === 'hybrid-openai' ? 'openai' : 'gemini';
    return build(engine, model, true, 'Hybrid');
  }

  if (selectedEngine === 'openai') return build('openai', openaiModel, false);
  return build('gemini', geminiModel, false);
}
