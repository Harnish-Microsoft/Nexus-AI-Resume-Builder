import crypto from 'crypto';
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { pipelineCache } from './cacheUtility';

/**
 * Token Optimization Strategy
 */

/**
 * Trims input text to a reasonable limit before sending to any AI
 */
export function trimInput(text: string, maxLength: number = 8000): string {
  if (!text) return "";
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}

export async function extractRelevantResumeData(resumeText: string, geminiApiKey: string, openaiApiKey: string = '', pipelineType: string = 'hybrid-gemini') {
  const isHybridOpenAI = pipelineType === 'hybrid-openai' && openaiApiKey;

  if (isHybridOpenAI) {
    const openai = new OpenAI({ apiKey: openaiApiKey });
    const trimmedResume = trimInput(resumeText, 15000);
    const prompt = `
      Extract essential professional data from this resume. 
      Focus on high-impact achievements and core skills.
      Return ONLY a JSON object:
      {
        "personal_info": { "name": "", "location": "", "email": "", "phone": "", "linkedin": "" },
        "summary": "Brief professional overview",
        "skills": ["Skill 1", "Skill 2"],
        "experience": [
          {
            "role": "Job Title",
            "company": "Company Name",
            "duration": "Dates",
            "achievements": ["Achievement 1", "Achievement 2"]
          }
        ],
        "projects": [
          { "title": "Project Name", "description": "Description" }
        ],
        "education": ["Degree, School"],
        "certifications": [
          { "name": "Cert Name", "issuer": "Issuing Body", "date": "Date" }
        ]
      }
      STRICT RULE: Extract EVERY SINGLE role present in the resume. Do not skip any jobs, even very old ones.
      Extract all bullets per role EXACTLY AS WRITTEN in the original resume. DO NOT summarize, rewrite, or attempt to refine the language of bullet points in this stage. Maintain absolute fidelity to original experience text.
      
      RESUME:
      ${trimmedResume}
    `;

    try {
      console.log(`[Nexus AI] Stage 1: Extraction. Attempting with OpenAI (gpt-4o)...`);
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });
      const text = completion.choices[0].message.content || "";
      const parsed = JSON.parse(text);
      return { 
        data: parsed, 
        usage: { promptTokenCount: completion.usage?.prompt_tokens, candidatesTokenCount: completion.usage?.completion_tokens, totalTokenCount: completion.usage?.total_tokens }, 
        _model: "gpt-4o" 
      };
    } catch (error) {
      console.error("Error extracting resume data with OpenAI:", error);
    }
  }

  const genAI = new GoogleGenAI(geminiApiKey ? { apiKey: geminiApiKey } : {});
  const trimmedResume = trimInput(resumeText, 15000);

  const prompt = `
    Extract essential professional data from this resume. 
    Focus on high-impact achievements and core skills.
    Return ONLY a JSON object:
    {
      "personal_info": { "name": "", "location": "", "email": "", "phone": "", "linkedin": "" },
      "summary": "Brief professional overview",
      "skills": ["Skill 1", "Skill 2"],
      "experience": [
        {
          "role": "Job Title",
          "company": "Company Name",
          "duration": "Dates",
          "achievements": ["Achievement 1", "Achievement 2"]
        }
      ],
      "projects": [
        { "title": "Project Name", "description": "Description" }
      ],
      "education": ["Degree, School"],
      "certifications": [
        { "name": "Cert Name", "issuer": "Issuing Body", "date": "Date" }
      ]
    }
    STRICT RULE: Extract EVERY SINGLE role present in the resume. Do not skip any jobs, even very old ones.
    Extract all bullets per role EXACTLY AS WRITTEN in the original resume. DO NOT summarize, rewrite, or attempt to refine the language of bullet points in this stage. Maintain absolute fidelity to original experience text.
    
    RESUME:
    ${trimmedResume}
  `;

  // Stage 1: Extraction
  let primaryModel = "gemini-3.1-pro-preview";
  let fallbackModel = "gemini-3-flash-preview";

  try {
    try {
      console.log(`[Nexus AI] Stage 1: Extraction. Attempting with ${primaryModel}...`);
      const response = await genAI.models.generateContent({
        model: primaryModel,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const text = response.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      
      if (parsed) {
        return { data: parsed, usage: (response as any).usageMetadata, _model: primaryModel };
      }
    } catch (quotaError: any) {
      const errorMsg = quotaError?.message?.toLowerCase() || "";
      if (errorMsg.includes("quota") || errorMsg.includes("429") || errorMsg.includes("resource_exhausted")) {
        console.warn(`[Optimization] ${primaryModel} quota reached. Falling back to ${fallbackModel}...`);
        const response = await genAI.models.generateContent({
          model: fallbackModel,
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });
        const text = response.text || "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        
        if (parsed) {
          return { data: parsed, usage: (response as any).usageMetadata, _model: fallbackModel };
        }
      } else {
        throw quotaError;
      }
    }
    return { data: null, usage: null };
  } catch (error) {
    console.error("Error extracting resume data:", error);
    return { data: null, usage: null };
  }
}

export async function extractJDKeywords(jobDescription: string, geminiApiKey: string, openaiApiKey: string = '', pipelineType: string = 'hybrid-gemini') {
  const isHybridOpenAI = pipelineType === 'hybrid-openai' && openaiApiKey;

  if (isHybridOpenAI) {
    const openai = new OpenAI({ apiKey: openaiApiKey });
    const trimmedJD = trimInput(jobDescription, 10000);
    const prompt = `
      Extract the top 12 essential keywords and requirements from this job description.
      Return ONLY a JSON array of strings.
      
      JD:
      ${trimmedJD}
    `;

    try {
      console.log(`[Nexus AI] Stage 1: JD Keywords. Attempting with OpenAI (gpt-4o)...`);
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });
      const text = completion.choices[0].message.content || "";
      const parsed = JSON.parse(text);
      // Expected output is a JSON array
      const keywords = (parsed && Array.isArray(parsed)) ? parsed : (parsed.keywords || []);
      return { 
        data: keywords, 
        usage: { promptTokenCount: completion.usage?.prompt_tokens, candidatesTokenCount: completion.usage?.completion_tokens, totalTokenCount: completion.usage?.total_tokens }, 
        _model: "gpt-4o" 
      };
    } catch (error) {
      console.error("Error extracting JD keywords with OpenAI:", error);
    }
  }

  const genAI = new GoogleGenAI(geminiApiKey ? { apiKey: geminiApiKey } : {});
  const trimmedJD = trimInput(jobDescription, 10000);

  const prompt = `
    Extract the top 12 essential keywords and requirements from this job description.
    Return ONLY a JSON array of strings.
    
    JD:
    ${trimmedJD}
  `;

  // Stage 1: JD Analysis
  let primaryModel = "gemini-3.1-pro-preview";
  let fallbackModel = "gemini-3-flash-preview";

  try {
    try {
      console.log(`[Nexus AI] Stage 1: JD Keywords. Attempting with ${primaryModel}...`);
      const response = await genAI.models.generateContent({
        model: primaryModel,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const text = response.text || "";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const keywords = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      
      if (keywords && keywords.length > 0) {
        return { data: keywords, usage: (response as any).usageMetadata, _model: primaryModel };
      }
    } catch (quotaError: any) {
      const errorMsg = quotaError?.message?.toLowerCase() || "";
      if (errorMsg.includes("quota") || errorMsg.includes("429") || errorMsg.includes("resource_exhausted")) {
        console.warn(`[Optimization] ${primaryModel} quota reached. Falling back to ${fallbackModel}...`);
        const response = await genAI.models.generateContent({
          model: fallbackModel,
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });
        const text = response.text || "";
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const keywords = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        
        if (keywords && keywords.length > 0) {
          return { data: keywords, usage: (response as any).usageMetadata, _model: fallbackModel };
        }
      } else {
        throw quotaError;
      }
    }
    return { data: [], usage: null };
  } catch (error) {
    console.error("Error extracting JD keywords:", error);
    return { data: [], usage: null };
  }
}

export function trimContentForAI(resumeData: any, keywords: string[]) {
  // Remove duplicates from skills and achievements
  const seenSkills = new Set<string>();
  const uniqueSkills = (resumeData.skills || []).filter((s: string) => {
    const normalized = s.toLowerCase().trim();
    if (seenSkills.has(normalized)) return false;
    seenSkills.add(normalized);
    return true;
  });

    // Ensure we don't exceed reasonable limits but provide enough for Step 3
    return {
      personal_info: resumeData.personal_info || {},
      // Trim summary to reasonable length for prompt safety
      summary: resumeData.summary?.substring(0, 1200),
      skills: uniqueSkills.slice(0, 100),
      experience: (resumeData.experience || []).map((exp: any, index: number) => {
        const seenBullets = new Set<string>();
        return {
          id: `role_${index + 1}`,
          role: exp.role,
          company: exp.company,
          duration: exp.duration,
          // Remove duplicate bullets and provide more context for AI selection
          original_bullets: (exp.achievements || [])
            .filter((a: string) => {
              const normalized = a.toLowerCase().trim();
              if (seenBullets.has(normalized)) return false;
              seenBullets.add(normalized);
              return true;
            })
            .slice(0, 50)
        };
      }),
      projects: (resumeData.projects || []).slice(0, 20),
      education: resumeData.education,
      certifications: resumeData.certifications,
      jd_keywords: (keywords || []).slice(0, 30)
    };
}

export function enforceFidelity(aiResponse: any, originalInput: any) {
  try {
    const aiData = typeof aiResponse === 'string' ? JSON.parse(aiResponse) : aiResponse;
    const originalExperience = originalInput.experience || [];
    const aiExperience = aiData.experience || [];

    // Create a map for quick lookup by ID
    const aiRoleMap = new Map();
    aiExperience.forEach((role: any) => {
      if (role.id) aiRoleMap.set(role.id, role);
    });

    // Reconstruct experience based STRICKLY on original structure
    const enforcedExperience = originalExperience.map((originalRole: any) => {
      const matchedAI = aiRoleMap.get(originalRole.id);
      
      return {
        role: originalRole.role,
        company: originalRole.company,
        duration: originalRole.duration,
        // Force use of original_bullets to prevent AI from overwriting experience.
        bullets: (originalRole.original_bullets || [])
      };
    });

    // Return the full object with enforced experience
    return {
      ...aiData,
      experience: enforcedExperience
    };
  } catch (error) {
    console.error("[Fidelity] Error enforcing structure:", error);
    return aiResponse; // Fallback to raw if logic fails
  }
}

export function clearCache() {
  pipelineCache.clear();
}

export function saveToCache(key: string, data: any) {
  pipelineCache.set(key, data);
}
