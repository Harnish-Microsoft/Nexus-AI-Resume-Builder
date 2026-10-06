/**
 * The AI model catalog: every model the app may call, and each provider's
 * primary and fallback model.
 *
 * Admins manage it in Admin Dashboard > AI Models. It is stored in Firestore at
 * config/aiModels and read by every user. builtInCatalog() is the factory
 * default, used until an admin saves a catalog and whenever the stored one
 * cannot be read. Adding a Gemini or OpenAI model is a data change, never a
 * code change.
 *
 * Every AI call runs on its provider's primary model, then - only when the admin
 * has set one - on that provider's fallback, and then stops with an error that
 * names both. Nothing else is ever substituted, and a call never crosses to the
 * other provider.
 *
 * Dependency-free: bundled by both esbuild (server) and vite (browser).
 */

export type AIProvider = "gemini" | "openai";
export const AI_PROVIDERS: readonly AIProvider[] = ["gemini", "openai"];
export const PROVIDER_LABELS: Record<AIProvider, string> = { gemini: "Gemini", openai: "OpenAI" };

/** The Optimizer's engines. */
export type EngineMode = "gemini" | "openai" | "hybrid-gemini" | "hybrid-openai";
export const ENGINE_MODES: readonly EngineMode[] = ["gemini", "openai", "hybrid-gemini", "hybrid-openai"];

export const ENGINE_LABELS: Record<EngineMode, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  "hybrid-gemini": "Hybrid Gemini",
  "hybrid-openai": "Hybrid OpenAI",
};

export const ENGINE_DESCRIPTIONS: Record<EngineMode, string> = {
  gemini: "One writing pass in your browser. Gemini only.",
  openai: "One writing pass in your browser. OpenAI only.",
  "hybrid-gemini": "Server pipeline: reads, checks and writes each role separately. Gemini only.",
  "hybrid-openai": "Server pipeline: Gemini reads and checks, OpenAI writes.",
};

export function isEngineMode(value: unknown): value is EngineMode {
  return (ENGINE_MODES as readonly unknown[]).includes(value);
}

/** What a call does. Under Hybrid OpenAI, reading and checking run on Gemini; writing runs on OpenAI. */
export type TaskKind = "analysis" | "writing";

/** The provider a call runs on: the engine's own, or under Hybrid OpenAI the one its kind of work uses. */
export function providerFor(mode: EngineMode, kind: TaskKind): AIProvider {
  if (mode === "openai") return "openai";
  if (mode === "hybrid-openai") return kind === "writing" ? "openai" : "gemini";
  return "gemini";
}

/** Every provider an engine calls. */
export function providersOf(mode: EngineMode): AIProvider[] {
  if (mode === "openai") return ["openai"];
  if (mode === "hybrid-openai") return ["gemini", "openai"];
  return ["gemini"];
}

/** Gemini thinking level. "default" sends no thinking setting, leaving the model's own default. */
export type ThinkingLevel = "default" | "minimal" | "low" | "medium" | "high";
export const THINKING_LEVELS: readonly ThinkingLevel[] = ["default", "minimal", "low", "medium", "high"];

export interface ModelPricing {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
}

export interface AIModelEntry {
  /** The provider's API model ID, e.g. "gemini-3.1-pro-preview". */
  id: string;
  provider: AIProvider;
  /** Shown in the engine panel and the header, e.g. "Gemini 3.1 Pro". */
  label: string;
  /** Gemini only; ignored for OpenAI. */
  thinking: ThinkingLevel;
  pricing?: ModelPricing;
}

export interface ProviderModels {
  /** Every call starts here. "" only when the provider has no models at all. */
  primary: string;
  /** Tried once when the primary fails. "" for none: the run then stops. */
  fallback: string;
}

export interface AIModelCatalog {
  version: 1;
  models: AIModelEntry[];
  providers: Record<AIProvider, ProviderModels>;
  /** The engine the Optimizer starts with. */
  defaultEngine: EngineMode;
  /** Gemini text-to-speech model for spoken resume feedback. */
  speechModel: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const MAX_CATALOG_MODELS = 50;

/** The factory default - a fresh copy every time, so no caller can change it for another. */
export function builtInCatalog(): AIModelCatalog {
  return {
    version: 1,
    models: [
      { id: "gemini-3.1-pro-preview", provider: "gemini", label: "Gemini 3.1 Pro", thinking: "medium", pricing: { input: 1.25, output: 5 } },
      { id: "gemini-3.6-flash", provider: "gemini", label: "Gemini 3.6 Flash", thinking: "low", pricing: { input: 0.1, output: 0.4 } },
      { id: "gemini-3.5-flash", provider: "gemini", label: "Gemini 3.5 Flash", thinking: "low", pricing: { input: 0.1, output: 0.4 } },
      { id: "gemini-3.1-flash-lite", provider: "gemini", label: "Gemini 3.1 Flash Lite", thinking: "low", pricing: { input: 0.05, output: 0.2 } },
      { id: "gpt-4o", provider: "openai", label: "GPT-4o", thinking: "default", pricing: { input: 2.5, output: 10 } },
      { id: "gpt-4o-mini", provider: "openai", label: "GPT-4o mini", thinking: "default", pricing: { input: 0.15, output: 0.6 } },
      { id: "o3-mini", provider: "openai", label: "OpenAI o3-mini", thinking: "default", pricing: { input: 1.1, output: 4.4 } },
    ],
    providers: {
      gemini: { primary: "gemini-3.1-pro-preview", fallback: "gemini-3.6-flash" },
      openai: { primary: "gpt-4o", fallback: "gpt-4o-mini" },
    },
    defaultEngine: "hybrid-gemini",
    speechModel: "gemini-3.1-flash-tts-preview",
  };
}

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

/** Gemini and OpenAI model IDs: "gemini-3.1-pro-preview", "models/...", "ft:gpt-4o-mini:org::abc". */
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:\/-]{0,99}$/;

export function isValidModelId(id: unknown): id is string {
  return typeof id === "string" && MODEL_ID.test(id);
}

function isProvider(value: unknown): value is AIProvider {
  return (AI_PROVIDERS as readonly unknown[]).includes(value);
}

function normalizePricing(value: unknown): ModelPricing | null {
  if (!value || typeof value !== "object") return null;
  const input = Number((value as Record<string, unknown>).input);
  const output = Number((value as Record<string, unknown>).output);
  return Number.isFinite(input) && Number.isFinite(output) && input >= 0 && output >= 0 ? { input, output } : null;
}

function normalizeModel(value: unknown): AIModelEntry | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const id = typeof item.id === "string" ? item.id.trim() : "";
  if (!isValidModelId(id) || !isProvider(item.provider)) return null;
  const label = typeof item.label === "string" && item.label.trim() ? item.label.trim().slice(0, 60) : id;
  const thinking = (THINKING_LEVELS as readonly unknown[]).includes(item.thinking) ? (item.thinking as ThinkingLevel) : "default";
  const pricing = normalizePricing(item.pricing);
  return { id, provider: item.provider, label, thinking, ...(pricing ? { pricing } : {}) };
}

/**
 * A usable catalog from untrusted data (Firestore, a request body, a cache).
 * Unusable models are dropped; a primary or fallback that names no listed model
 * is repaired. With no usable model at all, the built-in catalog is returned.
 * The result never holds an undefined value, so Firestore can store it as is.
 */
export function normalizeCatalog(raw: unknown): AIModelCatalog {
  const builtIn = builtInCatalog();
  if (!raw || typeof raw !== "object") return builtIn;
  const source = raw as Record<string, any>;

  const models: AIModelEntry[] = [];
  const seen = new Set<string>();
  for (const value of Array.isArray(source.models) ? source.models.slice(0, MAX_CATALOG_MODELS) : []) {
    const model = normalizeModel(value);
    // One entry per model ID, whatever the provider: an ID is never ambiguous.
    if (!model || seen.has(model.id)) continue;
    seen.add(model.id);
    models.push(model);
  }
  if (models.length === 0) return builtIn;

  const providers = {} as Record<AIProvider, ProviderModels>;
  for (const provider of AI_PROVIDERS) {
    const own = models.filter((model) => model.provider === provider).map((model) => model.id);
    const requested = source.providers && typeof source.providers === "object" ? source.providers[provider] || {} : {};
    const primary = own.includes(requested.primary) ? requested.primary : own[0] ?? "";
    const fallback = own.includes(requested.fallback) && requested.fallback !== primary ? requested.fallback : "";
    providers[provider] = { primary, fallback };
  }

  return {
    version: 1,
    models,
    providers,
    defaultEngine: isEngineMode(source.defaultEngine) ? source.defaultEngine : builtIn.defaultEngine,
    speechModel: isValidModelId(source.speechModel) ? source.speechModel : builtIn.speechModel,
    ...(typeof source.updatedAt === "string" && source.updatedAt ? { updatedAt: source.updatedAt.slice(0, 40) } : {}),
    ...(typeof source.updatedBy === "string" && source.updatedBy ? { updatedBy: source.updatedBy.slice(0, 120) } : {}),
  };
}

/** Everything that must be fixed before an admin can save this catalog. */
export function catalogProblems(catalog: AIModelCatalog): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  if (catalog.models.length === 0) problems.push("Add at least one model.");
  if (catalog.models.length > MAX_CATALOG_MODELS) problems.push(`Keep the list to ${MAX_CATALOG_MODELS} models or fewer.`);
  for (const model of catalog.models) {
    const provider = PROVIDER_LABELS[model.provider] ?? "Unknown provider";
    if (!isValidModelId(model.id)) problems.push(`"${model.id}" is not a valid model ID.`);
    if (seen.has(model.id)) problems.push(`Model "${model.id}" is listed twice. Each model ID can appear once.`);
    seen.add(model.id);
    if (!model.label.trim()) problems.push(`${provider} model "${model.id}" needs a display name.`);
  }
  for (const provider of AI_PROVIDERS) {
    const label = PROVIDER_LABELS[provider];
    const own = catalog.models.filter((model) => model.provider === provider).map((model) => model.id);
    const { primary, fallback } = catalog.providers[provider] ?? { primary: "", fallback: "" };
    if (own.length === 0) continue;
    if (!primary) problems.push(`Choose a primary ${label} model.`);
    else if (!own.includes(primary)) problems.push(`The ${label} primary "${primary}" is not in the model list.`);
    if (fallback && !own.includes(fallback)) problems.push(`The ${label} fallback "${fallback}" is not in the model list.`);
    if (fallback && fallback === primary) problems.push(`The ${label} fallback must be a different model from its primary.`);
  }
  for (const provider of providersOf(catalog.defaultEngine)) {
    if (!catalog.providers[provider]?.primary) {
      problems.push(`The default engine, ${ENGINE_LABELS[catalog.defaultEngine]}, needs at least one ${PROVIDER_LABELS[provider]} model.`);
    }
  }
  if (!isValidModelId(catalog.speechModel)) problems.push("The speech model ID is not valid.");
  return problems;
}

/* ------------------------------------------------------------------ *
 * Lookups
 * ------------------------------------------------------------------ */

export function findModel(catalog: AIModelCatalog, id: string, provider?: AIProvider): AIModelEntry | undefined {
  return catalog.models.find((model) => model.id === id && (!provider || model.provider === provider));
}

export function modelLabel(catalog: AIModelCatalog, id: string, provider?: AIProvider): string {
  return findModel(catalog, id, provider)?.label ?? id ?? "";
}

/** Thinking is a Gemini setting, so only a Gemini entry's counts. */
export function thinkingFor(catalog: AIModelCatalog, id: string): ThinkingLevel {
  return findModel(catalog, id, "gemini")?.thinking ?? "default";
}

export function pricingFor(catalog: AIModelCatalog, id: string, provider?: AIProvider): ModelPricing | null {
  return findModel(catalog, id, provider)?.pricing ?? null;
}

/**
 * The models a call runs on, in order: the provider's primary, then its fallback
 * when one is set. Fast mode starts with the fallback - normally the quicker
 * model - and keeps the primary as its fallback.
 */
export function modelChain(catalog: AIModelCatalog, provider: AIProvider, options: { fast?: boolean } = {}): string[] {
  const { primary, fallback } = catalog.providers[provider] ?? { primary: "", fallback: "" };
  const chain = options.fast && fallback ? [fallback, primary] : [primary, fallback];
  return chain.filter((id, index) => Boolean(id) && chain.indexOf(id) === index);
}

export interface EngineRoute {
  /** What this provider does under the engine. */
  work: string;
  provider: AIProvider;
  primary: string;
  fallback: string;
}

/** What an engine runs on, for display: one row per provider it calls. */
export function engineRoutes(catalog: AIModelCatalog, mode: EngineMode): EngineRoute[] {
  if (mode === "hybrid-openai") {
    return [
      { work: "Writing", provider: "openai", ...catalog.providers.openai },
      { work: "Reading and checks", provider: "gemini", ...catalog.providers.gemini },
    ];
  }
  const provider: AIProvider = mode === "openai" ? "openai" : "gemini";
  return [{ work: "Every step", provider, ...catalog.providers[provider] }];
}

/* ------------------------------------------------------------------ *
 * Running a chain
 * ------------------------------------------------------------------ */

export interface ModelAttemptFailure {
  model: string;
  error: string;
}

function shortError(error: unknown): string {
  let message = error instanceof Error ? error.message : String(error ?? "unknown error");
  try {
    const parsed = message.trim().startsWith("{") ? JSON.parse(message) : null;
    if (parsed?.error?.message) message = String(parsed.error.message);
  } catch {
    // Not JSON: keep the message as it is.
  }
  message = message.replace(/\s+/g, " ").trim();
  return message.length > 220 ? `${message.slice(0, 217)}...` : message || "unknown error";
}

export function describeChainFailure(provider: AIProvider, attempts: ModelAttemptFailure[]): string {
  const label = PROVIDER_LABELS[provider] ?? provider;
  if (attempts.length === 0) {
    return `No ${label} model is configured. An admin can set one in Admin Dashboard > AI Models.`;
  }
  const failures = attempts.map((attempt) => `${attempt.model} failed (${attempt.error})`).join(", then ");
  const tail = attempts.length === 1 ? " No fallback model is set, so the run stopped." : " The run stopped.";
  return `${label}: ${failures}.${tail}`;
}

/** Every model of a chain failed: the run stops here, naming each model and why. */
export class ModelChainError extends Error {
  readonly provider: AIProvider;
  readonly attempts: ModelAttemptFailure[];

  constructor(provider: AIProvider, attempts: ModelAttemptFailure[]) {
    super(describeChainFailure(provider, attempts));
    this.name = "ModelChainError";
    this.provider = provider;
    this.attempts = attempts;
  }
}

export function isModelChainError(error: unknown): error is ModelChainError {
  return error instanceof ModelChainError || (error instanceof Error && error.name === "ModelChainError");
}

/**
 * Runs `attempt` on each model in order and returns the first answer with the
 * model that gave it. When every model fails, throws a ModelChainError.
 */
export async function runModelChain<T>(
  provider: AIProvider,
  models: string[],
  attempt: (model: string) => Promise<T>
): Promise<{ value: T; model: string }> {
  const failures: ModelAttemptFailure[] = [];
  for (const model of models) {
    try {
      return { value: await attempt(model), model };
    } catch (error) {
      failures.push({ model, error: shortError(error) });
    }
  }
  throw new ModelChainError(provider, failures);
}
