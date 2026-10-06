/**
 * The live AI model catalog in the browser.
 *
 * Every user reads the admins' catalog from Firestore (config/aiModels) at
 * start-up. The last copy read is cached, so the app starts on it, and the
 * built-in catalog (src/lib/aiModels.ts) stands in until anything is read.
 * Admins save changes here; every open screen updates at once.
 */

import { useSyncExternalStore } from "react";
import { ThinkingLevel as GeminiThinkingLevel } from "@google/genai";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { isAdminEmail } from "../constants";
import firebaseConfig from "../../firebase-applet-config.json";
import {
  builtInCatalog,
  catalogProblems,
  modelChain,
  normalizeCatalog,
  runModelChain,
  thinkingFor,
} from "../lib/aiModels";
import type { AIModelCatalog, AIProvider, ThinkingLevel } from "../lib/aiModels";

const CACHE_KEY = "nexus.aiModelCatalog";
const CATALOG_DOC = ["config", "aiModels"] as const;

/** firestore = read from the admins' saved catalog; cache = the last copy read; built-in = nothing saved or readable. */
export type CatalogSource = "firestore" | "cache" | "built-in";

export interface CatalogState {
  catalog: AIModelCatalog;
  source: CatalogSource;
  /** Why the saved catalog could not be read, when it could not. */
  error?: string;
}

function readCache(): AIModelCatalog | null {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(CACHE_KEY) : null;
    return raw ? normalizeCatalog(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCache(catalog: AIModelCatalog | null): void {
  try {
    if (catalog) localStorage.setItem(CACHE_KEY, JSON.stringify(catalog));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    // Storage full or blocked: the catalog still works for this session.
  }
}

let state: CatalogState = (() => {
  const cached = readCache();
  return cached ? { catalog: cached, source: "cache" } : { catalog: builtInCatalog(), source: "built-in" };
})();
const listeners = new Set<() => void>();

function setState(next: CatalogState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

export function getModelCatalog(): AIModelCatalog {
  return state.catalog;
}

export function getModelCatalogState(): CatalogState {
  return state;
}

export function subscribeModelCatalog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useModelCatalogState(): CatalogState {
  return useSyncExternalStore(subscribeModelCatalog, getModelCatalogState, getModelCatalogState);
}

export function useModelCatalog(): AIModelCatalog {
  return useModelCatalogState().catalog;
}

function friendlyFirestoreError(error: any, action: "read" | "save"): string {
  const code = String(error?.code || "");
  if (code.includes("permission-denied")) {
    return action === "save"
      ? `Firestore denied this verified admin's save. In Firebase project "${firebaseConfig.projectId}", publish firestore.rules to database "${firebaseConfig.firestoreDatabaseId}" (not the default database). See README, Firestore Rules.`
      : "Firestore rules don't allow reading the model catalog yet. Publish the updated firestore.rules (see README, Firestore Rules).";
  }
  if (code.includes("unavailable")) return "Firestore is unreachable right now.";
  return error?.message ? String(error.message) : `Could not ${action} the model catalog.`;
}

/** Reads the admins' catalog; falls back to the cached copy, then the built-in one. Never throws. */
export async function loadModelCatalog(): Promise<CatalogState> {
  try {
    const snapshot = await getDoc(doc(db, ...CATALOG_DOC));
    if (snapshot.exists()) {
      const catalog = normalizeCatalog(snapshot.data());
      writeCache(catalog);
      setState({ catalog, source: "firestore" });
    } else {
      writeCache(null);
      setState({ catalog: builtInCatalog(), source: "built-in" });
    }
  } catch (error) {
    const cached = readCache();
    setState({
      catalog: cached ?? builtInCatalog(),
      source: cached ? "cache" : "built-in",
      error: friendlyFirestoreError(error, "read"),
    });
  }
  return state;
}

/** Saves the catalog for every user. Firestore rules allow it for the admins only. */
export async function saveModelCatalog(draft: AIModelCatalog): Promise<AIModelCatalog> {
  const problems = catalogProblems(draft);
  if (problems.length > 0) throw new Error(problems.join(" "));
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in with a verified admin account before saving AI models.");
  await user.reload();
  const { claims } = await user.getIdTokenResult(true);
  if (typeof claims.email !== "string" || !isAdminEmail(claims.email)) {
    throw new Error("This account cannot save AI models. Sign in with an email listed in ADMIN_EMAILS.");
  }
  if (claims.email_verified !== true) {
    throw new Error("Your admin email is not verified. Verify your email, then try saving again.");
  }
  const catalog = normalizeCatalog({
    ...draft,
    updatedAt: new Date().toISOString(),
    updatedBy: user.email || "",
  });
  try {
    await setDoc(doc(db, ...CATALOG_DOC), catalog);
  } catch (error) {
    throw new Error(friendlyFirestoreError(error, "save"));
  }
  writeCache(catalog);
  setState({ catalog, source: "firestore" });
  return catalog;
}

/* ------------------------------------------------------------------ *
 * Helpers for code that calls the Gemini SDK directly
 * ------------------------------------------------------------------ */

const GEMINI_THINKING: Record<string, GeminiThinkingLevel> = {
  minimal: GeminiThinkingLevel.MINIMAL,
  low: GeminiThinkingLevel.LOW,
  medium: GeminiThinkingLevel.MEDIUM,
  high: GeminiThinkingLevel.HIGH,
};

/** The Gemini request setting for a thinking level; nothing for "default". */
export function geminiThinkingLevelConfig(level: ThinkingLevel): { thinkingConfig?: { thinkingLevel: GeminiThinkingLevel } } {
  const thinkingLevel = GEMINI_THINKING[level];
  return thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {};
}

/** The thinking setting the admin chose for a Gemini model; nothing for "default". */
export function geminiThinkingConfig(model: string): { thinkingConfig?: { thinkingLevel: GeminiThinkingLevel } } {
  return geminiThinkingLevelConfig(thinkingFor(getModelCatalog(), model));
}

/** The models a provider's calls run on: primary, then fallback when set. */
export function providerChain(provider: AIProvider, options: { fast?: boolean } = {}): string[] {
  return modelChain(getModelCatalog(), provider, options);
}

/**
 * Runs `attempt` on the Gemini primary, then the fallback. Throws a
 * ModelChainError naming both when neither answers.
 */
export async function withGeminiModels<T>(attempt: (model: string) => Promise<T>): Promise<T> {
  const { value } = await runModelChain("gemini", providerChain("gemini"), attempt);
  return value;
}
