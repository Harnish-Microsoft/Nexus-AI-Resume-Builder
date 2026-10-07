import type { OptimizationResult } from "../services/geminiService";
import { formatCertification } from "./certifications";
import { parseDurationRange } from "./bulletBudget";

export const ATS_FONTS = ["Arial", "Calibri", "Cambria", "Georgia", "Times New Roman", "Verdana"] as const;
export type AtsFont = typeof ATS_FONTS[number];
export const ATS_BODY_PT = 11;
export const ATS_LINE_HEIGHT = 1.25;

export function atsSafePDFStyle(font: AtsFont): string {
  return `
    @page { size: A4; margin: 16mm !important; }
    html, body, #resume-container, .resume-page, #resume-container * {
      font-family: '${font}', Arial, 'Liberation Sans', serif !important;
      letter-spacing: normal !important;
      line-height: 1.25 !important;
      font-variant-ligatures: none !important;
      color: #000 !important;
    }
    html, body { margin: 0 !important; padding: 0 !important; }
    #resume-container, .resume-page { width: 100% !important; min-width: 0 !important; padding: 0 !important; transform: none !important; }
    .ats-safe-resume p { font-size: 11pt !important; margin: 0 0 6pt !important; break-inside: avoid; }
    .ats-safe-resume h1 { font-size: 18pt !important; }
    .ats-safe-resume h2 { font-size: 12pt !important; break-after: avoid; }
  `;
}

export interface ExportBlock {
  kind: "name" | "contact" | "heading" | "text" | "bullet";
  text: string;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function educationText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const entry = value as Record<string, unknown>;
  return [entry.degree, entry.institution || entry.school, entry.field_of_study || entry.major, entry.duration || entry.expected_completion || entry.graduation_date]
    .map(text).filter(Boolean).join(" | ");
}

export function canonicalResume(resume: OptimizationResult, overrides: Partial<OptimizationResult["personal_info"]> = {}): OptimizationResult {
  return {
    ...structuredClone(resume),
    personal_info: { ...resume.personal_info, ...Object.fromEntries(Object.entries(overrides).filter(([, value]) => text(value))) },
  };
}

/** Both exports and the safe preview consume the same ordered content. */
export function exportBlocks(resume: OptimizationResult): ExportBlock[] {
  const blocks: ExportBlock[] = [];
  const add = (kind: ExportBlock["kind"], value: string) => { if (value.trim()) blocks.push({ kind, text: value.trim() }); };
  const info = resume.personal_info;
  add("name", info.name);
  add("contact", [info.location, info.email, info.phone, info.linkedin].filter(Boolean).join(" | "));
  const section = (heading: string, values: string[], kind: "text" | "bullet" = "text") => {
    if (!values.some(value => value.trim())) return;
    add("heading", heading);
    values.forEach(value => add(kind, value));
  };
  section("Professional Summary", [resume.summary || ""]);
  const skills: unknown = resume.skills;
  section("Skills", Array.isArray(skills) ? [skills.join(", ")] :
    Object.entries(skills || {}).filter(([name]) => !name.startsWith("_"))
      .map(([name, items]) => `${name}: ${Array.isArray(items) ? items.join(", ") : text(items)}`));
  if (resume.experience.length) {
    add("heading", "Work Experience");
    resume.experience.forEach(role => {
      add("text", [role.role, role.company, role.duration].filter(Boolean).join(" | "));
      role.bullets.forEach(bullet => add("bullet", bullet));
    });
  }
  if (resume.projects?.length) {
    add("heading", "Projects");
    for (const project of resume.projects) {
      if (typeof project === "string") add("text", project);
      else { add("text", project.title); add("text", project.description); }
    }
  }
  section("Certifications", (resume.certifications || []).map(formatCertification), "bullet");
  section("Education", (resume.education || []).map(educationText));
  return blocks;
}

export function resumeFileName(resume: OptimizationResult, role: string, extension: string, company?: string): string {
  const safe = (value: string) => value.replace(/[<>:"/\\|?*\x00-\x1f]/g, "").replace(/[. ]+$/g, "").trim();
  return `${[safe(resume.personal_info.name) || "Candidate", safe(role) || "Resume", company ? safe(company) : ""].filter(Boolean).join("-")}.${extension}`;
}

export function applicationFields(resume: OptimizationResult): string {
  const lines = [
    "WORKDAY APPLICATION REVIEW — verify every autofilled field before submission",
    `Name: ${resume.personal_info.name}`, `Email: ${resume.personal_info.email}`,
    `Phone: ${resume.personal_info.phone}`, `Location: ${resume.personal_info.location}`,
  ];
  resume.experience.forEach((role, index) => {
    const range = parseDurationRange(role.duration);
    const endpoints = role.duration.split(/\s+[-–—]\s+|\s*[–—]\s*|\s+to\s+/i);
    const exactMonth = (value = "") => /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\d{1,2}[/-]\d{4}|\d{4}-\d{2}/i.test(value);
    const date = (value: Date) => value.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    lines.push("", `Employment ${index + 1}`, `Employer: ${role.company}`, `Job title: ${role.role}`,
      `Dates as stated: ${role.duration}`,
      `Start: ${range && exactMonth(endpoints[0]) ? date(range.start) : "Confirm month/year from source; do not infer"}`,
      `End: ${range?.ongoing ? "Present" : range && exactMonth(endpoints[1]) ? date(range.end) : "Confirm month/year from source; do not infer"}`,
      ...role.bullets.map(bullet => `- ${bullet}`));
  });
  lines.push("", "Education", ...(resume.education || []).map(educationText), "",
    "Review institution, degree, subject and dates against your source. Missing fields must be supplied by you.",
    "Answer work authorization, sponsorship, clearance and other eligibility questions yourself. Nothing is inferred here.",
    "Check the employer portal's accepted file types and upload limit. Attachments are not a substitute for required fields.");
  return lines.join("\n");
}

export function structuredResumeWarnings(resume: OptimizationResult): string[] {
  const warnings: string[] = [];
  if (!resume.personal_info.name.trim()) warnings.push("Candidate name is missing.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resume.personal_info.email)) warnings.push("Review the missing or invalid email address.");
  if (!resume.personal_info.phone.trim()) warnings.push("Phone number is missing.");
  const ranges = resume.experience.map((role, index) => {
    if (!role.company || !role.role) warnings.push(`Employment ${index + 1}: employer or job title is missing.`);
    const range = parseDurationRange(role.duration);
    if (!range) warnings.push(`Employment ${index + 1}: dates need review (${role.duration || "missing"}).`);
    return range;
  });
  ranges.forEach((range, index) => {
    if (!range) return;
    ranges.slice(index + 1).forEach((other, offset) => {
      if (other && Math.max(range.start.getTime(), other.start.getTime()) < Math.min(range.end.getTime(), other.end.getTime())) {
        warnings.push(`Employment ${index + 1} and ${index + offset + 2} overlap. Confirm concurrent roles or correct source dates.`);
      }
    });
  });
  (resume.education || []).forEach((entry, index) => {
    if (typeof entry === "string") warnings.push(`Education ${index + 1}: confirm institution, degree and dates in the application; free text is not field-verified.`);
    else if (entry && typeof entry === "object") {
      const education = entry as Record<string, unknown>;
      if (!text(education.degree) || !text(education.institution || education.school)) warnings.push(`Education ${index + 1}: institution or degree is missing.`);
      if (!text(education.duration || education.graduation_date || education.expected_completion)) warnings.push(`Education ${index + 1}: dates are missing; supply them only if known.`);
    } else warnings.push(`Education ${index + 1} is incomplete.`);
  });
  (resume.certifications || []).forEach((certification, index) => {
    if (!formatCertification(certification)?.trim()) warnings.push(`Certification ${index + 1}: name is missing.`);
  });
  return warnings;
}

/** Readability defaults, not vendor-mandated ATS typography. */
export function typographyWarnings(font: string, sizePt: number, lineHeight: number, letterSpacing: number, scale = 1): string[] {
  const warnings: string[] = [];
  if (!ATS_FONTS.some(name => font.replace(/["']/g, "").split(",")[0].trim().toLowerCase() === name.toLowerCase())) {
    warnings.push("Use a conventional text font, or verify custom-font embedding and extraction.");
  }
  if (!Number.isFinite(sizePt * scale) || sizePt * scale < 10) warnings.push("Effective body text is below the recommended 10 pt readability floor.");
  if (!Number.isFinite(lineHeight) || lineHeight < 1.15 || lineHeight > 1.5) warnings.push("Recommended line spacing is 1.15–1.5 for readable resume text.");
  if (!Number.isFinite(letterSpacing) || Math.abs(letterSpacing) > 0.02) warnings.push("Avoid expanded or compressed letter spacing; use normal spacing for extraction.");
  return warnings;
}
