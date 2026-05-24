import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { pipelineCache } from "../cacheUtility.js";

export interface OptimizationMetadata {
  engine: "openai" | "gemini";
  model: string;
  fallbackUsed: boolean;
  cacheHit: boolean;
  pipeline: string;
  latencyMs: number;
}

export interface OptimizationResponse {
  data: any;
  meta: OptimizationMetadata;
}

export async function optimizePipeline(input: {
  resumeText: string;
  jobDescription: string;
  targetRole: string;
  mode: string;
  audience: string;
  pipelineType: "hybrid-openai" | "gemini-only";
  forceRefresh?: boolean;
}): Promise<OptimizationResponse> {
  const startTime = Date.now();
  const { resumeText, jobDescription, targetRole, mode, audience, pipelineType, forceRefresh } = input;

  const cacheKey = pipelineCache.generateKey({ resumeText, jobDescription, targetRole, mode, audience, pipelineType });

  if (!forceRefresh) {
    const cached = pipelineCache.get<OptimizationResponse>(cacheKey);
    if (cached) {
      console.log(`[CACHE] HIT: ${cacheKey}`);
      return { ...cached, meta: { ...cached.meta, cacheHit: true } };
    }
  }
  console.log(`[CACHE] MISS: ${cacheKey}`);

  // Stage 1: Extraction
  console.log("[PIPELINE] Stage 1: Gemini Extraction शुरू");
  // [Placeholder for actual extraction logic]

  // STAGE 2: Generation
  console.log("[PIPELINE] Stage 2: OpenAI Generation शुरू");
  let responseData: any;
  let engine: "openai" | "gemini" = "openai";
  let fallbackUsed = false;
  let modelUsed = "gpt-4o";

  try {
    // Attempt OpenAI
    // [Placeholder for actual OpenAI generation]
    responseData = { optimizedResume: "Sample optimized resume" };
  } catch (error) {
    console.warn("[FALLBACK] OpenAI failed, retrying once...");
    try {
        // Retry
        responseData = { optimizedResume: "Sample optimized resume (retry)" };
    } catch (retryError) {
        console.error("[FALLBACK] OpenAI retry failed, switching to Gemini.");
        fallbackUsed = true;
        engine = "gemini";
        modelUsed = "gemini-3.1-flash-lite-preview";
        // [Placeholder for actual Gemini fallback]
        responseData = { optimizedResume: "Sample optimized resume (Gemini fallback)" };
    }
  }
  
  const result: OptimizationResponse = { 
    data: responseData, 
    meta: { 
        engine, 
        model: modelUsed, 
        fallbackUsed, 
        cacheHit: false, 
        pipeline: "v3", 
        latencyMs: Date.now() - startTime 
    } 
  };
  
  // Do NOT cache fallback results as primary
  if (!fallbackUsed) {
      pipelineCache.set(cacheKey, result);
  }
  return result;
}
