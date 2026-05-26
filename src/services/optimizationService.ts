import { GoogleGenAI, Type } from "@google/genai";

export interface OptimizationInput {
  resumeText: string;
  jobDescription: string;
  mode: string;
  targetAudience: string;
  customPrompt?: string;
}

/**
 * Step 1: Extract only the most relevant data from the resume using Gemini (cheap)
 */
export async function extractRelevantResumeData(resumeText: string, geminiApiKey: string): Promise<any> {
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  const prompt = `
    Extract the most important information from this resume for a job application.
    Focus on:
    1. All technical and soft skills
    2. Every professional experience listed (Role, Company, Key Achievements)
    3. Education history
    4. Certifications
    
    STRICT RULE: Extract EVERY SINGLE role present in the resume. Do not skip any jobs.
    Extract all bullets per role to ensure complete experience history.
    
    RESUME:
    ${resumeText}
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });
  
  const text = response.text || "";
  
  try {
    // Basic JSON extraction from markdown if needed
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || text;
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse extracted resume data:", e);
    return { raw: resumeText.substring(0, 2000) }; // Fallback
  }
}

/**
 * Step 1b: Extract key requirements and keywords from the JD using Gemini (cheap)
 */
export async function extractJDKeywords(jobDescription: string, geminiApiKey: string): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  const prompt = `
    Extract the top 15-20 essential keywords and requirements from this job description.
    Include technical skills, tools, methodologies, and soft skills mentioned.
    
    Return only a JSON array of strings.
    
    JOB DESCRIPTION:
    ${jobDescription}
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });
  
  const text = response.text || "";
  
  try {
    const jsonStr = text.match(/\[[\s\S]*\]/)?.[0] || text;
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse JD keywords:", e);
    return [];
  }
}

/**
 * Step 2: Trim and structure content to minimize tokens for the expensive AI call
 */
export function trimContentForAI(structuredData: any, keywords: string[]): any {
  // Remove redundant or low-value fields if they exist
  const seenBullets = new Set<string>();
  if (structuredData.experience && Array.isArray(structuredData.experience)) {
    structuredData.experience = structuredData.experience.map((exp: any) => ({
      ...exp,
      achievements: exp.achievements ? exp.achievements.filter((a: string) => {
        const normalized = a.toLowerCase().trim();
        if (seenBullets.has(normalized)) return false;
        seenBullets.add(normalized);
        return true;
      }).slice(0, 50) : []
    }));
  }

  // Remove redundant or low-value fields if they exist
  delete structuredData.references;
  delete structuredData.hobbies;

  return {
    ...structuredData,
    target_keywords: keywords
  };
}
