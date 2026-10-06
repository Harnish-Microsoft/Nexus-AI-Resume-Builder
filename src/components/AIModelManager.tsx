import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Cpu, Loader2, Plus, RefreshCw, RotateCcw, Save, Trash2, Undo2, Zap } from 'lucide-react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '../firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  AI_PROVIDERS,
  ENGINE_DESCRIPTIONS,
  ENGINE_LABELS,
  ENGINE_MODES,
  MAX_CATALOG_MODELS,
  PROVIDER_LABELS,
  THINKING_LEVELS,
  builtInCatalog,
  catalogProblems,
  isModelChainError,
  isValidModelId,
} from '../lib/aiModels';
import type { AIModelCatalog, AIModelEntry, AIProvider, EngineMode, ThinkingLevel } from '../lib/aiModels';
import { loadModelCatalog, saveModelCatalog, useModelCatalogState } from '../services/modelCatalog';

interface AIModelManagerProps {
  isDarkMode: boolean;
  /** Admins edit; anyone else sees the catalog read-only. */
  canEdit: boolean;
  /** Sends a tiny prompt to exactly this model, at the form's thinking level, with no fallback. Resolves with the reply time in ms. */
  onTestModel: (provider: AIProvider, model: string, thinking?: ThinkingLevel) => Promise<number>;
}

const THINKING_LABELS: Record<ThinkingLevel, string> = {
  default: 'Model default',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

type TestState = { status: 'running' } | { status: 'ok'; ms: number } | { status: 'failed'; error: string };

const NEW_MODEL = { provider: 'gemini' as AIProvider, id: '', label: '', thinking: 'low' as ThinkingLevel, input: '', output: '' };

function clone(catalog: AIModelCatalog): AIModelCatalog {
  return JSON.parse(JSON.stringify(catalog));
}

/** The same models and settings, whoever saved them and whenever. */
function sameCatalog(a: AIModelCatalog, b: AIModelCatalog): boolean {
  const essentials = (c: AIModelCatalog) => JSON.stringify([c.models, c.providers, c.defaultEngine, c.speechModel]);
  return essentials(a) === essentials(b);
}

function price(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

/** A price field that commits when it loses focus, so a half-typed number is never rewritten. */
const PriceInput: React.FC<{
  value: number | undefined;
  onCommit: (value: number | undefined) => void;
  disabled: boolean;
  className: string;
  label: string;
}> = ({ value, onCommit, disabled, className, label }) => {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  useEffect(() => setText(value === undefined ? '' : String(value)), [value]);
  return (
    <input
      type="number"
      min={0}
      step="0.01"
      aria-label={label}
      placeholder="-"
      value={text}
      disabled={disabled}
      className={className}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(price(text))}
    />
  );
};

/**
 * Admin Dashboard > AI Models: the models every user's AI calls run on. Each
 * provider has a primary and an optional fallback; a call runs on the primary,
 * then once on the fallback, then stops with an error naming both. Saved to
 * Firestore (config/aiModels), so a new model is a few clicks, never a code change.
 */
export const AIModelManager: React.FC<AIModelManagerProps> = ({ isDarkMode, canEdit, onTestModel }) => {
  const { catalog, source, error } = useModelCatalogState();
  const [draft, setDraft] = useState<AIModelCatalog>(() => clone(catalog));
  const lastCatalog = useRef(catalog);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [newModel, setNewModel] = useState(NEW_MODEL);
  const [addError, setAddError] = useState<string | null>(null);
  const [account, setAccount] = useState(() => ({
    email: auth.currentUser?.email,
    verified: auth.currentUser?.emailVerified ?? false,
  }));

  useEffect(() => onIdTokenChanged(auth, (user) => {
    setAccount({ email: user?.email, verified: user?.emailVerified ?? false });
  }), []);

  useEffect(() => {
    // A newer catalog (read from Firestore, or saved in another tab) replaces a draft nobody has touched.
    if (sameCatalog(draft, lastCatalog.current)) setDraft(clone(catalog));
    lastCatalog.current = catalog;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog]);

  const dirty = !sameCatalog(draft, catalog);
  const problems = useMemo(() => catalogProblems(draft), [draft]);
  const locked = !canEdit || saving;

  const panel = `p-6 rounded-xl shadow-sm border transition-colors ${isDarkMode ? 'bg-neutral-900 border-white/10' : 'bg-white border-gray-100'}`;
  const field = `w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60 ${
    isDarkMode ? 'bg-neutral-950 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
  }`;
  const muted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const button = `inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed`;
  const secondaryButton = `${button} ${isDarkMode ? 'bg-white/5 hover:bg-white/10 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`;

  const update = (change: (next: AIModelCatalog) => void) => {
    setDraft((prev) => {
      const next = clone(prev);
      change(next);
      return next;
    });
    setMessage(null);
  };

  const rolesOf = (model: AIModelEntry): string[] => {
    const { primary, fallback } = draft.providers[model.provider];
    return [model.id === primary ? 'Primary' : '', model.id === fallback ? 'Fallback' : ''].filter(Boolean);
  };

  const chooseModel = (provider: AIProvider, role: 'primary' | 'fallback', id: string) =>
    update((next) => {
      next.providers[provider][role] = id;
      if (role === 'primary' && next.providers[provider].fallback === id) {
        next.providers[provider].fallback = '';
      }
    });

  const setPrice = (index: number, side: 'input' | 'output', value: number | undefined) =>
    update((next) => {
      const model = next.models[index];
      const pricing = { input: model.pricing?.input, output: model.pricing?.output, [side]: value };
      if (pricing.input === undefined && pricing.output === undefined) delete model.pricing;
      else model.pricing = { input: pricing.input ?? 0, output: pricing.output ?? 0 };
    });

  const addModel = () => {
    const id = newModel.id.trim();
    if (!isValidModelId(id)) {
      setAddError("Enter the provider's exact model ID, such as gemini-3.6-flash or gpt-4o-mini (letters, numbers and . _ : / -).");
      return;
    }
    if (draft.models.some((model) => model.id === id)) {
      setAddError(`"${id}" is already in the list. Each model ID can appear once.`);
      return;
    }
    if (draft.models.length >= MAX_CATALOG_MODELS) {
      setAddError(`Keep the list to ${MAX_CATALOG_MODELS} models or fewer.`);
      return;
    }
    const input = price(newModel.input);
    const output = price(newModel.output);
    update((next) => {
      next.models.push({
        id,
        provider: newModel.provider,
        label: (newModel.label.trim() || id).slice(0, 60),
        thinking: newModel.provider === 'gemini' ? newModel.thinking : 'default',
        ...(input !== undefined || output !== undefined ? { pricing: { input: input ?? 0, output: output ?? 0 } } : {}),
      });
      // A provider's first model becomes its primary.
      if (!next.providers[newModel.provider].primary) next.providers[newModel.provider].primary = id;
    });
    setNewModel({ ...NEW_MODEL, provider: newModel.provider });
    setAddError(null);
  };

  const testModel = async (model: AIModelEntry) => {
    const key = `${model.provider}:${model.id}`;
    setTests((prev) => ({ ...prev, [key]: { status: 'running' } }));
    try {
      const ms = await onTestModel(model.provider, model.id, model.provider === 'gemini' ? model.thinking : undefined);
      setTests((prev) => ({ ...prev, [key]: { status: 'ok', ms } }));
    } catch (e: any) {
      const detail = isModelChainError(e) && Array.isArray(e.attempts) && e.attempts[0]?.error ? e.attempts[0].error : e?.message || String(e);
      setTests((prev) => ({ ...prev, [key]: { status: 'failed', error: detail } }));
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const saved = await saveModelCatalog(draft);
      setDraft(clone(saved));
      setMessage({ kind: 'ok', text: 'Saved shared model settings. Server requests using platform keys still use built-in models.' });
    } catch (e: any) {
      setMessage({ kind: 'error', text: e?.message || 'The models could not be saved.' });
    } finally {
      setSaving(false);
    }
  };

  const reload = async () => {
    setReloading(true);
    await loadModelCatalog();
    setReloading(false);
  };

  const statusText =
    source === 'firestore'
      ? `Live for every user${catalog.updatedBy ? `, last saved by ${catalog.updatedBy}` : ''}${
          catalog.updatedAt ? ` on ${new Date(catalog.updatedAt).toLocaleString()}` : ''
        }.`
      : source === 'cache'
        ? 'Showing the copy last read on this device; the saved catalog could not be read just now.'
        : 'Built-in defaults: no catalog has been saved yet (or Firestore could not be read).';

  return (
    <div className="space-y-6">
      {/* How it works and where the catalog came from */}
      <div className={panel}>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Cpu className="w-5 h-5 text-emerald-500" /> AI models
            </h2>
            <p className={`text-sm mt-1 max-w-3xl ${muted}`}>
              Calls using this catalog run on their provider's <strong>primary</strong> model. If that fails, the <strong>fallback</strong>{' '}
              runs once; if it fails too, or no fallback is set, the run stops and says which models failed and why.
              Nothing else is ever substituted. To use a new model, add its exact model ID below, test it, choose it, and save.
            </p>
            <p className={`text-xs mt-3 ${source === 'firestore' ? 'text-emerald-500' : 'text-amber-500'}`}>{statusText}</p>
            {error && <p className="text-xs mt-1 text-amber-500">{error}</p>}
            {!canEdit && <p className={`text-xs mt-1 ${muted}`}>Only admins can change the models.</p>}
            <p className={`text-xs mt-2 ${muted}`}>
              Server requests using the app's shared API keys still use built-in models, not these selections.
            </p>
          </div>
          <button onClick={reload} disabled={reloading} className={secondaryButton} title="Read the saved catalog again">
            <RefreshCw className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} /> Reload
          </button>
        </div>
      </div>

      {canEdit && (
        <div className={panel}>
          <h3 className="font-semibold">Save access and Firebase setup</h3>
          <p className={`text-sm mt-2 ${muted}`}>
            Signed in as <strong>{account.email || 'not signed in'}</strong>.
            {' '}Email {account.verified ? 'verified' : 'not verified'}.
          </p>
          <p className={`text-sm mt-2 ${muted}`}>
            Publish the repository's <code>firestore.rules</code> in Firebase project{' '}
            <strong>{firebaseConfig.projectId}</strong>, database <code>{firebaseConfig.firestoreDatabaseId}</code>.
            This is a named database, not <code>(default)</code>. Keep the verified-admin write restriction.
          </p>
          <a
            href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/rules`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-sm font-semibold text-emerald-500 underline"
          >
            Open Firebase rules
          </a>
        </div>
      )}

      {/* Primary and fallback per provider */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {AI_PROVIDERS.map((provider) => {
          const own = draft.models.filter((model) => model.provider === provider);
          const { primary, fallback } = draft.providers[provider];
          return (
            <div key={provider} className={panel}>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" /> {PROVIDER_LABELS[provider]}
              </h3>
              <p className={`text-xs mb-4 ${muted}`}>
                {canEdit ? 'Choose models in the dropdowns below, or use the model list buttons. Changes apply only after saving.' : 'Read-only: sign in as an admin to choose models.'}
              </p>
              {own.length === 0 ? (
                <p className={`text-sm ${muted}`}>No {PROVIDER_LABELS[provider]} models yet. Add one below.</p>
              ) : (
                <div className="space-y-4">
                  <label className="block">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Primary: every call starts here</span>
                    <span className="relative block mt-1">
                    <select
                      className={`${field} appearance-none pr-10 cursor-pointer disabled:cursor-not-allowed`}
                      aria-label={`${PROVIDER_LABELS[provider]} primary model`}
                      value={primary}
                      disabled={locked}
                      onChange={(e) => chooseModel(provider, 'primary', e.target.value)}
                    >
                      {own.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.label} ({model.id})
                        </option>
                      ))}
                    </select>
                    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" />
                    </span>
                  </label>
                  <label className="block">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Fallback: used once if the primary fails</span>
                    <span className="relative block mt-1">
                    <select
                      className={`${field} appearance-none pr-10 cursor-pointer disabled:cursor-not-allowed`}
                      aria-label={`${PROVIDER_LABELS[provider]} fallback model`}
                      value={fallback}
                      disabled={locked}
                      onChange={(e) => chooseModel(provider, 'fallback', e.target.value)}
                    >
                      <option value="">None: stop if the primary fails</option>
                      {own
                        .filter((model) => model.id !== primary)
                        .map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.label} ({model.id})
                          </option>
                        ))}
                    </select>
                    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" />
                    </span>
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* App defaults */}
      <div className={panel}>
        <h3 className="font-semibold mb-4">Defaults</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <label className="block">
            <span className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Engine the Optimizer starts with</span>
            <select
              className={`${field} mt-1`}
              value={draft.defaultEngine}
              disabled={locked}
              onChange={(e) => update((next) => { next.defaultEngine = e.target.value as EngineMode; })}
            >
              {ENGINE_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {ENGINE_LABELS[mode]}
                </option>
              ))}
            </select>
            <span className={`text-xs mt-1 block ${muted}`}>{ENGINE_DESCRIPTIONS[draft.defaultEngine]} Users can still switch engines for their session.</span>
          </label>
          <label className="block">
            <span className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Speech model (spoken feedback)</span>
            <input
              className={`${field} mt-1 font-mono`}
              value={draft.speechModel}
              disabled={locked}
              onChange={(e) => update((next) => { next.speechModel = e.target.value.trim(); })}
            />
            <span className={`text-xs mt-1 block ${muted}`}>A Gemini text-to-speech model ID. It has no fallback.</span>
          </label>
        </div>
      </div>

      {/* The model list */}
      <div className={panel}>
        <h3 className="font-semibold mb-1">Models</h3>
        <p className={`text-xs mb-4 ${muted}`}>
          Thinking applies to Gemini models. Prices are USD per 1M tokens, used for the cost figures in Analytics. Test sends a
          one-word prompt to exactly that model with your own key, and never uses a fallback.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-left text-xs uppercase tracking-wide ${muted}`}>
                <th className="py-2 pr-3">Provider</th>
                <th className="py-2 pr-3">Model ID</th>
                <th className="py-2 pr-3">Display name</th>
                <th className="py-2 pr-3">Thinking</th>
                <th className="py-2 pr-3">Price in / out</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {draft.models.map((model, index) => {
                const roles = rolesOf(model);
                const test = tests[`${model.provider}:${model.id}`];
                return (
                  <tr key={`${model.provider}:${model.id}`} className={`border-t align-top ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
                    <td className="py-2 pr-3 whitespace-nowrap">{PROVIDER_LABELS[model.provider]}</td>
                    <td className="py-2 pr-3 font-mono text-xs break-all">{model.id}</td>
                    <td className="py-2 pr-3 min-w-[10rem]">
                      <input
                        className={field}
                        value={model.label}
                        maxLength={60}
                        disabled={locked}
                        aria-label={`Display name for ${model.id}`}
                        onChange={(e) => update((next) => { next.models[index].label = e.target.value; })}
                      />
                    </td>
                    <td className="py-2 pr-3 min-w-[8rem]">
                      {model.provider === 'gemini' ? (
                        <select
                          className={field}
                          value={model.thinking}
                          disabled={locked}
                          aria-label={`Thinking for ${model.id}`}
                          onChange={(e) => update((next) => { next.models[index].thinking = e.target.value as ThinkingLevel; })}
                        >
                          {THINKING_LEVELS.map((level) => (
                            <option key={level} value={level}>
                              {THINKING_LABELS[level]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-xs ${muted}`}>n/a</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-1 w-40">
                        <PriceInput
                          label={`Input price for ${model.id}`}
                          value={model.pricing?.input}
                          disabled={locked}
                          className={field}
                          onCommit={(value) => setPrice(index, 'input', value)}
                        />
                        <PriceInput
                          label={`Output price for ${model.id}`}
                          value={model.pricing?.output}
                          disabled={locked}
                          className={field}
                          onCommit={(value) => setPrice(index, 'output', value)}
                        />
                      </div>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {roles.map((role) => (
                        <span
                          key={role}
                          className={`inline-block mr-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            role === 'Primary' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'
                          }`}
                        >
                          {role}
                        </span>
                      ))}
                      {canEdit && (
                        <div className="flex flex-col items-start gap-1 mt-1">
                          <button
                            className="text-xs text-emerald-500 underline disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={locked || model.id === draft.providers[model.provider].primary}
                            aria-label={`Set ${model.id} as primary`}
                            onClick={() => chooseModel(model.provider, 'primary', model.id)}
                          >
                            Set as primary
                          </button>
                          <button
                            className="text-xs text-amber-500 underline disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={locked || roles.length > 0}
                            aria-label={`Set ${model.id} as fallback`}
                            onClick={() => chooseModel(model.provider, 'fallback', model.id)}
                          >
                            Set as fallback
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-2 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => testModel(model)}
                          disabled={test?.status === 'running'}
                          className={`${secondaryButton} px-3 py-1.5 text-xs`}
                          title="Send a one-word prompt to this model only"
                        >
                          {test?.status === 'running' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Test
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => update((next) => { next.models.splice(index, 1); })}
                            disabled={locked || roles.length > 0}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                              isDarkMode ? 'hover:bg-red-500/10 text-red-400' : 'hover:bg-red-50 text-red-600'
                            }`}
                            title={roles.length > 0 ? `In use as ${roles.join(' and ').toLowerCase()}: choose another model first` : 'Remove'}
                            aria-label={`Remove ${model.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {test?.status === 'ok' && (
                        <p className="text-xs mt-1 text-emerald-500">Answered in {(test.ms / 1000).toFixed(1)} s</p>
                      )}
                      {test?.status === 'failed' && (
                        <p className="text-xs mt-1 text-red-500 max-w-xs whitespace-normal text-left">{test.error}</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {canEdit && (
          <div className={`mt-6 pt-6 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-100'}`}>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add a model
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
              <label className="block">
                <span className={`text-xs ${muted}`}>Provider</span>
                <select
                  className={`${field} mt-1`}
                  value={newModel.provider}
                  disabled={locked}
                  onChange={(e) => setNewModel({ ...newModel, provider: e.target.value as AIProvider })}
                >
                  {AI_PROVIDERS.map((provider) => (
                    <option key={provider} value={provider}>
                      {PROVIDER_LABELS[provider]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block md:col-span-2">
                <span className={`text-xs ${muted}`}>Model ID (exactly as the provider names it)</span>
                <input
                  className={`${field} mt-1 font-mono`}
                  placeholder={newModel.provider === 'gemini' ? 'gemini-3.6-flash' : 'gpt-4o-mini'}
                  value={newModel.id}
                  disabled={locked}
                  onChange={(e) => setNewModel({ ...newModel, id: e.target.value })}
                />
              </label>
              <label className="block">
                <span className={`text-xs ${muted}`}>Display name</span>
                <input
                  className={`${field} mt-1`}
                  placeholder="Shown to users"
                  maxLength={60}
                  value={newModel.label}
                  disabled={locked}
                  onChange={(e) => setNewModel({ ...newModel, label: e.target.value })}
                />
              </label>
              <label className="block">
                <span className={`text-xs ${muted}`}>Thinking</span>
                <select
                  className={`${field} mt-1`}
                  value={newModel.provider === 'gemini' ? newModel.thinking : 'default'}
                  disabled={locked || newModel.provider !== 'gemini'}
                  onChange={(e) => setNewModel({ ...newModel, thinking: e.target.value as ThinkingLevel })}
                >
                  {THINKING_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {THINKING_LABELS[level]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-1">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={`${field} mt-1`}
                  placeholder="$ in"
                  aria-label="Input price per 1M tokens"
                  value={newModel.input}
                  disabled={locked}
                  onChange={(e) => setNewModel({ ...newModel, input: e.target.value })}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={`${field} mt-1`}
                  placeholder="$ out"
                  aria-label="Output price per 1M tokens"
                  value={newModel.output}
                  disabled={locked}
                  onChange={(e) => setNewModel({ ...newModel, output: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button onClick={addModel} disabled={locked || !newModel.id.trim()} className={secondaryButton}>
                <Plus className="w-4 h-4" /> Add to the list
              </button>
              {addError && <span className="text-xs text-red-500">{addError}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Save */}
      {canEdit && (
        <div className={`${panel} sticky bottom-4`}>
          {problems.length > 0 && (
            <ul className="mb-4 space-y-1">
              {problems.map((problem) => (
                <li key={problem} className="text-xs text-red-500 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {problem}
                </li>
              ))}
            </ul>
          )}
          {message && (
            <p className={`mb-4 text-sm flex items-center gap-2 ${message.kind === 'ok' ? 'text-emerald-500' : 'text-red-500'}`}>
              {message.kind === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />} {message.text}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={save}
              disabled={saving || !dirty || problems.length > 0}
              className={`${button} ${isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save for every user
            </button>
            <button onClick={() => { setDraft(clone(catalog)); setMessage(null); }} disabled={saving || !dirty} className={secondaryButton}>
              <Undo2 className="w-4 h-4" /> Discard changes
            </button>
            <button
              onClick={() => update((next) => Object.assign(next, clone(builtInCatalog())))}
              disabled={saving || sameCatalog(draft, builtInCatalog())}
              className={secondaryButton}
              title="Load the built-in models into the form; nothing changes until you save"
            >
              <RotateCcw className="w-4 h-4" /> Reset to built-in
            </button>
            {dirty && <span className="text-xs text-amber-500">Unsaved changes</span>}
          </div>
        </div>
      )}
    </div>
  );
};
