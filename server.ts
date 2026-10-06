import express from "express";
import path from "path";
import puppeteer from "puppeteer";
import bodyParser from "body-parser";
import cors from "cors";
import crypto from "crypto";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import OpenAI from "openai";
import dotenv from "dotenv";
import { v4 as uuidv4 } from 'uuid';
import { google } from "googleapis";
import stream from "stream";
import fs from "fs";
import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as Optimization from "./server/optimization.ts";
import { renderResumeToHTML } from "./server/resumeTemplate.ts";
import { pipelineCache } from "./server/cacheUtility";
import { calculateCost, UsageLog } from "./server/analytics";
import { runAgents } from "./server/agents";
import { generatePerRole, roleModelCall, selectStarStories } from "./server/roleGenerator";
import { deduplicateAndScore } from "./server/dedup";
import { saveResumeVersion } from "./server/memory";
import { buildResumeGenerationPrompt, buildResumeMetaPrompt } from "./src/lib/resumePrompt";
import { applyMatchScores, focusJobDescription } from "./src/lib/matchScore";
import { applyImpactAudit } from "./src/lib/impactScore";
import { withoutExcludedTerms } from "./src/lib/exclusions";
import { analysisKeywords, applyRequirementEvidence, buildCandidateMaterial } from "./src/lib/requirementEvidence";
import type { RequirementAnalysis } from "./src/lib/requirementEvidence";
import { applyExclusionGuarantee, refreshVerificationReport, reviewAndCorrectDraft } from "./src/lib/draftReview";
import type { DraftModelCall, DraftReviewContext } from "./src/lib/draftReview";
import { buildInputCoverage } from "./src/lib/inputCoverage";
import type { InputCoverageReport } from "./src/lib/inputCoverage";
import { activeBulletRules, bulletRulesFingerprint, enforceBulletBudgets, planBulletBudgets } from "./src/lib/bulletBudget";
import type { BulletRules } from "./src/lib/bulletBudget";
import {
  activeLinkedInTrends,
  applyTrendCoverage,
  buildTrendBrief,
  describeTrendSource,
  trendEvidenceText,
  trendFingerprint,
  trendPreferTerms,
} from "./src/lib/linkedinTrends";
import type { LinkedInTrends } from "./src/lib/linkedinTrends";
import { audienceHeadline, buildAudienceBrief, normalizeAudienceMix } from "./src/lib/audienceProfiles";
import { isEngineMode, isModelChainError, isValidModelId, modelChain, pricingFor, providersOf, thinkingFor } from "./src/lib/aiModels";
import type { EngineMode } from "./src/lib/aiModels";
import { ModelRunner, requestCatalog } from "./server/modelRunner";
// import { scrapeJobs } from "./server/jobScraper";

dotenv.config();

// Initialize Firebase Admin
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
if (!fs.existsSync(firebaseConfigPath)) {
  console.error("firebase-applet-config.json not found. Skipping Firebase initialization.");
} else {
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
  
  // Safe initialization
  let app;
  try {
    app = (admin && admin.apps && Array.isArray(admin.apps) && admin.apps.length > 0)
      ? admin.apps[0]
      : admin.initializeApp({
          projectId: firebaseConfig.projectId,
        });
  } catch (err) {
    console.error("Firebase app initialization failed:", err);
    // Fallback or handle accordingly if needed
  }

  let firestoreApp;
  try {
    firestoreApp = admin.app("firestore");
  } catch {
    firestoreApp = admin.initializeApp({}, "firestore");
  }

  // Robust Firestore initialization: fallback to default database if specific ID fails or is not provided
  let db: admin.firestore.Firestore;
  try {
    const dbId = (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "")
      ? firebaseConfig.firestoreDatabaseId
      : undefined;
    db = getFirestore(firestoreApp, dbId);
  } catch (e) {
    console.warn("[Server] Failed to initialize Firestore with specified database ID, falling back to default.", e);
    db = getFirestore(firestoreApp);
  }
}

// Helper to get API keys from Firestore securely
async function getApiKeys(idToken: string) {
    if (idToken === "SYSTEM_PIPELINE" || !idToken || idToken === "undefined" || idToken === "null") return null;
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const doc = await db.collection("users").doc(uid).get();
      
      if (!doc.exists) {
        return null; // Return null instead of throwing
      }
      
      let data = doc.data();
      
      // Strictly use user-specific key. No fallback to shared admin key.
      if (!data || !data.encryptedApiKey) {
        console.log(`[Server] User ${uid} key missing in Firestore.`);
        return null;
      }
      
      console.log(`[Server] Using strictly user-specific key for ${uid}.`);

      if (!data || !data.encryptedApiKey) {
        return null; // Return null instead of throwing
      }

      // Decrypt the keys before returning
      try {
        const decrypted = decrypt(data.encryptedApiKey);
        try {
          return JSON.parse(decrypted);
        } catch (e) {
          // Fallback for older single-key format
          return { gemini: decrypted };
        }
      } catch (error: any) {
        if (error.message.includes("DECRYPTION_FAILED")) {
          console.warn(`[Server] Decryption failed for user ${uid}. Treating as no key found.`);
          return null;
        }
        return null; // Fallback to null on decryption error
      }
    } catch (error) {
      console.warn("[Server] Token verification or key fetch failed, falling back to system keys:", error instanceof Error ? error.message : String(error));
      return null;
    }
}

/**
 * Reference material from the caller's OTHER master resumes, scoped to the caller.
 *
 * These previously came from a top-level `master_resumes` collection read with
 * no user filter, so on a shared Firestore every optimization was seeded with
 * other people's resumes. A user's own resumes are synced to their user
 * document by the client (App.tsx syncAllData), which is the correct source.
 *
 * The resume currently being rewritten is excluded: it is already supplied as
 * the input document, and re-supplying it as reference material would sit under
 * an instruction telling the model not to reuse its facts.
 */
const MAX_MASTER_RESUME_REFERENCES = 5;

async function getUserMasterResumes(idToken: string, excludeResumeText = ""): Promise<any[]> {
  if (!idToken || idToken === "SYSTEM_PIPELINE" || idToken === "undefined" || idToken === "null") {
    return [];
  }
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const snapshot = await db.collection("users").doc(decodedToken.uid).get();
    const stored = snapshot.exists ? snapshot.data()?.masterResumes : null;
    if (!Array.isArray(stored)) return [];

    const excluded = String(excludeResumeText || "").trim();
    const references = stored
      .filter((entry: any) => {
        if (!entry) return false;
        if (!excluded) return true;
        try {
          return JSON.stringify(entry.data ?? entry, null, 2).trim() !== excluded;
        } catch {
          return true;
        }
      })
      .slice(0, MAX_MASTER_RESUME_REFERENCES)
      .map((entry: any) => (entry.data ? { name: entry.name, data: entry.data } : entry));

    console.log(`[Pipeline] Using ${references.length} reference resumes for user ${decodedToken.uid}.`);
    return references;
  } catch (err) {
    console.warn(
      "[Pipeline] Failed to fetch user master resumes, proceeding without them:",
      err instanceof Error ? err.message : String(err)
    );
    return [];
  }
}

// Function to log usage to Firestore
async function logUsage(log: UsageLog) {
  try {
    await db.collection("analytics").add({
      ...log,
      timestamp: FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("Error logging usage to Firestore:", error);
  }
}

// PDF Sessions storage
const pdfSessions = new Map<string, { html: string, css: string, fonts: string, title?: string, scale?: number, timestamp: number }>();

// Cleanup old sessions every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of pdfSessions.entries()) {
    if (now - session.timestamp > 1800000) { // 30 minutes
      pdfSessions.delete(id);
    }
  }
}, 600000);

// Encryption Setup
// We use a stable key derived from GEMINI_API_KEY if ENCRYPTION_KEY is not provided.
// This prevents "bad decrypt" errors after server restarts.
const getEncryptionKey = () => {
  const envKey = process.env.ENCRYPTION_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  
  if (envKey) {
    if (envKey.length === 64) {
      console.log("[Encryption] Using ENCRYPTION_KEY from environment.");
      return envKey;
    } else {
      console.warn("[Encryption] ENCRYPTION_KEY in environment is not 64 characters. Hashing it to ensure 32-byte key.");
      return crypto.createHash('sha256').update(envKey).digest('hex');
    }
  }
  
  if (geminiKey) {
    console.log("[Encryption] Deriving ENCRYPTION_KEY from GEMINI_API_KEY.");
    return crypto.createHash('sha256').update(geminiKey).digest('hex');
  }
  
  console.warn("[Encryption] No ENCRYPTION_KEY or GEMINI_API_KEY found. Using static fallback key. WARNING: Your encrypted data will be lost if you provide an API key later.");
  return "4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b"; 
};

const ENCRYPTION_KEY = getEncryptionKey();
const IV_LENGTH = 16;

function encrypt(text: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

const STATIC_FALLBACK_KEY = "4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b";

function decrypt(text: string) {
  if (!text) return "";
  if (!text.includes(':')) return text;

  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');

  const attemptDecrypt = (keyHex: string) => {
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(keyHex, 'hex'), iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } catch (e) {
      return null;
    }
  };

  // Try primary key (derived from env at start)
  let result = attemptDecrypt(ENCRYPTION_KEY);

  // If failed and primary wasn't the static one, try the static one as fallback
  if (result === null && ENCRYPTION_KEY !== STATIC_FALLBACK_KEY) {
    console.log("[Decrypt] Primary key mismatch. Attempting static fallback decryption...");
    result = attemptDecrypt(STATIC_FALLBACK_KEY);
  }

  if (result !== null) {
    return result;
  }

  console.error("Decryption Error: DECRYPTION_FAILED");
  throw new Error("DECRYPTION_FAILED: The encryption key has changed or the data is corrupted. Please re-save your API keys in your profile.");
}

/**
 * API keys sent with a request, each raw or as encrypted by /api/encrypt-key
 * (a JSON {gemini, openai} or a single key). A raw key is OpenAI's when it starts
 * with "sk-", otherwise Gemini's. The first key found for a provider wins.
 */
function requestKeys(...values: unknown[]): { gemini: string; openai: string } {
  const keys = { gemini: "", openai: "" };
  const take = (key: unknown) => {
    if (typeof key !== "string" || !key.trim()) return;
    const value = key.trim();
    if (value.startsWith("sk-")) {
      if (!keys.openai) keys.openai = value;
    } else if (!keys.gemini) {
      keys.gemini = value;
    }
  };
  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) continue;
    if (!value.includes(":")) {
      take(value);
      continue;
    }
    let decrypted = "";
    try {
      decrypted = decrypt(value);
    } catch {
      continue;
    }
    try {
      const parsed = JSON.parse(decrypted);
      if (typeof parsed?.gemini === "string" && parsed.gemini && !keys.gemini) keys.gemini = parsed.gemini;
      if (typeof parsed?.openai === "string" && parsed.openai && !keys.openai) keys.openai = parsed.openai;
    } catch {
      take(decrypted);
    }
  }
  return keys;
}

/** A model answer that must be a JSON object. Anything else is rejected, so the fallback model is tried. */
function parseJsonObject(text: string): Record<string, any> | null {
  const data = JSON.parse(text);
  return data && typeof data === "object" && !Array.isArray(data) ? data : null;
}

/** One usage log per model a request used, priced from the admins' catalog where it has a price. */
function logModelUsage(runner: ModelRunner, endpoint: string) {
  for (const { model, provider, usage } of runner.usageByModel()) {
    logUsage({
      userId: "anonymous",
      model,
      inputTokens: usage.promptTokenCount,
      outputTokens: usage.candidatesTokenCount,
      totalTokens: usage.totalTokenCount,
      cacheHit: false,
      endpoint,
      timestamp: Date.now(),
      cost: calculateCost(model, usage.promptTokenCount, usage.candidatesTokenCount, pricingFor(runner.catalog, model, provider)),
    });
  }
}

/**
 * Deterministic post-processing shared by every generation branch (OpenAI
 * premium, Gemini split-gen, and the fallbacks) before the response is cached:
 *
 *   1. enforce each role's bullet budget - the candidate's bullet rules first,
 *      then the tenure tiers (trims, never pads),
 *   2. when the candidate follows LinkedIn trends, report which trending skills
 *      the resume uses, could use, or lacks evidence for, and drop skills
 *      entries that name only unsupported ones,
 *   3. replace the model's guessed match_score/baseline_score with values
 *      computed from the real job description and the real resume,
 *   4. run the impact audit, tracing every figure back to the candidate's own
 *      material.
 *
 * Budgets run first so the scores and the audit describe the document the
 * candidate actually receives. The source text deliberately excludes the
 * reference resumes so that the client, which re-runs the same steps, agrees.
 * The budget report records the rules' decisions, and the trend report the
 * evidence it found (reference resumes included), so the client's pass reuses
 * them instead of re-deciding from evidence it no longer has.
 */
function finalizeResumeResult(
  result: any,
  params: {
    jobDescription: string;
    originalResumeText: string;
    targetRole?: string;
    jdKeywords?: string[];
    brainDump?: string;
    customPrompt?: string;
    /** Active bullet rules; null or omitted for the tenure tiers alone. */
    bulletRules?: BulletRules | null;
    /** Source roles with their original bullets, for the platform rule's evidence. */
    sourceRoles?: unknown[];
    now?: Date;
    /** Curated LinkedIn trends when the candidate follows them; null or omitted otherwise. */
    trends?: LinkedInTrends | null;
    /** More of the candidate's own material (their other resumes) that can evidence a trending skill. */
    trendEvidence?: unknown[];
    /** The verified requirement evidence map made for this run; null when the analysis failed. */
    requirementAnalysis?: RequirementAnalysis | null;
    /** What each step read of the resume and the posting. */
    inputCoverage?: InputCoverageReport;
  }
): any {
  if (!result || typeof result.result !== "string") return result;
  try {
    const parsed = JSON.parse(result.result);
    const {
      brainDump, customPrompt, bulletRules, sourceRoles, now, trends, trendEvidence,
      requirementAnalysis, inputCoverage, ...scoreParams
    } = params;
    const sourceText = [params.originalResumeText, brainDump, customPrompt]
      .filter((part) => typeof part === "string" && part.trim().length > 0)
      .join("\n\n");
    // Trending skills are judged against the candidate's material only; the custom
    // prompt is instructions, not evidence. The notes stay a separate source so a JSON
    // resume still counts by its values only. The client re-runs this with the same material.
    const trendExtra: unknown[] = trends ? [brainDump, ...(Array.isArray(trendEvidence) ? trendEvidence : [])] : [];

    // First, so the budgets, scores and audits describe a document that honours them.
    applyExclusionGuarantee(parsed);
    const budget = enforceBulletBudgets(parsed, {
      sourceText,
      rules: bulletRules ?? null,
      jobDescription: params.jobDescription,
      sourceRoles,
      now,
      ...(trends ? { preferTerms: trendPreferTerms(trends, trendEvidenceText(params.originalResumeText, ...trendExtra)) } : {}),
    });
    // After budgets, so it describes the delivered document; before scoring, because
    // it drops skills entries that name only unsupported trending skills. The server
    // writes the first report, so one already here came from the model: discard it.
    if (trends) {
      delete parsed.linkedin_trends;
      applyTrendCoverage(parsed, trends, { sourceText: params.originalResumeText, extraEvidence: trendExtra });
    }
    applyMatchScores(parsed, scoreParams);
    // What the candidate's material proves, apart from how many posting words the resume uses.
    applyRequirementEvidence(parsed, requirementAnalysis ?? null);
    applyImpactAudit(parsed, { sourceText });
    // Budgets and trend coverage may have removed flagged items: list only what is delivered.
    refreshVerificationReport(parsed);
    if (inputCoverage) parsed.input_coverage = inputCoverage;
    else delete parsed.input_coverage;
    if (budget) {
      const outside = budget.roles.filter((r) => r.status === "trimmed" || r.status === "under");
      console.log(
        `[Budget] ${budget.roles.length} roles, ${budget.trimmed} bullet(s) trimmed, compliant=${budget.compliant}` +
          (outside.length > 0
            ? ` (${outside.map((r) => `${r.role || "role"}: ${r.delivered}/${r.budget ?? `max ${r.max}`} ${r.status}`).join("; ")})`
            : "")
      );
    }
    const trendReport = parsed.linkedin_trends;
    if (trends && trendReport) {
      console.log(
        `[Trends] ${trendReport.label}: ${trendReport.used.length} used, ${trendReport.available.length} supported but unused, ` +
          `${trendReport.gaps.length} gaps, ${trendReport.unsupported.length} unsupported, ` +
          `${trendReport.removed.length} unsupported skills entr${trendReport.removed.length === 1 ? "y" : "ies"} removed`
      );
    }
    console.log(
      `[Scoring] baseline=${parsed.baseline_score ?? "n/a"} match=${parsed.match_score ?? "n/a"} ` +
        `(${parsed.score_breakdown?.jd_keywords_evaluated ?? 0} JD requirements evaluated) ` +
        `impact=${parsed.impact_audit?.score ?? "n/a"} ` +
        `(${parsed.impact_audit?.bullets_evaluated ?? 0} bullets, ` +
        `${parsed.impact_audit?.findings?.length ?? 0} findings, ` +
        `${parsed.impact_audit?.unverified_figure_bullets ?? 0} with unverified figures, ` +
        `${parsed.impact_audit?.star_dropped ?? 0} STAR dropped)`
    );
    const evidence = parsed.requirement_evidence;
    if (evidence) {
      console.log(
        `[Evidence] qualification=${evidence.qualification_evidence ?? "n/a"} ` +
          `required ${evidence.required.evidenced}+${evidence.required.partial} partial of ${evidence.required.total}` +
          (evidence.hard_gaps.length ? `; hard gaps: ${evidence.hard_gaps.join("; ")}` : "")
      );
    }
    return { ...result, result: JSON.stringify(parsed) };
  } catch (e: any) {
    console.warn("[Scoring] Could not finalize the generated resume:", e?.message || e);
    return result;
  }
}

/** What the requirement analysis reads of the posting; the generation prompts get GENERATION_JD_LIMIT. */
const ANALYSIS_JD_LIMIT = 30000;
const GENERATION_JD_LIMIT = 12000;

type TokenUsage = { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number };

function emptyUsage(): TokenUsage {
  return { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
}

function addUsage(total: TokenUsage, usage: Partial<TokenUsage> | null | undefined): void {
  total.promptTokenCount += usage?.promptTokenCount || 0;
  total.candidatesTokenCount += usage?.candidatesTokenCount || 0;
  total.totalTokenCount += usage?.totalTokenCount || 0;
}

function sumUsage(base: Partial<TokenUsage> | null | undefined, extra: TokenUsage): TokenUsage {
  const total = emptyUsage();
  addUsage(total, base);
  addUsage(total, extra);
  return total;
}

/** The candidate's material as one text: resumes as JSON, notes and instructions as written. */
function candidateMaterialText(...parts: unknown[]): string {
  return parts
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object") return JSON.stringify((part as any).data ?? part);
      return "";
    })
    .filter((text) => text.trim().length > 0)
    .join("\n\n");
}

/**
 * Reviews and corrects the generated document (draftReview.ts) and attaches
 * the verification report. Never throws: a document that cannot be parsed is
 * returned untouched for finalizeResumeResult to handle as before.
 */
async function verifyDraftResult(result: any, context: DraftReviewContext, call: DraftModelCall): Promise<any> {
  if (!result || typeof result.result !== "string") return result;
  let parsed: any;
  try {
    parsed = JSON.parse(result.result);
  } catch (e: any) {
    console.warn("[Verify] Generated document is not JSON; skipping the review:", e?.message || e);
    return result;
  }
  console.log("[Pipeline] Step 4: Verifying the draft against the candidate's material...");
  const report = await reviewAndCorrectDraft(parsed, context, call);
  parsed.draft_verification = report;
  console.log(
    `[Verify] review=${report.ai_review} corrections=${report.corrections}: ${report.issues_found} issue(s), ` +
      `${report.fixed.length} fixed, ${report.remaining.length} remaining, ${report.removed.length} removed for exclusions`
  );
  return { ...result, result: JSON.stringify(parsed) };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  // Debug: Log all incoming requests
  app.use((req, res, next) => {
    console.log(`[Server] ${req.method} ${req.url}`);
    next();
  });

  app.get("/api/health-check", (req, res) => {
    res.json({ status: "alive", timestamp: new Date().toISOString() });
  });

  app.get("/api/generate-resume-pdf", async (req, res) => {
    try {
      const html = renderResumeToHTML();
      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ["--no-sandbox"],
      });
      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.evaluateHandle('document.fonts.ready');
        const pdf = await page.pdf({ format: 'A4', printBackground: true });
        res.contentType("application/pdf");
        res.setHeader('Content-Disposition', 'inline; filename="resume.pdf"');
        res.send(pdf);
      } finally {
        await browser.close();
      }
    } catch (error) {
      console.error(error);
      res.status(500).send("Failed to generate PDF");
    }
  });

  console.log("Environment Variables Check:");
  console.log("PUPPETEER_EXECUTABLE_PATH:", process.env.PUPPETEER_EXECUTABLE_PATH);
  console.log("HTTP_PROXY:", process.env.HTTP_PROXY);

  // Google Drive Client Setup
  const getDriveClient = (accessToken?: string) => {
    // Ensure accessToken is a valid string and not "null", "undefined", or empty
    const isValidToken = accessToken && 
                        typeof accessToken === 'string' && 
                        accessToken !== 'null' && 
                        accessToken !== 'undefined' && 
                        accessToken.trim() !== '';

    if (isValidToken) {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      return google.drive({ version: 'v3', auth });
    }

    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    const folderId = process.env.GOOGLE_SERVICE_ACCOUNT_FOLDER_ID;

    if (!serviceAccountKey) {
      console.warn("GOOGLE_SERVICE_ACCOUNT_KEY is not set. Drive fallback to Service Account will be unavailable.");
      return null;
    }

    if (folderId && (folderId.startsWith('{') || folderId.includes('service_account'))) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_FOLDER_ID appears to contain a Service Account JSON instead of a Folder ID. Please check your environment variables.");
    }
    
    let credentials;
    try {
      credentials = JSON.parse(serviceAccountKey);
    } catch (e) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not a valid JSON string. Ensure it is the full content of your service account key file.");
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    return google.drive({ version: 'v3', auth });
  };

  app.post("/api/save-to-drive", async (req, res) => {
    const { pdfData, fileName, versioningEnabled, accessToken, parentFolderId } = req.body;
    
    if (!pdfData || !fileName) {
      return res.status(400).json({ error: "PDF data and file name are required" });
    }

    // Escape single quotes in file name for Drive query
    const escapedFileName = fileName.replace(/'/g, "\\'");

    try {
      const drive = getDriveClient(accessToken);
      const folderId = parentFolderId || process.env.GOOGLE_SERVICE_ACCOUNT_FOLDER_ID;
      
      // Determine mimeType from fileName
      const mimeType = fileName.endsWith('.csv') ? 'text/csv' : 'application/pdf';

      // Convert base64 to stream
      const buffer = Buffer.from(pdfData, 'base64');
      const bufferStream = new stream.PassThrough();
      bufferStream.end(buffer);

      let fileId = null;
      
      if (!versioningEnabled) {
        // Search for existing file with same name
        const query = folderId 
          ? `name = '${escapedFileName}' and '${folderId}' in parents and trashed = false`
          : `name = '${escapedFileName}' and trashed = false`;

        const response = await drive.files.list({
          q: query,
          fields: 'files(id, name)',
          spaces: 'drive',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        
        if (response.data.files && response.data.files.length > 0) {
          fileId = response.data.files[0].id;
        }
      }

      if (fileId) {
        // Update existing file
        await drive.files.update({
          fileId: fileId,
          media: {
            mimeType: mimeType,
            body: bufferStream,
          },
          supportsAllDrives: true,
        });
        res.json({ success: true, message: "File updated successfully", fileId });
      } else {
        // Create new file
        const finalFileName = versioningEnabled 
          ? `${fileName.replace(/\.(pdf|csv)$/, '')} (v${new Date().toISOString().replace(/[:.]/g, '-')})${fileName.endsWith('.csv') ? '.csv' : '.pdf'}`
          : fileName;

        const fileMetadata: any = {
          name: finalFileName,
          mimeType: mimeType,
        };

        if (folderId) {
          fileMetadata.parents = [folderId];
        }
        
        const media = {
          mimeType: mimeType,
          body: bufferStream,
        };

        const file = await drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id',
          supportsAllDrives: true,
        });
        res.json({ success: true, message: "File created successfully", fileId: file.data.id });
      }
    } catch (error: any) {
      console.error("Drive Save Error:", error.message || error);
      let errorData = null;
      if (error.response && error.response.data) {
        errorData = error.response.data;
        console.error("Drive Save Error Details:", JSON.stringify(errorData));
      }
      
      let errorMessage = "Failed to save to Google Drive";
      let statusCode = error.response?.status || 500;
      
      if (statusCode === 401) {
        errorMessage = "AUTH_EXPIRED: Your Google Drive session has expired. Please reconnect your Drive in settings.";
      } else if (statusCode === 403 && errorData?.error?.message?.includes("storage quota")) {
        errorMessage = "STORAGE_QUOTA_EXCEEDED: Service Account has no storage quota on personal drives. Please set your parent folder to a folder inside a 'Shared Drive' (created in Google Drive).";
      } else if (error.code === 404) {
        errorMessage = "Folder or File not found. Please verify your folder ID and permissions.";
      } else if (error.message && error.message.includes("invalid_grant")) {
        errorMessage = "Authentication failed. Please check your Service Account configuration.";
      } else {
        errorMessage = error.message || errorMessage;
      }

      res.status(statusCode).json({ error: errorMessage });
    }
  });

  app.get("/api/list-drive-folders", async (req, res) => {
    const accessToken = req.query.accessToken as string | undefined;
    try {
      const drive = getDriveClient(accessToken);
      if (!drive) {
        return res.status(401).json({ error: "Google Drive is not connected. Please connect via OAuth in settings." });
      }
      const response = await drive.files.list({
        // List folders that are not trashed
        q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        pageSize: 1000,
        fields: 'files(id, name, modifiedTime)',
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      res.json({ 
        success: true, 
        folders: response.data.files || [] 
      });
    } catch (error: any) {
      console.error("Drive Folder List Error:", error.message || error);
      
      let errorMessage = error.message || "Failed to fetch Drive folders";
      if (error.code === 401 || (error.response && error.response.status === 401)) {
        errorMessage = "AUTH_EXPIRED: Your Google Drive session has expired. Please reconnect your Drive in settings.";
      }

      res.status(error.response?.status || 500).json({ 
        success: false, 
        error: errorMessage
      });
    }
  });

  app.get("/api/list-drive-files", async (req, res) => {
    const accessToken = req.query.accessToken as string | undefined;
    try {
      const drive = getDriveClient(accessToken);
      if (!drive) {
        return res.status(401).json({ error: "Google Drive is not connected. Please connect via OAuth in settings." });
      }
      const folderId = process.env.GOOGLE_SERVICE_ACCOUNT_FOLDER_ID;
      
      const query = folderId 
        ? `'${folderId}' in parents and mimeType = 'application/pdf' and trashed = false`
        : "mimeType = 'application/pdf' and trashed = false";

      const response = await drive.files.list({
        q: query,
        pageSize: 50,
        fields: 'files(id, name, webViewLink, modifiedTime)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      res.json({ 
        success: true, 
        files: response.data.files || [] 
      });
    } catch (error: any) {
      console.error("Drive List Error:", error.message || error);
      if (error.response && error.response.data) {
        console.error("Drive List Error Details:", JSON.stringify(error.response.data));
      }
      
      let errorMessage = error.message || "Failed to fetch Drive files";
      if (error.code === 401 || (error.response && error.response.status === 401)) {
        errorMessage = "AUTH_EXPIRED: Your Google Drive session has expired. Please reconnect your Drive in settings.";
      }

      res.status(error.response?.status || 500).json({ 
        success: false, 
        error: errorMessage
      });
    }
  });

  app.patch("/api/rename-drive-file", express.json(), async (req, res) => {
    const { fileId, newName, accessToken } = req.body;
    if (!fileId || !newName) {
      return res.status(400).json({ error: "Missing fileId or newName" });
    }
    try {
      const drive = getDriveClient(accessToken);
      await drive.files.update({
        fileId: fileId,
        requestBody: {
          name: newName.endsWith('.pdf') ? newName : `${newName}.pdf`
        },
        supportsAllDrives: true,
      });
      res.json({ success: true, message: "File renamed successfully" });
    } catch (error: any) {
      console.error("Drive Rename Error:", error.message || error);
      if (error.response && error.response.data) {
        console.error("Drive Rename Error Details:", JSON.stringify(error.response.data));
      }
      
      let errorMessage = error.message || "Failed to rename file";
      if (error.code === 401 || (error.response && error.response.status === 401)) {
        errorMessage = "AUTH_EXPIRED: Your Google Drive session has expired. Please reconnect your Drive in settings.";
      }
      
      res.status(error.response?.status || 500).json({ error: errorMessage });
    }
  });

  app.delete("/api/delete-drive-file", express.json(), async (req, res) => {
    const { fileId, accessToken } = req.body;
    if (!fileId) {
      return res.status(400).json({ error: "Missing fileId" });
    }
    try {
      const drive = getDriveClient(accessToken);
      await drive.files.delete({
        fileId: fileId,
        supportsAllDrives: true,
      });
      res.json({ success: true, message: "File deleted successfully" });
    } catch (error: any) {
      console.error("Drive Delete Error:", error.message || error);
      if (error.response && error.response.data) {
        console.error("Drive Delete Error Details:", JSON.stringify(error.response.data));
      }
      
      let errorMessage = error.message || "Failed to delete file";
      if (error.code === 401 || (error.response && error.response.status === 401)) {
        errorMessage = "AUTH_EXPIRED: Your Google Drive session has expired. Please reconnect your Drive in settings.";
      }
      
      res.status(error.response?.status || 500).json({ error: errorMessage });
    }
  });

  app.get("/api/test-drive", async (req, res) => {
    const accessToken = req.query.accessToken as string | undefined;
    try {
      const drive = getDriveClient(accessToken);
      const response = await drive.files.list({
        pageSize: 1,
        fields: 'files(id, name)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      res.json({ 
        success: true, 
        message: accessToken 
          ? "Connection successful! Authenticated via Google OAuth." 
          : "Connection successful! Drive API is enabled and Service Account is authenticated.",
        filesFound: response.data.files?.length || 0
      });
    } catch (error: any) {
      console.error("Drive Test Error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to connect to Google Drive",
        details: accessToken 
          ? "Ensure your Google account has Drive API permissions and the token is valid."
          : "Ensure GOOGLE_SERVICE_ACCOUNT_KEY is correct and Drive API is enabled in Google Cloud Console."
      });
    }
  });

  // API Endpoint to encrypt API Key
  app.post("/api/encrypt-key", (req, res) => {
    const { apiKey, existingEncryptedKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: "API key is required" });
    }
    try {
      let keysToEncrypt = apiKey;
      
      // If we're passing a JSON string of keys and an existing encrypted key, merge them
      if (existingEncryptedKey) {
        try {
          const newKeys = JSON.parse(apiKey);
          const decryptedExisting = decrypt(existingEncryptedKey);
          let existingKeys: any = {};
          try {
            existingKeys = JSON.parse(decryptedExisting);
          } catch (e) {
            // If the existing key wasn't JSON, assume it was a Gemini key for backwards compatibility
            existingKeys = { gemini: decryptedExisting };
          }
          
          // Merge keys, keeping existing ones if the new one is empty
          const mergedKeys = {
            gemini: newKeys.gemini || existingKeys.gemini || '',
            openai: newKeys.openai || existingKeys.openai || ''
          };
          keysToEncrypt = JSON.stringify(mergedKeys);
        } catch (e) {
          // Ignore decryption errors, assume existing keys are invalid/inaccessible
        }
      }

      const encryptedKey = encrypt(keysToEncrypt);
      res.json({ encryptedKey });
    } catch (error: any) {
      console.error("Encryption Error:", error);
      res.status(500).json({ error: "Failed to encrypt API key" });
    }
  });

  // API Endpoint to decrypt API keys for frontend use
  app.post("/api/decrypt-keys", (req, res) => {
    const { encryptedKey } = req.body;
    if (!encryptedKey) {
      return res.status(400).json({ error: "Encrypted key is required" });
    }
    try {
      const decryptedString = decrypt(encryptedKey);
      let keys: any = {};
      try {
        keys = JSON.parse(decryptedString);
      } catch (e) {
        // For backwards compatibility if it was a single raw key
        keys = { gemini: decryptedString };
      }
      res.json({ keys });
    } catch (error: any) {
      console.error("Decryption Error:", error);
      res.status(500).json({ error: "Failed to decrypt API keys", details: error.message });
    }
  });

  // API Endpoint to clear cache
  app.post("/api/cache/clear", (req, res) => {
    Optimization.clearCache();
    res.json({ success: true, message: "Cache cleared successfully" });
  });

  // Admin Analytics Endpoints
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const snapshot = await db.collection("analytics").get();
      const logs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          timestamp: data.timestamp?.toDate?.()?.getTime() || data.timestamp || Date.now()
        } as UsageLog;
      });

      const totalRequests = logs.filter(l => l.endpoint === "/api/v2/optimize").length;
      const totalTokens = logs.reduce((sum, l) => sum + l.totalTokens, 0);
      const totalCost = logs.reduce((sum, l) => sum + l.cost, 0);
      const cacheHits = logs.filter(l => l.cacheHit).length;
      const cacheHitRatio = totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;

      res.json({
        totalRequests,
        totalTokens,
        totalCost,
        cacheHitRatio
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });

  app.get("/api/admin/usage-by-day", async (req, res) => {
    try {
      const snapshot = await db.collection("analytics").get();
      const logs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          timestamp: data.timestamp?.toDate?.()?.getTime() || data.timestamp || Date.now()
        } as UsageLog;
      });

      const dailyData: Record<string, { tokens: number, cost: number }> = {};
      
      logs.forEach(log => {
        const date = new Date(log.timestamp).toISOString().split('T')[0];
        if (!dailyData[date]) {
          dailyData[date] = { tokens: 0, cost: 0 };
        }
        dailyData[date].tokens += log.totalTokens;
        dailyData[date].cost += log.cost;
      });

      const result = Object.entries(dailyData).map(([date, data]) => ({
        date,
        ...data
      })).sort((a, b) => a.date.localeCompare(b.date));

      res.json(result);
    } catch (error) {
      console.error("Error fetching usage by day:", error);
      res.status(500).json({ error: "Failed to fetch usage by day" });
    }
  });

  app.get("/api/admin/model-usage", async (req, res) => {
    try {
      const snapshot = await db.collection("analytics").get();
      const logs = snapshot.docs.map(doc => doc.data() as UsageLog);

      const modelData: Record<string, number> = {};
      
      logs.forEach(log => {
        const model = log.cacheHit ? "Cache" : log.model;
        modelData[model] = (modelData[model] || 0) + 1;
      });

      const result = Object.entries(modelData).map(([name, value]) => ({
        name,
        value
      }));

      res.json(result);
    } catch (error) {
      console.error("Error fetching model usage:", error);
      res.status(500).json({ error: "Failed to fetch model usage" });
    }
  });

  // The browser's OpenAI calls (callAI in src/services/geminiService.ts). Exactly the
  // model asked for: the browser runs the primary and fallback itself, so nothing
  // is substituted here, and a failure is returned as one.
  app.post("/api/optimize", async (req, res) => {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    const { prompt, model, encryptedKey } = req.body || {};
    if (typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "A prompt is required." });
    }
    if (!isValidModelId(model)) {
      return res.status(400).json({ error: "A valid OpenAI model ID is required." });
    }
    const openaiKey = requestKeys(encryptedKey).openai;
    if (!openaiKey) {
      return res.status(400).json({ error: "No OpenAI API key was sent. Save your OpenAI key in your profile." });
    }
    try {
      const openai = new OpenAI({ apiKey: openaiKey });
      // OpenAI's JSON mode requires the word "JSON" in the prompt.
      const json = /json/i.test(prompt);
      const completion = await openai.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        ...(json ? { response_format: { type: "json_object" as const } } : {}),
      });
      const input = completion.usage?.prompt_tokens || 0;
      const output = completion.usage?.completion_tokens || 0;
      res.json({
        result: completion.choices[0]?.message?.content || "",
        usage: { promptTokenCount: input, candidatesTokenCount: output, totalTokenCount: completion.usage?.total_tokens || input + output },
        model,
      });
    } catch (error: any) {
      console.error(`[OpenAI] ${model} failed:`, error?.message || error);
      const status = Number(error?.status);
      res.status(status >= 400 && status < 600 ? status : 502).json({ error: error?.message || "The OpenAI request failed." });
    }
  });

  app.post("/api/v2/optimize", async (req, res) => {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    const idToken = authHeader.split('Bearer ')[1];

    const { 
      resumeText, 
      jobDescription, 
      targetRole, 
      mode, 
      audience, 
      audienceMix,
      customPrompt, 
      pipelineType,
      targetCompany,
      brainDump,
      apiKey,
      geminiApiKey,
      bulletRules: requestedBulletRules,
      linkedinTrends,
      modelCatalog
    } = req.body;

    if (!resumeText || !jobDescription) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Untrusted input: clamped and sanitized; null when absent or switched off,
    // which reproduces the tenure-only budgets exactly.
    const bulletRules = activeBulletRules(requestedBulletRules);
    // Curated LinkedIn trends (src/lib/linkedinTrends.ts); null unless the candidate
    // follows them, which leaves the cache key, the prompts and the output as before.
    const trends = activeLinkedInTrends(linkedinTrends, targetRole, jobDescription);

    // Every selected reader is written for in ONE run: the weighted mix becomes a
    // brief in each prompt. The brief is rebuilt here from the validated mix, never
    // taken from the client as prompt text.
    const blend = normalizeAudienceMix(audienceMix);
    const audienceText = blend ? audienceHeadline(blend) : audience;
    const documentAudienceBrief = buildAudienceBrief(blend, "document");
    const roleAudienceBrief = buildAudienceBrief(blend, "role");

    try {
      // 1. Fetch keys securely from Firestore
      const keys = await getApiKeys(idToken);
      let geminiKey = keys?.gemini || "";
      let openaiKey = keys?.openai || "";
      
      // 1.1 Fetch this user's own master resumes, minus the one being rewritten
      const masterResumes = await getUserMasterResumes(idToken, resumeText);

      // 2. Keys sent with the request (raw or encrypted) take precedence. Each is
      // classified by its form, so an OpenAI key is never used as a Gemini key.
      const sentKeys = requestKeys(apiKey, geminiApiKey);
      if (sentKeys.gemini) geminiKey = sentKeys.gemini;
      if (sentKeys.openai) openaiKey = sentKeys.openai;
      // The user's own keys. The platform's key never runs on models the browser sends.
      const ownKeys = { gemini: Boolean(geminiKey), openai: Boolean(openaiKey) };

      // Only fall back to system key if NO identity is provided (Guest Mode)
      if (!idToken) {
        geminiKey = geminiKey || process.env.GEMINI_API_KEY || "";
      }
      
      if (!geminiKey && !idToken) {
         console.warn("No API key found in Guest Mode. System may fall back to platform default.");
      }
      
      if (!geminiKey) console.warn("Gemini API key not found. Expecting platform-provided authentication to be available.");
      
      const selectedPipeline = pipelineType || 'hybrid-gemini';
      const engineMode: EngineMode = isEngineMode(selectedPipeline) ? selectedPipeline : 'hybrid-gemini';
      // Every call below runs on the admins' models: primary, then fallback, then stop.
      const catalog = requestCatalog(modelCatalog, ownKeys);
      const runner = new ModelRunner(catalog, engineMode, { gemini: geminiKey, openai: openaiKey });
      const modelRoutes = providersOf(engineMode).map((provider) =>
        modelChain(catalog, provider).map((id) => `${id}@${thinkingFor(catalog, id)}`).join(">")
      );
      console.log(`[Pipeline] Engine ${engineMode} on ${modelRoutes.join(" | ")}`);

      // 2. Check Cache First (Key includes all relevant fields + API key presence to avoid stale results from different keys)
      const cacheKey = pipelineCache.generateKey({ 
        resumeText: resumeText,
        jobDescription: jobDescription,
        targetRole, 
        mode, 
        audience: audienceText, 
        audienceMix: blend ? blend.entries : null,
        customPrompt,
        pipelineType: selectedPipeline,
        hasGemini: !!geminiKey,
        hasOpenAI: !!openaiKey,
        // Results made before evidence-first optimization must not be served again.
        pipelineVersion: "evidence-v1",
        // Nor results written by models the admins have since replaced.
        models: modelRoutes,
        ...(bulletRules ? { bulletRules: bulletRulesFingerprint(bulletRules) } : {}),
        ...(trends ? { linkedinTrends: trendFingerprint(trends) } : {})
      });
      
      const cachedResult = pipelineCache.get(cacheKey);
      if (cachedResult) {
        // Log cache hit
        logUsage({
          userId: "anonymous",
          model: "cache",
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          cacheHit: true,
          endpoint: "/api/v2/optimize",
          timestamp: Date.now(),
          cost: 0
        });
        return res.json(cachedResult);
      }

      if (!geminiKey && !openaiKey && !process.env.GEMINI_API_KEY) {
        throw new Error("No valid API keys found. Please provide at least 1 Gemini or OpenAI API key in your profile.");
      }

      // STEP 1: Read the resume, and analyse the posting against the candidate's own material.
      // A JSON master resume is parsed in code: read in full, exactly as written, no model call.
      const structuredResume = Optimization.structuredResumeFromText(resumeText);
      // The analysis and the review see the same facts the writer may use: this resume, the
      // brain dump, and the candidate's other resumes the prompts reference.
      const material = buildCandidateMaterial(resumeText, brainDump, { otherResumes: masterResumes });
      const analysisPosting = focusJobDescription(jobDescription, ANALYSIS_JD_LIMIT);
      console.log(
        `[Pipeline] Step 1: ${structuredResume ? "Structured resume parsed in code" : "Resume extraction"} ` +
          `+ requirement evidence analysis (${geminiKey ? 'User Key' : 'System Key'})...`
      );
      const [resumeExtraction, analysisRun] = await Promise.all([
        structuredResume
          ? Promise.resolve({ data: structuredResume, usage: null, _model: "structured-json", omittedChars: 0 })
          : Optimization.extractRelevantResumeData(resumeText, runner),
        Optimization.analyzeRequirements({ jobDescription: analysisPosting.text, targetRole, material }, runner),
      ]);

      const resumeData = resumeExtraction?.data;
      const requirementAnalysis = analysisRun.data;
      // Every posting term is scored; the prompts never list an excluded capability as a priority.
      let jdKeywords = analysisKeywords(requirementAnalysis);
      if (jdKeywords.length === 0) {
        console.warn("[Pipeline] No requirement analysis; falling back to keyword extraction.");
        const jdExtraction = await Optimization.extractJDKeywords(jobDescription, runner);
        jdKeywords = jdExtraction?.data || [];
      }

      if (!resumeData) throw new Error("The resume could not be read.");

      // STEP 2: Internal Logic (Free) - Trimming
      console.log("[Pipeline] Step 2: Trimming Content...");
      // ONE budget plan for every generation path and for enforcement, read from
      // the full posting so the platform rule sees what the candidate pasted.
      const budgetOptions = { now: new Date(), rules: bulletRules, jobDescription };
      const optimizedInput = Optimization.trimContentForAI(resumeData, withoutExcludedTerms(jdKeywords), budgetOptions);
      const budgetPlan = planBulletBudgets(optimizedInput.experience, budgetOptions);
      if (budgetPlan.rules) {
        console.log(
          `[Budget] Bullet rules: ${budgetPlan.budgets
            .map((b) => `${b.company || b.role || "role"} ${b.label ?? `max ${b.max}`} (${b.basis})`)
            .join("; ")}` +
            (budgetPlan.pageFit
              ? ` | page fit ${budgetPlan.pageFit.before}->${budgetPlan.pageFit.after} of ${budgetPlan.pageFit.cap}`
              : "")
        );
      }
      
      console.log("=== OPTIMIZED INPUT EXPERIENCE ===");
      console.dir(optimizedInput.experience, { depth: null });

      // Which trending skills the prompts may name is decided by the candidate's own
      // material - this resume, the brain dump and their other resumes - never by the
      // custom prompt, which is instructions rather than evidence.
      const trendReferences = trends ? masterResumes.map((entry: any) => entry?.data ?? entry) : [];
      const trendBrief = trends
        ? buildTrendBrief(trends, { scope: "document", evidenceText: trendEvidenceText(resumeText, brainDump, ...trendReferences) })
        : "";
      if (trends) console.log(`[Trends] ${describeTrendSource(trends)}: ${trends.skills.length} trending skills considered.`);

      // STEP 3: Final generation on the admins' writing models
      const roleCount = optimizedInput.experience.length;
      // Boilerplate goes before anything is cut, and any cut is disclosed in input_coverage.
      const generationPosting = focusJobDescription(jobDescription, GENERATION_JD_LIMIT);
      const generationJobDescription = generationPosting.text;
      const inputCoverage = buildInputCoverage({
        resumeChars: resumeText.length,
        resumeMethod: structuredResume ? "structured" : "extracted",
        resumeOmittedChars: (resumeExtraction as any)?.omittedChars || 0,
        materialOmittedChars: requirementAnalysis ? material.omitted_chars : 0,
        analysisPosting: requirementAnalysis ? analysisPosting : null,
        generationPosting,
      });
      if (inputCoverage.notes.length > 0) console.log(`[Coverage] ${inputCoverage.notes.join(" ")}`);
      const generationOptions = {
        targetRole,
        audience: audienceText,
        audienceBrief: documentAudienceBrief,
        mode,
        targetCompany,
        customPrompt,
        brainDump,
        roleCount,
        jdKeywords: optimizedInput.jd_keywords,
        masterResumes,
        bulletBudgets: budgetPlan.budgets,
        bulletRules: budgetPlan.rules,
        platformDecision: budgetPlan.platform,
        trendBrief,
        // The extracted keyword list alone is too lossy to differentiate two job
        // descriptions for similar roles, which caused near-identical output across
        // different JDs. The model needs the actual posting to tailor against.
        jobDescription: generationJobDescription,
        inputLabel: "INPUT DATA (structured, pre-extracted and trimmed)",
        inputData: JSON.stringify(optimizedInput, null, 2),
        // Proven requirements lead; unproven and excluded ones are named as never to be claimed.
        requirementAnalysis,
      };
      const finalPrompt = buildResumeGenerationPrompt(generationOptions);

      let result: any;

      if (runner.providerFor("writing") === "openai") {
        // Hybrid OpenAI: one whole-document call on the OpenAI models; Gemini read and analysed above.
        console.log(`[Hybrid Pipeline] Step 3: Whole-document generation on ${modelChain(catalog, "openai").join(" > ")}...`);
        // An answer that is not a JSON object counts as a failed call, so the fallback is tried.
        const { result: generation } = await runner.callParsed(finalPrompt, "writing", (text) => (parseJsonObject(text) ? text : null), {
          system: "You are a senior executive resume strategist. Output strictly JSON. Ensure EVERY SINGLE role from input is preserved.",
        });
        result = {
          result: generation.text,
          intermediateData: { resumeData, jdKeywords },
          _engine: engineMode,
          _model: generation.model
        };
      } else {
        // Gemini: the summary, skills and other sections in one call, and each role in its own, in parallel.
        console.log(`[Pipeline] Step 3: Split Generation on ${modelChain(catalog, "gemini").join(" > ")}...`);
        const metaPrompt = buildResumeMetaPrompt(generationOptions);
        // Per-role calls run on the same models, count in the same totals, and try the
        // fallback when an answer is not a usable role.
        const writeRole = roleModelCall(runner);

        console.log(`[Pipeline] Spawning meta generation and ${optimizedInput.experience.length} role generation tasks...`);
        const [metaRun, roleResults] = await Promise.all([
          runner.callParsed(metaPrompt, "writing", (text) => {
            const data = parseJsonObject(text);
            return data && Object.keys(data).length > 0 ? data : null;
          }),
          generatePerRole(
            optimizedInput.experience,
            geminiKey,
            targetCompany,
            targetRole,
            audienceText,
            mode,
            customPrompt,
            brainDump,
            {
              // Each role is tailored against the real posting, like the whole-document path.
              jobDescription: generationJobDescription,
              jdKeywords: optimizedInput.jd_keywords,
              audienceBrief: roleAudienceBrief,
              budgetPlan,
              bulletRules: budgetPlan.rules,
              // Supporting evidence for grounded expansion; only rule roles receive it.
              referenceResumes: masterResumes,
              skills: optimizedInput.skills,
              now: budgetOptions.now,
              // Each role may name only the trending skills its own material shows.
              ...(trends ? { trends } : {}),
              // Each role leads with the requirements its own bullets prove.
              requirementAnalysis,
              call: writeRole,
            }
          )
        ]);

        const metaData = metaRun.data;

        // 3. Deduplicate and Score
        console.log("[Pipeline] Deduplicating and Scoring...");
        const finalExperience = deduplicateAndScore(
          roleResults.map(({ star_stories, generation, ...role }) => role)
        );

        const finalResult = {
          ...metaData,
          experience: finalExperience,
          // Drafted per role, next to the evidence and the bullets they expand.
          // The meta call never sees the bullets, so it cannot write stories that link.
          star_stories: selectStarStories(roleResults),
        };

        result = {
          result: JSON.stringify(finalResult),
          intermediateData: { resumeData, jdKeywords },
          _model: metaRun.result.model,
          _optimized: true,
          _split_gen: true
        };

        console.log("[Pipeline] Split Generation Complete.");
      }

      // STEP 4: Verify the draft against the candidate's material and the evidence map;
      // correct only what fails, and report what could not be corrected. Optional: when
      // the models fail here, the report says so and the run carries on.
      result = await verifyDraftResult(result, {
        figureSourceText: candidateMaterialText(resumeText, brainDump, customPrompt, ...masterResumes),
        evidenceText: candidateMaterialText(resumeText, brainDump, ...masterResumes),
        material,
        analysis: requirementAnalysis,
        jobDescription,
        targetRole,
        jdKeywords,
      }, async (prompt, purpose) => (await runner.call(prompt, purpose === "review" ? "analysis" : "writing")).text);

      // Tokens per provider (OpenAI as `usage`, Gemini as `geminiUsage`) and every model that answered.
      result.usage = runner.usage.openai;
      result.geminiUsage = runner.usage.gemini;
      result.modelsUsed = runner.modelsUsed();
      logModelUsage(runner, "/api/v2/optimize");

      // STEP 5: Deterministic budget, scoring and audit, then cache (Merged/Unified)
      result = finalizeResumeResult(result, {
        jobDescription,
        originalResumeText: resumeText,
        targetRole,
        jdKeywords,
        requirementAnalysis,
        inputCoverage,
        brainDump,
        customPrompt,
        bulletRules: budgetPlan.rules,
        sourceRoles: optimizedInput.experience,
        now: budgetOptions.now,
        ...(trends ? { trends, trendEvidence: trendReferences } : {}),
      });
      Optimization.saveToCache(cacheKey, result);
      res.json(result);
    } catch (error: any) {
      console.error("V2 Optimization Error:", error);
      if (isModelChainError(error)) {
        // Every configured model failed: the browser stops instead of trying another path.
        return res.status(502).json({ error: error.message, code: "MODEL_FAILED" });
      }
      res.status(500).json({ error: "Failed to optimize resume via V2 pipeline", details: error.message });
    }
  });
  
  app.post("/api/v3/optimize", async (req, res) => {
    try {
      const authHeader = req.header('Authorization');
      if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
  
      const idToken = authHeader.split('Bearer ')[1];
  
      const { 
        resumeText, 
        jobDescription,
        targetRole,
        targetCompany,
        mode,
        audience,
        customPrompt,
        brainDump,
        bulletRules: requestedBulletRules,
        modelCatalog
      } = req.body;
  
      if (!resumeText || !jobDescription) {
        return res.status(400).json({ error: "Missing input" });
      }
      const bulletRules = activeBulletRules(requestedBulletRules);
  
      // ===============================
      // 1. GET KEYS
      // ===============================
      const keys = await getApiKeys(idToken);
      let geminiKey = process.env.GEMINI_API_KEY;
      if (keys && keys.gemini) {
        geminiKey = keys.gemini;
      } else {
        console.warn("User has no API key configured. Using system key.");
      }
      // The admins' Gemini models on the user's own key; the built-in ones on the system key.
      const runner = new ModelRunner(requestCatalog(modelCatalog, { gemini: Boolean(keys?.gemini) }), "gemini", { gemini: geminiKey });
  
      // ===============================
      // 2. EXTRACTION
      // ===============================
      const resumeExtraction = await Optimization.extractRelevantResumeData(resumeText, runner);
      const jdExtraction = await Optimization.extractJDKeywords(jobDescription, runner);
  
      const resumeData = resumeExtraction?.data;
      const jdKeywords = jdExtraction?.data || [];
  
      if (!resumeData) throw new Error("Extraction failed");
  
      // ===============================
      // 3. MULTI AGENT
      // ===============================
      const agentOutput = await runAgents({
        resume: resumeData,
        jd: jdKeywords
      }, runner);
  
      // ===============================
      // 4. ROLE GENERATION (NO DUP)
      // ===============================
      const sourceExperience = agentOutput.hr.experience || resumeData.experience;
      const budgetNow = new Date();
      const writeRole = roleModelCall(runner);
      const roles = await generatePerRole(
        sourceExperience,
        geminiKey,
        targetCompany,
        targetRole,
        audience,
        mode,
        customPrompt,
        brainDump,
        // Planned from the full posting so the platform rule can read it.
        bulletRules
          ? {
              budgetPlan: planBulletBudgets(sourceExperience, { now: budgetNow, rules: bulletRules, jobDescription }),
              bulletRules,
              skills: resumeData.skills,
              now: budgetNow,
              call: writeRole,
            }
          : { call: writeRole }
      );
  
      // ===============================
      // 5. DEDUP + SCORE
      // ===============================
      const cleaned = deduplicateAndScore(roles);
  
      const totalScore = cleaned.reduce((sum, r: any) => sum + (r.score || 0), 0);
  
      // ===============================
      // 6. SAVE MEMORY
      // ===============================
      await saveResumeVersion(db, "anonymous", {
        input: resumeData,
        output: cleaned,
        score: totalScore
      });
  
      // ===============================
      // 7. RESPONSE
      // ===============================
      res.json({
        experience: cleaned,
        score: totalScore,
        _engine: "multi-agent-v3",
        modelsUsed: runner.modelsUsed()
      });
  
    } catch (error: any) {
      console.error("V3 Error:", error);
      if (isModelChainError(error)) {
        return res.status(502).json({ error: error.message, code: "MODEL_FAILED" });
      }
      res.status(500).json({
        error: "Optimization failed",
        details: error.message
      });
    }
  });

  // API Endpoint for PDF Generation (Direct)
  app.post("/api/generate-pdf", async (req, res) => {
    const { html, css, fonts } = req.body;
    await handlePdfGeneration(html, css, fonts, res);
  });

  // API Endpoint to create a PDF session
  app.post("/api/pdf-session", (req, res) => {
    const { html, css, fonts, title, scale } = req.body;
    if (!html) {
      return res.status(400).json({ error: "HTML content is required" });
    }
    const sessionId = uuidv4();
    pdfSessions.set(sessionId, { html, css, fonts, title, scale, timestamp: Date.now() });
    res.json({ sessionId });
  });

  // API Endpoints for Diagnostics
  app.get("/api/key-status", async (req, res) => {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(200).json({ type: "system", geminiStatus: "Using System Default", openaiStatus: "Using System Default" });
    }
    const idToken = authHeader.split('Bearer ')[1];
    try {
      const keys = await getApiKeys(idToken);
      if (keys && keys.gemini) {
        return res.json({ 
          type: "user", 
          geminiStatus: `Personal Key (${keys.gemini.substring(0, 4)}...${keys.gemini.slice(-4)})`,
          openaiStatus: keys.openai ? `Personal Key (${keys.openai.substring(0, 4)}...${keys.openai.slice(-4)})` : "Not Configured"
        });
      }
      res.json({ type: "system", geminiStatus: "System Default (No Personal Key Found)", openaiStatus: "System Default" });
    } catch (error) {
      res.json({ type: "error", message: "Failed to verify identity" });
    }
  });

  app.post("/api/diagnose/gemini", async (req, res) => {
    const { idToken } = req.body;
    try {
      const keys = await getApiKeys(idToken);
      const geminiKey = keys?.gemini || process.env.GEMINI_API_KEY;
      if (!geminiKey) return res.status(401).json({ error: "No API key configured" });

      const ai = new GoogleGenAI({ apiKey: geminiKey });
      
      // Test 1: Simple List Models
      await ai.models.list();
      
      // Test 2: Deep Research capability test (with minimal/dummy prompt to trigger error if key issue)
      await ai.interactions.create({
        agent: "deep-research-preview-04-2026",
        input: "test connection",
      }).catch(e => {
        if(e.status === 400) throw e;
      });

      res.status(200).json({ status: "ok" });
    } catch (error: any) {
      console.error("[Diagnostics] Gemini Error:", error);
      res.status(500).json({ error: error.message || "Unknown error" });
    }
  });

  app.post("/api/diagnose/openai", async (req, res) => {
    const { idToken } = req.body;
    try {
      const keys = await getApiKeys(idToken);
      const openaiKey = keys?.openai || process.env.OPENAI_API_KEY;
      if (!openaiKey) return res.status(401).json({ error: "No API key configured" });

      const openai = new OpenAI({ apiKey: openaiKey });
      await openai.models.list();
      res.status(200).json({ status: "ok" });
    } catch (error: any) {
      console.error("[Diagnostics] OpenAI Error:", error);
      res.status(500).json({ error: error.message || "Unknown error" });
    }
  });

  app.post("/api/update-keys", async (req, res) => {
    const { idToken, geminiKey, openaiKey } = req.body;
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const encrypted = encrypt(JSON.stringify({ gemini: geminiKey, openai: openaiKey }));
      await db.collection("users").doc(uid).set({ encryptedApiKey: encrypted }, { merge: true });
      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("[Diagnostics] Update Error:", error);
      res.status(500).json({ error: error.message || "Unknown error" });
    }
  });

  // OMNI FEATURES: Vision Scanning
  app.post("/api/gemini/scan-resume", async (req, res) => {
    const { imageData, mimeType, idToken, modelCatalog } = req.body;
    if (!imageData) return res.status(400).json({ error: "Image data required" });

    try {
      const keys = await getApiKeys(idToken);
      const geminiKey = keys?.gemini || (!idToken ? process.env.GEMINI_API_KEY : "");
      if (!geminiKey && idToken) return res.status(401).json({ error: "Personal API key required. Please update your profile settings." });
      if (!geminiKey) return res.status(401).json({ error: "No API key found" });

      // The admins' Gemini models on the user's own key; the built-in ones on the system key.
      const runner = new ModelRunner(requestCatalog(modelCatalog, { gemini: Boolean(keys?.gemini) }), "gemini", { gemini: geminiKey });
      const { value, model } = await runner.run("gemini", async (candidate) => {
        const response = await runner.gemini().models.generateContent({
          model: candidate,
          contents: [{
            parts: [
              { inlineData: { data: imageData, mimeType: mimeType || "image/png" } },
              { text: "ACT AS: Expert ATS Resume Parser. EXTRACT ALL DATA from this resume image. Output as a clean JSON object compatible with a resume builder. Fields should include: contact (name, email, phone, location, linkedin), summary, experience (title, company, location, dateRange, highlights array), education (degree, school, location, dateRange), skills (category if applicable, or flat array), and projects. If you cannot read certain parts, leave them null. Output ONLY the JSON." }
            ]
          }],
          config: { responseMimeType: "application/json", ...runner.geminiThinking(candidate) }
        });
        return { data: JSON.parse(response.text || "{}"), usage: response.usageMetadata };
      });

      logModelUsage(runner, "/api/gemini/scan-resume");
      res.setHeader("X-AI-Model", model);
      res.json(value.data);
    } catch (error: any) {
      console.error("[Omni Scan] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // OMNI FEATURES: Deep Research
  app.post("/api/deep-research/start", async (req, res) => {
    const { resume, jd, idToken } = req.body;
    try {
      const keys = await getApiKeys(idToken);
      const geminiKey = keys?.gemini || process.env.GEMINI_API_KEY;
      if (!geminiKey) return res.status(401).json({ error: "No API key found" });

      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const interaction = await ai.interactions.create({
        agent: "deep-research-preview-04-2026",
        input: `Conduct a DEEP RESEARCH analysis of this resume against this Job Description. 
                RESUME: ${JSON.stringify(resume)}
                JD: ${jd}
                
                GOALS:
                1. Identify the most critical gaps in the resume for this specific role.
                2. Suggest highly specific, data-driven achievements to add (based on the provided resume content).
                3. Research the company's culture and typical interview questions for this role to provide tailoring advice.
                4. Final Output: Provide a structured report with "Critical Gaps", "Tailoring Suggestions", and "Strategic Advancements".`,
        background: true,
      });

      res.json({ interactionId: interaction.id });
    } catch (error: any) {
      console.error("[Deep Research] Start Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/deep-research/status/:id", async (req, res) => {
    const { id } = req.params;
    const { idToken } = req.query;
    try {
      const keys = await getApiKeys(idToken as string);
      const geminiKey = keys?.gemini || process.env.GEMINI_API_KEY;
      if (!geminiKey) return res.status(401).json({ error: "No API key found" });

      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const interaction = await ai.interactions.get(id);
      
      let fullOutput = "";
      if (interaction.status === "completed") {
        for (const step of interaction.steps || []) {
          if (step.type === 'model_output') {
            const stepContent = step.content as any[];
            const textContent = stepContent?.find((c: any) => c.type === 'text');
            if (textContent && textContent.text) {
              fullOutput += textContent.text;
            }
          }
        }
      }

      res.json({
        status: interaction.status,
        output: fullOutput,
        progress: interaction.status === "completed" ? 100 : 50 // Simplified progress
      });
    } catch (error: any) {
      console.error("[Deep Research] Status Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // OMNI FEATURES: TTS Feedback
  app.post("/api/resume-feedback-audio", async (req, res) => {
    const { text, idToken, modelCatalog } = req.body;
    try {
      const keys = await getApiKeys(idToken);
      const geminiKey = keys?.gemini || (!idToken ? process.env.GEMINI_API_KEY : "");
      if (!geminiKey && idToken) return res.status(401).json({ error: "Personal API key required. Please update your profile settings." });
      if (!geminiKey) return res.status(401).json({ error: "No API key found" });

      // The admins' speech model on the user's own key; the built-in one on the system key.
      const runner = new ModelRunner(requestCatalog(modelCatalog, { gemini: Boolean(keys?.gemini) }), "gemini", { gemini: geminiKey });
      const speechModel = runner.catalog.speechModel;
      const { value } = await runner.run("gemini", async (model) => {
        const response = await runner.gemini().models.generateContent({
          model,
          contents: [{ parts: [{ text: `Provide professional, encouraging audio feedback on this resume critique: ${text}` }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: "Zephyr" }
              }
            }
          }
        });
        return { response, usage: response.usageMetadata };
      }, [speechModel]);

      logModelUsage(runner, "/api/resume-feedback-audio");
      const audioData = value.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      res.setHeader("X-AI-Model", speechModel);
      res.json({ audioData });
    } catch (error: any) {
      console.error("[TTS Feedback] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Endpoint to download PDF from session
  app.get("/api/download-pdf/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    const session = pdfSessions.get(sessionId);
    if (!session) {
      return res.status(404).send("PDF session expired or not found. Please try generating again.");
    }
    // Optional: delete session after retrieval to save memory
    // pdfSessions.delete(sessionId);
    await handlePdfGeneration(session.html, session.css, session.fonts, res, session.title, session.scale);
  });

  // Counts pages in a Chrome-generated PDF. Chrome/Skia writes object dictionaries
  // uncompressed, so each page appears as a literal "/Type /Page" (the page-tree
  // node is "/Type /Pages", hence the negative lookahead). Returns 0 if the buffer
  // can't be parsed, which callers treat as "unknown" and fail open.
  function countPdfPages(buffer: Uint8Array): number {
    const raw = Buffer.from(buffer).toString('latin1');
    const matches = raw.match(/\/Type\s*\/Page(?![sA-Za-z0-9])/g);
    return matches ? matches.length : 0;
  }

  async function handlePdfGeneration(html: string, css: string, fonts: string, res: any, title: string = "Resume", scale?: number) {
    if (!html) {
      return res.status(400).json({ error: "HTML content is required" });
    }

    let browser;
    try {
      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      
      browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ["--no-sandbox"],
      });

      const page = await browser.newPage();
      
      // Hard scale parameters to force perfect layout metrics
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });

      const baseHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>${String(title || 'Resume').replace(/[<>]/g, '')}</title>
            <style>
              /* 1. ATS-SAFE, LOCALLY-RESOLVABLE FONT STACK
                 We deliberately do NOT use a Google web font here. Chrome's PDF
                 backend does not embed downloaded web fonts: it writes a font
                 descriptor with a name but no /FontFile2, /Subtype or /BaseFont.
                 That produces a structurally incomplete font entry, which is why
                 the PDF failed to render in Explorer/Outlook preview panes, tripped
                 viewer warnings, and drifted visually from machine to machine -
                 every reader had to guess a substitute font.
                 Locally-installed fonts ARE embedded properly (full /FontFile2 +
                 /Type0 + /CIDFontType2), so the file becomes self-contained and
                 renders identically everywhere. Calibri first (the metrics the
                 layout is tuned for), then metric-compatible / universally present
                 fallbacks so the same output is produced on Linux CI or a Mac. */
              * { box-sizing: border-box; }

              @page { 
                size: A4; 
                margin: 10mm 10mm !important; /* Reclaims horizontal space on the physical page */
              }

              html, body {
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                height: auto !important;
                background: white;
                font-family: Calibri, Carlito, 'Segoe UI', Arial, 'Liberation Sans', Helvetica, sans-serif !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }

              /* 1b. DISABLE TYPOGRAPHIC LIGATURES - CRITICAL FOR ATS PARSING.
                 By default the font merges 'fi', 'fl', 'ffi' and 'ffl' into single
                 glyphs, and they extract from the PDF as U+FB01/U+FB02/... instead
                 of plain ASCII. An applicant tracking system searching the text
                 layer therefore never matches high-value keywords: 'Configured'
                 became 'Con<fi>gured', 'workflows' became 'work<fl>ows', and
                 'Certified', 'Firewall', 'Defined' and 'Efficiency' were all
                 silently unsearchable. Turning ligatures off keeps them as real
                 characters with no visible change to the layout. */
              html, body, * {
                font-variant-ligatures: none !important;
                -webkit-font-feature-settings: "liga" 0, "clig" 0, "dlig" 0, "hlig" 0 !important;
                font-feature-settings: "liga" 0, "clig" 0, "dlig" 0, "hlig" 0 !important;
              }

              /* 2. STRETCH CONTENT HORIZONTALLY */
              #resume-container, .resume-page {
                width: 100% !important;
                max-width: 100% !important;
                min-width: 0 !important;   /* index.css pins .resume-page to 210mm; that overflows a 190mm print box */
                height: auto !important;
                min-height: 0 !important;  /* index.css pins 297mm, which forces spurious blank pages */
                margin: 0 auto !important;
                /* Overrides the massive 25mm internal padding from React to use the full page width */
                padding: 0mm 5mm !important; 
                box-shadow: none !important;
                border: none !important;
              }

              .resume-page {
                display: block !important; /* flex containers paginate badly in print */
              }

              /* Reduce bullet point indentation to gain more line length */
              ul {
                padding-left: 16px !important;
                margin-left: 0 !important;
              }

              /* 3. Typography
                 NOTE: We intentionally do NOT force a blanket font-size here anymore.
                 Every resume text node (name, section headings, job titles, bullets)
                 already carries its own explicit inline font-size from the editor's
                 formatting engine (e.g. 18pt name, 13pt section headings, 10.5pt body).
                 An '!important' rule here would beat those inline styles outright and
                 flatten the whole document down to one tiny, illegible size -
                 destroying the visual hierarchy the user configured on-screen.
                 Fitting long resumes to the page is instead handled by the
                 'transform: scale(printScale)' rule injected from the frontend
                 (see scaleCSS in App.tsx), which shrinks the whole layout
                 proportionally so text stays readable and properly sized relative
                 to everything else. */
              p, li, span, div, .resume-bullet-text {
                line-height: 1.4;
              }

              p, li, .resume-bullet-text, .experience-item div {
                text-align: left !important;
                text-justify: auto !important;
              }

              /* 4. Clean Section Spacing */
              .resume-section { margin-bottom: 8px !important; padding: 0 !important; }
              .experience-item { margin-bottom: 6px !important; }
              ul.resume-list { margin-top: 4px !important; margin-bottom: 4px !important; }
              li { margin-bottom: 4px !important; }

              /* Dynamic Scale Injection from Frontend */
              ${css || ''}
              ${fonts || ''}

              /* 5. FINAL ATS ENFORCEMENT - must be last.
                 The captured application CSS above is injected after our base rules,
                 so anything we declared earlier can still be overridden by it (an
                 equally-specific '!important' rule later in the sheet wins). These
                 two guarantees are non-negotiable for a resume that has to survive
                 both a PDF preview handler and an ATS text parser, so we restate
                 them here where nothing can outrank them. */
              html, body, #resume-container, .resume-page, #resume-container * {
                font-family: Calibri, Carlito, 'Segoe UI', Arial, 'Liberation Sans', Helvetica, sans-serif !important;
                font-variant-ligatures: none !important;
                -webkit-font-feature-settings: "liga" 0, "clig" 0, "dlig" 0, "hlig" 0 !important;
                font-feature-settings: "liga" 0, "clig" 0, "dlig" 0, "hlig" 0 !important;
              }

              /* Text must stay real, selectable, opaque text - never outlines or
                 transparent fills, which extract as nothing at all. */
              #resume-container * {
                -webkit-text-fill-color: currentColor !important;
                -webkit-text-stroke: 0 !important;
              }
            </style>
          </head>
          <body>
            ${html}
          </body>
        </html>
      `;

      // Set content and wait for it to load
      await page.setContent(baseHtml, { 
        waitUntil: "networkidle0", 
        timeout: 30000 
      });

      // Wait for Google Fonts to load
      await page.evaluateHandle('document.fonts.ready');

      // Hard 2-page guarantee.
      //
      // The frontend can only estimate a fit factor from the on-screen preview,
      // which has different geometry from the print box - so an estimate alone
      // regularly lands on 3 pages. Instead we close the loop: render, count the
      // pages Chrome actually produced, and binary-search for the LARGEST scale
      // that still fits. That both guarantees the page count and keeps the text as
      // large (and therefore as readable) as possible.
      //
      // Shrink-to-fit uses page.pdf({ scale }) - Chrome's own print scale, which
      // repaginates correctly - rather than a CSS transform, which does not: Chrome
      // computes page breaks from the untransformed layout box, so a transform
      // shrinks the painted pixels but leaves the pagination alone.
      const MAX_PAGES = 2;
      const MIN_SCALE = 0.5; // below this the resume stops being comfortably legible

      const renderAt = (s: number) => page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: false,
        preferCSSPageSize: true,
        scale: s,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
      });

      // Full size first - most resumes already fit and need no shrinking at all.
      let pdfBuffer = await renderAt(1);
      let pageCount = countPdfPages(pdfBuffer);

      // pageCount === 0 means the buffer couldn't be parsed; fail open and ship it.
      if (pageCount > MAX_PAGES) {
        let lo = MIN_SCALE;
        let hi = 1;
        let best: Uint8Array | null = null;

        // Seed the search with the frontend's estimate so we converge faster.
        const hint = Number(scale);
        const probes: number[] = [];
        if (Number.isFinite(hint) && hint > lo && hint < hi) probes.push(hint);
        for (let i = probes.length; i < 5; i++) probes.push(NaN);

        for (const seeded of probes) {
          const mid = Number.isFinite(seeded) ? seeded : (lo + hi) / 2;
          const candidate = await renderAt(mid);
          const pages = countPdfPages(candidate);
          if (pages > 0 && pages <= MAX_PAGES) {
            best = candidate; // fits - try to grow back toward full size
            lo = mid;
          } else {
            hi = mid; // still too long - shrink further
          }
        }

        // If even MIN_SCALE overflows, emit that rather than an oversized document.
        pdfBuffer = best ?? await renderAt(MIN_SCALE);
        pageCount = countPdfPages(pdfBuffer);
      }

      res.setHeader("Content-Type", "application/pdf");
      const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.pdf"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.setHeader("X-Resume-Page-Count", String(pageCount));
      res.end(pdfBuffer);

    } catch (error: any) {
      console.error("CRITICAL PDF ERROR:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate PDF", details: error.message });
      }
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          console.error("Error closing puppeteer:", e);
        }
      }
    }
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.post("/api/match-resume", express.json(), async (req, res) => {
    const { resumes, jobDescription, generateCoverLetter } = req.body;
    try {
        // AI matching logic using Gemini here
        // ... (simplified representation of AI logic)
        res.json({ success: true, bestResume: resumes[0], analysis: "...", coverLetter: generateCoverLetter ? "..." : null });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/generate-cover-letter", express.json(), async (req, res) => {
    const { resume, jobDescription } = req.body;
    try {
        // AI cover letter generation logic
        res.json({ success: true, coverLetter: "..." });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
  });

  app.listen(PORT, "0.0.0.0", () => {

    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});