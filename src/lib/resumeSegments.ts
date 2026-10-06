/**
 * Stable, readable addresses for the editable parts of a generated resume, so a
 * reviewer can point at "E2.3" and a correction can replace exactly that text
 * and nothing else.
 *
 *   S         summary                  W        why_this_job
 *   KC<c>     skills category name     K<c>.<i> skills entry
 *   E<r>.<b>  experience bullet        P<p>     project description
 *   PT<p>     project title
 *
 * Indexes are 1-based. Job titles, employers, dates, education and
 * certifications have no address: they are the candidate's verbatim history.
 *
 * Dependency-free: bundled by both esbuild (server) and vite (browser).
 */

export type ResumeSegmentKind =
  | "summary"
  | "why_this_job"
  | "skill_category"
  | "skill"
  | "bullet"
  | "project"
  | "project_title";

export interface ResumeSegment {
  id: string;
  kind: ResumeSegmentKind;
  label: string;
  text: string;
}

function filled(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function categoryNames(skills: Record<string, unknown>): string[] {
  return Object.keys(skills).filter((name) => !name.startsWith("_"));
}

function roleName(role: any, index: number): string {
  return [role?.role, role?.company].filter(filled).join(" @ ") || `Role ${index + 1}`;
}

export function resumeSegments(resume: any): ResumeSegment[] {
  const out: ResumeSegment[] = [];
  if (!resume || typeof resume !== "object") return out;
  if (filled(resume.summary)) out.push({ id: "S", kind: "summary", label: "Summary", text: resume.summary });
  if (filled(resume.why_this_job)) out.push({ id: "W", kind: "why_this_job", label: "Why this job", text: resume.why_this_job });

  const skills = resume.skills;
  if (Array.isArray(skills)) {
    skills.forEach((entry: unknown, i: number) => {
      if (filled(entry)) out.push({ id: `K1.${i + 1}`, kind: "skill", label: "Skills", text: entry });
    });
  } else if (skills && typeof skills === "object") {
    categoryNames(skills).forEach((name, c) => {
      out.push({ id: `KC${c + 1}`, kind: "skill_category", label: "Skills category", text: name });
      const entries = skills[name];
      const label = `Skills \u203a ${name}`;
      if (Array.isArray(entries)) {
        entries.forEach((entry: unknown, i: number) => {
          if (filled(entry)) out.push({ id: `K${c + 1}.${i + 1}`, kind: "skill", label, text: entry });
        });
      } else if (filled(entries)) {
        out.push({ id: `K${c + 1}.1`, kind: "skill", label, text: entries });
      }
    });
  }

  (Array.isArray(resume.experience) ? resume.experience : []).forEach((role: any, r: number) => {
    const name = roleName(role, r);
    (Array.isArray(role?.bullets) ? role.bullets : []).forEach((bullet: unknown, b: number) => {
      if (filled(bullet)) out.push({ id: `E${r + 1}.${b + 1}`, kind: "bullet", label: `${name}, bullet ${b + 1}`, text: bullet });
    });
  });

  (Array.isArray(resume.projects) ? resume.projects : []).forEach((project: any, p: number) => {
    if (filled(project)) {
      out.push({ id: `P${p + 1}`, kind: "project", label: `Project ${p + 1}`, text: project });
      return;
    }
    if (!project || typeof project !== "object") return;
    const title = filled(project.title) ? project.title : "";
    if (title) out.push({ id: `PT${p + 1}`, kind: "project_title", label: `Project ${p + 1} title`, text: title });
    if (filled(project.description)) {
      out.push({ id: `P${p + 1}`, kind: "project", label: `Project: ${title || p + 1}`, text: project.description });
    }
  });
  return out;
}

export function readSegment(resume: any, id: string): string | null {
  return resumeSegments(resume).find((segment) => segment.id === id)?.text ?? null;
}

type Address =
  | { kind: "summary" | "why_this_job" }
  | { kind: "skill_category"; c: number }
  | { kind: "skill"; c: number; i: number }
  | { kind: "bullet"; r: number; b: number }
  | { kind: "project" | "project_title"; p: number };

function parseAddress(id: string): Address | null {
  if (id === "S") return { kind: "summary" };
  if (id === "W") return { kind: "why_this_job" };
  let m = /^KC(\d+)$/.exec(id);
  if (m) return { kind: "skill_category", c: Number(m[1]) - 1 };
  m = /^K(\d+)\.(\d+)$/.exec(id);
  if (m) return { kind: "skill", c: Number(m[1]) - 1, i: Number(m[2]) - 1 };
  m = /^E(\d+)\.(\d+)$/.exec(id);
  if (m) return { kind: "bullet", r: Number(m[1]) - 1, b: Number(m[2]) - 1 };
  m = /^PT(\d+)$/.exec(id);
  if (m) return { kind: "project_title", p: Number(m[1]) - 1 };
  m = /^P(\d+)$/.exec(id);
  if (m) return { kind: "project", p: Number(m[1]) - 1 };
  return null;
}

/** Renames a category in place, keeping every category's position; never merges, which would shift later addresses. */
function renameCategory(resume: any, index: number, name: string): boolean {
  const skills = resume.skills;
  const names = categoryNames(skills);
  const from = names[index];
  if (from === undefined || !name) return false;
  if (from === name) return true;
  if (Object.prototype.hasOwnProperty.call(skills, name)) return false;
  const rebuilt: Record<string, unknown> = {};
  for (const key of Object.keys(skills)) rebuilt[key === from ? name : key] = skills[key];
  resume.skills = rebuilt;
  return true;
}

/** Replaces the text at an address. False when the address does not exist. */
export function writeSegment(resume: any, id: string, text: string): boolean {
  const address = parseAddress(id);
  if (!address || !resume || typeof resume !== "object") return false;
  switch (address.kind) {
    case "summary":
      resume.summary = text;
      return true;
    case "why_this_job":
      resume.why_this_job = text;
      return true;
    case "skill_category":
      return Boolean(resume.skills && typeof resume.skills === "object" && !Array.isArray(resume.skills)) &&
        renameCategory(resume, address.c, text);
    case "skill": {
      const skills = resume.skills;
      if (Array.isArray(skills)) {
        if (address.c !== 0 || address.i >= skills.length) return false;
        skills[address.i] = text;
        return true;
      }
      if (!skills || typeof skills !== "object") return false;
      const name = categoryNames(skills)[address.c];
      if (name === undefined) return false;
      const entries = skills[name];
      if (Array.isArray(entries) && address.i < entries.length) {
        entries[address.i] = text;
        return true;
      }
      if (typeof entries === "string" && address.i === 0) {
        skills[name] = text;
        return true;
      }
      return false;
    }
    case "bullet": {
      const bullets = resume.experience?.[address.r]?.bullets;
      if (!Array.isArray(bullets) || address.b >= bullets.length) return false;
      bullets[address.b] = text;
      return true;
    }
    case "project":
    case "project_title": {
      const projects = resume.projects;
      if (!Array.isArray(projects) || address.p >= projects.length) return false;
      const project = projects[address.p];
      if (typeof project === "string") {
        if (address.kind !== "project") return false;
        projects[address.p] = text;
        return true;
      }
      if (!project || typeof project !== "object") return false;
      project[address.kind === "project" ? "description" : "title"] = text;
      return true;
    }
  }
  return false;
}

/**
 * Deletes bullets and skills entries, last index first so earlier addresses stay
 * valid. A role always keeps at least one bullet. Returns the ids deleted.
 */
export function deleteSegments(resume: any, ids: string[]): string[] {
  const bullets = new Map<number, number[]>();
  const skills = new Map<number, number[]>();
  for (const id of ids) {
    const address = parseAddress(id);
    if (address?.kind === "bullet") bullets.set(address.r, [...(bullets.get(address.r) || []), address.b]);
    else if (address?.kind === "skill") skills.set(address.c, [...(skills.get(address.c) || []), address.i]);
  }
  const deleted: string[] = [];
  for (const [r, indexes] of bullets) {
    const list = resume?.experience?.[r]?.bullets;
    if (!Array.isArray(list)) continue;
    for (const b of Array.from(new Set(indexes)).sort((x, y) => y - x)) {
      if (b < list.length && list.length > 1) {
        list.splice(b, 1);
        deleted.push(`E${r + 1}.${b + 1}`);
      }
    }
  }
  for (const [c, indexes] of skills) {
    const source = resume?.skills;
    const list = Array.isArray(source)
      ? c === 0 ? source : null
      : source && typeof source === "object"
        ? source[categoryNames(source)[c]]
        : null;
    if (!Array.isArray(list)) continue;
    for (const i of Array.from(new Set(indexes)).sort((x, y) => y - x)) {
      if (i < list.length) {
        list.splice(i, 1);
        deleted.push(`K${c + 1}.${i + 1}`);
      }
    }
  }
  return deleted;
}
