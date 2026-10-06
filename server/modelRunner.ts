/**
 * AI calls for one server request, strictly on the admins' models.
 *
 * Every call runs on its provider's primary model, then on the fallback when
 * one is set, and then stops with a ModelChainError naming both
 * (src/lib/aiModels.ts). Nothing else is substituted and a call never crosses
 * to the other provider. The runner totals tokens per provider and per model,
 * and records which models answered, for the response and the usage logs.
 */
import { GoogleGenAI, ThinkingLevel as GeminiThinkingLevel } from "@google/genai";
import OpenAI from "openai";
import {
  AI_PROVIDERS,
  builtInCatalog,
  modelChain,
  normalizeCatalog,
  providerFor,
  runModelChain,
  thinkingFor,
} from "../src/lib/aiModels";
import type { AIModelCatalog, AIProvider, EngineMode, TaskKind } from "../src/lib/aiModels";

export interface TokenUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

export function emptyUsage(): TokenUsage {
  return { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
}

export function addUsage(total: TokenUsage, usage: Partial<TokenUsage> | null | undefined): void {
  total.promptTokenCount += usage?.promptTokenCount || 0;
  total.candidatesTokenCount += usage?.candidatesTokenCount || 0;
  total.totalTokenCount += usage?.totalTokenCount || 0;
}

export interface ModelCallResult {
  text: string;
  usage: TokenUsage;
  model: string;
  provider: AIProvider;
}

export interface ModelCallOptions {
  /** Ask for a JSON answer. On by default. */
  json?: boolean;
  /** Instructions sent ahead of the prompt (OpenAI system message, Gemini system instruction). */
  system?: string;
}

export interface ModelRunnerKeys {
  gemini?: string;
  openai?: string;
}

/**
 * The catalog a request runs on. The browser sends the admins' catalog; a
 * provider's models are taken from it only when the user calls that provider
 * with their own key. On the platform's key, the built-in models always apply.
 */
export function requestCatalog(raw: unknown, ownKeys: Partial<Record<AIProvider, boolean>>): AIModelCatalog {
  const builtIn = builtInCatalog();
  const requested = raw ? normalizeCatalog(raw) : builtIn;
  const catalog: AIModelCatalog = { ...requested, models: [...requested.models], providers: { ...requested.providers } };
  for (const provider of AI_PROVIDERS) {
    if (ownKeys[provider]) continue;
    // The platform's key runs only on the built-in models with their built-in settings,
    // and no requested entry may reuse one of their IDs.
    const builtInModels = builtIn.models.filter((model) => model.provider === provider);
    const builtInIds = new Set(builtInModels.map((model) => model.id));
    catalog.models = catalog.models
      .filter((model) => model.provider !== provider && !builtInIds.has(model.id))
      .concat(builtInModels);
    catalog.providers[provider] = { ...builtIn.providers[provider] };
    if (provider === "gemini") catalog.speechModel = builtIn.speechModel;
  }
  // A requested route whose model was dropped above moves to its provider's first model.
  for (const provider of AI_PROVIDERS) {
    const own = catalog.models.filter((model) => model.provider === provider).map((model) => model.id);
    const { primary: requestedPrimary, fallback } = catalog.providers[provider];
    const primary = own.includes(requestedPrimary) ? requestedPrimary : own[0] ?? "";
    catalog.providers[provider] = { primary, fallback: own.includes(fallback) && fallback !== primary ? fallback : "" };
  }
  return catalog;
}

const GEMINI_THINKING: Record<string, GeminiThinkingLevel> = {
  minimal: GeminiThinkingLevel.MINIMAL,
  low: GeminiThinkingLevel.LOW,
  medium: GeminiThinkingLevel.MEDIUM,
  high: GeminiThinkingLevel.HIGH,
};

export class ModelRunner {
  /** Tokens used so far, per provider. */
  readonly usage: Record<AIProvider, TokenUsage> = { gemini: emptyUsage(), openai: emptyUsage() };
  private readonly byModel = new Map<string, { model: string; provider: AIProvider; usage: TokenUsage }>();
  private geminiClient: GoogleGenAI | null = null;
  private openaiClient: OpenAI | null = null;

  constructor(
    readonly catalog: AIModelCatalog,
    readonly mode: EngineMode,
    private readonly keys: ModelRunnerKeys
  ) {}

  /** The provider this engine uses for a kind of work. */
  providerFor(kind: TaskKind): AIProvider {
    return providerFor(this.mode, kind);
  }

  /** One call on the engine's provider for this kind of work. */
  call(prompt: string, kind: TaskKind, options: ModelCallOptions = {}): Promise<ModelCallResult> {
    return this.callProvider(this.providerFor(kind), prompt, options);
  }

  /** One call on a provider: its primary, then its fallback, then a ModelChainError. */
  async callProvider(provider: AIProvider, prompt: string, options: ModelCallOptions = {}): Promise<ModelCallResult> {
    const { value } = await this.run(provider, (model) => this.text(provider, model, prompt, options));
    return value;
  }

  /**
   * A call whose answer must parse. An answer `parse` rejects (null or a throw)
   * counts as that model failing, so the fallback is tried.
   */
  async callParsed<T>(
    prompt: string,
    kind: TaskKind,
    parse: (text: string) => T | null | undefined,
    options: ModelCallOptions = {}
  ): Promise<{ data: T; result: ModelCallResult }> {
    const provider = this.providerFor(kind);
    const { value } = await this.run(provider, async (model) => {
      const result = await this.text(provider, model, prompt, options);
      const data = parse(result.text);
      if (data === null || data === undefined) throw new Error("the answer was not in the expected format");
      return { ...result, data };
    });
    const { data, ...result } = value;
    return { data, result };
  }

  /**
   * Runs `attempt` on a provider's chain - for calls that need their own request
   * shape (images, speech). Return `usage` in the value to have it counted.
   */
  async run<T extends { usage?: Partial<TokenUsage> | null }>(
    provider: AIProvider,
    attempt: (model: string) => Promise<T>,
    models: string[] = modelChain(this.catalog, provider)
  ): Promise<{ value: T; model: string }> {
    const outcome = await runModelChain(provider, models, attempt);
    this.record(provider, outcome.model, outcome.value?.usage);
    return outcome;
  }

  /** The Gemini client, on the user's key or, without one, the platform's. */
  gemini(): GoogleGenAI {
    if (!this.geminiClient) this.geminiClient = new GoogleGenAI(this.keys.gemini ? { apiKey: this.keys.gemini } : {});
    return this.geminiClient;
  }

  /** The thinking setting the admin chose for a Gemini model; nothing for "default". */
  geminiThinking(model: string): { thinkingConfig?: { thinkingLevel: GeminiThinkingLevel } } {
    const level = GEMINI_THINKING[thinkingFor(this.catalog, model)];
    return level ? { thinkingConfig: { thinkingLevel: level } } : {};
  }

  /** Every model that answered, in the order first used. */
  modelsUsed(): string[] {
    return Array.from(new Set(Array.from(this.byModel.values()).map((entry) => entry.model)));
  }

  /** Tokens per model, for the usage logs. */
  usageByModel(): Array<{ model: string; provider: AIProvider; usage: TokenUsage }> {
    return Array.from(this.byModel.values()).map((entry) => ({ ...entry, usage: { ...entry.usage } }));
  }

  private record(provider: AIProvider, model: string, usage: Partial<TokenUsage> | null | undefined): void {
    addUsage(this.usage[provider], usage);
    const key = `${provider}:${model}`;
    const entry = this.byModel.get(key) ?? { model, provider, usage: emptyUsage() };
    addUsage(entry.usage, usage);
    this.byModel.set(key, entry);
  }

  /** One call to one model. Protected so tests can script answers without a network. */
  protected text(provider: AIProvider, model: string, prompt: string, options: ModelCallOptions): Promise<ModelCallResult> {
    return provider === "openai" ? this.openaiText(model, prompt, options) : this.geminiText(model, prompt, options);
  }

  private async geminiText(model: string, prompt: string, options: ModelCallOptions): Promise<ModelCallResult> {
    const response = await this.gemini().models.generateContent({
      model,
      contents: prompt,
      config: {
        ...(options.json === false ? {} : { responseMimeType: "application/json" }),
        ...(options.system ? { systemInstruction: options.system } : {}),
        ...this.geminiThinking(model),
      },
    });
    const text = response.text || "";
    if (!text.trim()) throw new Error("the model returned an empty answer");
    const usage = response.usageMetadata;
    return {
      text,
      usage: {
        promptTokenCount: usage?.promptTokenCount || 0,
        candidatesTokenCount: usage?.candidatesTokenCount || 0,
        totalTokenCount: usage?.totalTokenCount || 0,
      },
      model,
      provider: "gemini",
    };
  }

  private async openaiText(model: string, prompt: string, options: ModelCallOptions): Promise<ModelCallResult> {
    if (!this.keys.openai) throw new Error("no OpenAI API key is saved in your profile");
    if (!this.openaiClient) this.openaiClient = new OpenAI({ apiKey: this.keys.openai });
    // OpenAI's JSON mode requires the word "JSON" in the messages; every JSON prompt here has it.
    const json = options.json !== false && /json/i.test(`${options.system || ""} ${prompt}`);
    const completion = await this.openaiClient.chat.completions.create({
      model,
      messages: [
        ...(options.system ? [{ role: "system" as const, content: options.system }] : []),
        { role: "user" as const, content: prompt },
      ],
      ...(json ? { response_format: { type: "json_object" as const } } : {}),
    });
    const text = completion.choices[0]?.message?.content || "";
    if (!text.trim()) throw new Error("the model returned an empty answer");
    const input = completion.usage?.prompt_tokens || 0;
    const output = completion.usage?.completion_tokens || 0;
    return {
      text,
      usage: { promptTokenCount: input, candidatesTokenCount: output, totalTokenCount: completion.usage?.total_tokens || input + output },
      model,
      provider: "openai",
    };
  }
}
