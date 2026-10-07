import { saveAs } from "file-saver";
import { resumeFileName } from "../lib/atsDocument";
import type { AtsFont } from "../lib/atsDocument";
import type { OptimizationResult } from "./geminiService";

export const downloadDOCX = async (
  resume: OptimizationResult, targetRole: string, companyName: string,
  showToast: (message: string, type: "success" | "error" | "info") => void,
  beforeSave?: () => void, font: AtsFont = "Arial"
) => {
  try {
    const { createResumeDOCX } = await import("../lib/docxExport");
    const blob = await createResumeDOCX(resume, font);
    beforeSave?.();
    if (blob.size > 2_500_000) showToast("This DOCX exceeds Greenhouse's documented 2.5 MB parsing limit. Check your portal's limit.", "info");
    saveAs(blob, resumeFileName(resume, targetRole, "docx"));
    showToast("DOCX downloaded; document content checked.", "success");
    return true;
  } catch (error) {
    console.error("DOCX export failed:", error);
    showToast(error instanceof Error ? error.message : "DOCX export failed.", "error");
    return false;
  }
};

export const downloadJSON = (resume: OptimizationResult, targetRole: string, companyName: string, showToast: (message: string, type: "success" | "error") => void) => {
  try {
    saveAs(new Blob([JSON.stringify(resume, null, 2)], { type: "application/json" }), resumeFileName(resume, targetRole, "json", companyName));
    showToast("JSON exported.", "success");
  } catch (error) {
    console.error("JSON export failed:", error);
    showToast("JSON export failed.", "error");
  }
};
