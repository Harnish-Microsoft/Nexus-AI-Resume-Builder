/**
 * Deterministic JD <-> resume match scoring.
 *
 * The model is NOT asked to guess a match score. Language models given a JSON
 * schema with example numbers simply echo those numbers back, which is why every
 * resume previously reported the same 60 -> 85 pair. Scores here are computed in
 * code from the actual job description, the actual source resume, and the actual
 * generated document, so two different postings produce two different numbers.
 *
 * Keep this module dependency-free: it is bundled by both esbuild (server.ts)
 * and vite (browser), exactly like resumePrompt.ts.
 */

import { findExcludedTerms } from "./exclusions";

export interface ScoreComponent {
  id: string;
  label: string;
  /** Relative weight within the final score. Weights are renormalised when a component is unavailable. */
  weight: number;
  /** 0..1 */
  score: number;
  detail: string;
}

/** Required skills carry full weight; nice-to-haves count at PREFERRED_WEIGHT of it. */
export type RequirementTier = "required" | "preferred";

export interface TierCoverage {
  total: number;
  matched: string[];
  partial: string[];
  missing: string[];
}

export type ReadinessLevel = "strong" | "good" | "partial" | "low";

/** A plain-language reading of the score. There is no universal ATS cutoff, so this is not a pass mark. */
export interface MatchReadiness {
  level: ReadinessLevel;
  label: string;
  /** Share of the required skills evidenced (partial matches count half), or null when the JD lists none separately. */
  required_coverage: number | null;
  guidance: string;
}

export interface MatchScoreBreakdown {
  score: number;
  components: ScoreComponent[];
  matched: string[];
  partial: string[];
  missing: string[];
  /** Optional only because results saved before v2 scoring lack them. */
  required?: TierCoverage;
  preferred?: TierCoverage;
  readiness?: MatchReadiness;
}

export interface MatchScoreResult {
  match_score: number;
  baseline_score: number;
  ats_keywords_from_jd: string[];
  ats_keywords_added_to_resume: string[];
  keyword_gap: string[];
  score_breakdown: {
    method: string;
    jd_keywords_evaluated: number;
    required_years: number | null;
    candidate_years: number | null;
    baseline: MatchScoreBreakdown;
    optimized: MatchScoreBreakdown;
  };
}

export interface MatchScoreInput {
  jobDescription: string;
  /** Raw text of the resume the user uploaded, before optimization. */
  originalResumeText: string;
  /** The generated resume object (parsed JSON from the model). */
  optimizedResume: any;
  targetRole?: string;
  /** Keywords surfaced by the extraction stage. Verified against the JD before use. */
  jdKeywords?: string[];
}

const STOPWORDS = new Set([
  "a", "about", "above", "across", "after", "against", "all", "also", "am", "an", "and", "any",
  "are", "as", "at", "back", "be", "because", "been", "before", "being", "below", "best", "both",
  "but", "by", "can", "could", "day", "did", "do", "does", "doing", "done", "down", "during",
  "each", "either", "else", "etc", "even", "every", "few", "for", "from", "further", "get", "give",
  "go", "good", "great", "had", "has", "have", "having", "he", "her", "here", "hers", "him", "his",
  "how", "however", "i", "if", "in", "including", "into", "is", "it", "its", "just", "keep", "know",
  "like", "look", "made", "make", "making", "many", "may", "me", "more", "most", "much", "must",
  "my", "need", "needs", "new", "no", "nor", "not", "now", "of", "off", "on", "once", "one", "only",
  "or", "other", "others", "our", "ours", "out", "over", "own", "per", "plus", "role", "s", "same",
  "see", "set", "shall", "she", "should", "so", "some", "strong", "such", "sure", "take",
  "than", "that", "the", "their", "theirs", "them", "then", "there", "these", "they", "this",
  "those", "through", "to", "too", "under", "until", "up", "upon", "us", "use", "used", "using",
  "very", "via", "was", "we", "well", "were", "what", "when", "where", "whether", "which", "while",
  "who", "whom", "why", "will", "with", "within", "without", "work", "working", "would", "year",
  "years", "you", "your", "yours",
]);

/** Generic posting filler that is never a differentiating requirement. */
const NOISE_TERMS = new Set([
  "ability", "applicant", "applicants", "application", "applications", "benefits", "candidate",
  "candidates", "career", "company", "compensation", "culture", "customer", "day to day",
  "employee", "employees", "employer", "employment", "environment", "equal opportunity",
  "experience", "expertise", "familiarity", "full time", "high quality", "hiring", "job",
  "knowledge", "location", "offer", "opportunity", "organization", "part time", "pay", "people",
  "person", "position", "preferred", "proficiency", "qualifications", "remote", "requirement",
  "requirements", "responsibilities", "responsibility", "salary", "skill", "skills", "team",
  "teams", "type", "we are", "workplace",
  // Generic nouns that surface as phrase fragments ("sites & services") but name no skill.
  "service", "services", "solution", "solutions", "system", "systems", "platform", "platforms",
  "tool", "tools", "tooling", "technology", "technologies", "process", "processes", "project",
  "projects", "product", "products", "function", "functions", "module", "modules", "concept",
  "concepts", "pattern", "patterns", "practice", "practices", "standard", "standards", "workload",
  "workloads", "environments", "capabilities", "fundamentals", "basics",
]);

/**
 * Terms that mean the same thing to a human reviewer. Membership is symmetric:
 * any member matching in the resume satisfies any other member from the JD.
 */
const ALIAS_GROUPS: string[][] = [
  ["ci/cd", "cicd", "ci cd", "continuous integration", "continuous delivery", "continuous deployment"],
  ["k8s", "kubernetes"],
  ["iac", "infrastructure as code"],
  ["sre", "site reliability engineering", "site reliability"],
  ["aws", "amazon web services"],
  ["gcp", "google cloud", "google cloud platform"],
  ["azure", "microsoft azure"],
  ["js", "javascript"],
  ["ts", "typescript"],
  ["node", "node.js", "nodejs"],
  ["react", "react.js", "reactjs"],
  ["vue", "vue.js", "vuejs"],
  ["angular", "angular.js", "angularjs"],
  [".net", "dotnet", "dot net"],
  ["postgres", "postgresql", "psql"],
  ["mongo", "mongodb"],
  ["ml", "machine learning"],
  ["ai", "artificial intelligence"],
  ["nlp", "natural language processing"],
  ["llm", "llms", "large language model", "large language models"],
  ["rest", "restful", "rest api", "restful api", "rest apis"],
  ["api", "apis"],
  ["oop", "object oriented", "object-oriented", "object oriented programming"],
  ["etl", "extract transform load", "data pipeline", "data pipelines"],
  ["qa", "quality assurance"],
  ["ux", "user experience"],
  ["ui", "user interface"],
  ["db", "database", "databases"],
  ["observability", "monitoring", "telemetry"],
  ["saas", "software as a service"],
  ["kpi", "kpis", "key performance indicator", "key performance indicators"],
  ["rbac", "role based access control", "role-based access control"],
  ["sso", "single sign on", "single sign-on"],
  ["iam", "identity and access management"],
  ["vcs", "version control", "source control"],
  ["agile", "scrum", "kanban"],
  ["tdd", "test driven development", "test-driven development"],
  ["ci", "continuous integration"],
  ["devsecops", "devops"],
  ["gen ai", "genai", "generative ai"],
  ["sql server", "mssql", "microsoft sql server"],
  ["power bi", "powerbi"],
  ["excel", "microsoft excel"],
  // Microsoft / Azure infrastructure: postings and resumes mix old and new product names freely.
  ["entra id", "azure ad", "azure active directory", "aad", "microsoft entra id", "microsoft entra"],
  ["active directory", "ad", "ad ds", "active directory domain services"],
  ["ad cs", "adcs", "active directory certificate services"],
  ["pki", "public key infrastructure"],
  ["adfs", "ad fs", "active directory federation services"],
  ["group policy", "gpo", "gpos", "group policies", "group policy objects"],
  [
    "sccm", "mecm", "configmgr", "configuration manager", "system center configuration manager",
    "microsoft endpoint configuration manager",
  ],
  ["scom", "system center operations manager"],
  ["wsus", "windows server update services"],
  ["azure site recovery", "asr"],
  ["disaster recovery", "dr"],
  ["high availability", "ha"],
  ["root cause analysis", "rca"],
  ["kql", "kusto", "kusto query language"],
  ["log analytics", "log analytics workspace", "log analytics workspaces"],
  ["sentinel", "microsoft sentinel", "azure sentinel"],
  ["defender for cloud", "microsoft defender for cloud", "azure security center", "azure defender"],
  ["mde", "defender for endpoint", "microsoft defender for endpoint"],
  ["key vault", "azure key vault", "keyvault"],
  ["arm templates", "arm", "arm template", "azure resource manager"],
  ["dsc", "desired state configuration", "powershell dsc"],
  ["vm", "virtual machine", "virtual machines"],
  ["vmss", "virtual machine scale sets", "virtual machine scale set", "scale sets"],
  ["vnet", "virtual network", "virtual networks"],
  ["nsg", "network security group", "network security groups"],
  ["asg", "application security group", "application security groups"],
  ["waf", "web application firewall"],
  ["application gateway", "app gateway", "azure application gateway"],
  ["load balancing", "load balancer", "load balancers"],
  ["expressroute", "express route"],
  ["iis", "internet information services"],
  ["laps", "local administrator password solution"],
  ["jit", "just in time", "just-in-time"],
  ["jea", "just enough administration"],
  ["mfa", "multi-factor authentication", "multifactor authentication"],
  ["intune", "microsoft intune", "endpoint manager", "microsoft endpoint manager"],
  ["autopilot", "windows autopilot"],
  ["m365", "microsoft 365", "office 365", "o365"],
  ["azure devops", "vsts"],
  ["failover clustering", "failover cluster", "failover clusters", "wsfc"],
  ["azure update manager", "update manager", "update management"],
  ["itsm", "it service management"],
  ["infrastructure", "infra"],
  ["applications", "apps"],
];

/**
 * Short forms that are also ordinary words ("ad hoc", "Dr.", "ha", an arm).
 * They only count as the acronym when written in capitals in the resume.
 */
const CASE_SENSITIVE_FORMS = new Set(["ad", "dr", "ha", "arm"]);

/**
 * Every member of a synonym family, merged transitively: groups that share a
 * member are one concept, so a posting's "Azure AD" and a resume's "Entra ID"
 * are the same requirement.
 */
const { ALIAS_LOOKUP, FAMILY_OF } = (() => {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root) as string;
    parent.set(x, root);
    return root;
  };
  for (const group of ALIAS_GROUPS) {
    for (const member of group) if (!parent.has(member)) parent.set(member, member);
    for (const member of group.slice(1)) {
      const a = find(group[0]);
      const b = find(member);
      if (a !== b) parent.set(b, a);
    }
  }
  const families = new Map<string, string[]>();
  for (const member of parent.keys()) {
    const root = find(member);
    families.set(root, [...(families.get(root) || []), member]);
  }
  const lookup = new Map<string, string[]>();
  const familyOf = new Map<string, string>();
  for (const [root, members] of families) {
    for (const member of members) {
      lookup.set(member, members);
      familyOf.set(member, root);
    }
  }
  return { ALIAS_LOOKUP: lookup, FAMILY_OF: familyOf };
})();

/**
 * High-precision skill vocabulary. A dictionary hit is a strong signal that a
 * token is a real requirement rather than posting filler. This is a booster,
 * not a gate: pattern and phrase extraction below cover non-tech domains.
 */
const SKILL_DICTIONARY = [
  "python", "java", "javascript", "typescript", "golang", "go", "rust", "c++", "c#", "ruby", "php",
  "scala", "kotlin", "swift", "perl", "bash", "powershell", "shell scripting", "sql", "nosql",
  "html", "css", "sass", "react", "angular", "vue", "svelte", "next.js", "node.js", "express",
  "django", "flask", "fastapi", "spring boot", "spring", ".net", "asp.net", "laravel", "rails",
  "aws", "azure", "gcp", "google cloud", "kubernetes", "docker", "terraform", "ansible", "puppet", "pulumi",
  "chef", "jenkins", "github actions", "gitlab ci", "argocd", "helm", "openshift", "vmware",
  "linux", "windows server", "active directory", "networking", "tcp/ip", "dns", "vpn", "firewall",
  "load balancing", "microservices", "serverless", "lambda", "ec2", "s3", "rds", "eks", "aks",
  "cloudformation", "cloudwatch", "datadog", "prometheus", "grafana", "splunk", "elk", "new relic",
  "postgresql", "mysql", "mongodb", "redis", "cassandra", "dynamodb", "oracle", "sql server",
  "snowflake", "databricks", "bigquery", "redshift", "kafka", "rabbitmq", "spark", "hadoop",
  "airflow", "dbt", "etl", "data warehouse", "data modeling", "data governance", "power bi",
  "tableau", "looker", "excel", "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch",
  "machine learning", "deep learning", "nlp", "computer vision", "mlops", "generative ai", "llm",
  "prompt engineering", "rag", "vector database",
  "git", "ci/cd", "devops", "devsecops", "sre", "infrastructure as code", "observability",
  "incident management", "disaster recovery", "high availability", "capacity planning",
  "performance tuning", "cost optimization", "automation", "scripting", "api design",
  "rest", "graphql", "grpc", "soap", "oauth", "jwt", "saml", "sso", "iam", "rbac", "encryption",
  "penetration testing", "vulnerability management", "threat modeling", "soc 2", "iso 27001",
  "gdpr", "hipaa", "pci dss", "nist", "compliance", "risk management", "audit", "security",
  "agile", "scrum", "kanban", "jira", "confluence", "sdlc", "tdd", "unit testing",
  "integration testing", "automated testing", "selenium", "cypress", "playwright", "pytest",
  "junit", "code review", "pair programming", "technical documentation",
  "stakeholder management", "cross-functional", "mentoring", "roadmap", "product strategy",
  "requirements gathering", "business analysis", "process improvement", "change management",
  "vendor management", "budget management", "project management", "pmp", "prince2", "itil",
  "customer success", "account management", "negotiation", "forecasting", "kpi",
  "financial modeling", "accounting", "payroll", "recruiting", "onboarding", "training",
  "supply chain", "logistics", "inventory management", "procurement", "quality assurance",
  "lean", "six sigma", "root cause analysis",
  // Microsoft / Azure infrastructure. Capitalised product names ("Sentinel", "Intune",
  // "Bicep") never pass the looks-technical test, so they must be listed to be found.
  "entra id", "azure ad", "intune", "autopilot", "conditional access", "identity governance",
  "microsoft 365", "exchange online", "sharepoint", "sentinel", "defender for cloud",
  "defender for endpoint", "key vault", "bicep", "arm templates", "log analytics", "azure monitor",
  "kql", "group policy", "gpo", "pki", "ad cs", "ad ds", "adfs", "dhcp", "iis", "sccm", "mecm", "wsus",
  "scom", "azure site recovery", "azure backup", "azure files", "azure policy", "azure update manager",
  "azure automation", "azure functions", "azure devops", "azure arc", "azure migrate", "vmss",
  "virtual machines", "vnet", "private dns", "private endpoints", "nsg", "application gateway",
  "waf", "expressroute", "failover clustering", "dsc", "pester", "laps", "credential guard",
  "hyper-v", "mfa", "zero trust", "cis benchmarks", "cyber essentials", "problem management",
  "major incident", "vulnerability remediation", "backup", "clustering", "servicenow", "itsm",
];

const DICTIONARY_SET = new Set(SKILL_DICTIONARY);

/** Tokens that pass the "looks technical" pattern test but carry no meaning. */
const TOKEN_BLOCKLIST = new Set([
  "i", "a", "us", "uk", "eu", "ok", "ceo", "cto", "cfo", "coo", "vp", "jr", "sr", "phd", "bs",
  "ba", "ma", "ms", "mba", "am", "pm", "eod", "eta", "faq", "tbd", "n/a", "e.g", "i.e", "etc",
  "inc", "llc", "ltd", "corp", "co", "and/or", "24/7", "401k", "pto", "eeo", "id",
  // Posting and HR shorthand that names no skill.
  "sme", "fte", "wfh", "ctc", "lpa", "hq", "jd", "asap", "fyi", "usa", "uae", "apac", "emea", "amer",
]);

/** Slash compounds that name ONE thing. Every other "a/b" is read as two terms, the way a recruiter reads it. */
const SLASH_COMPOUNDS = new Set(["ci/cd", "tcp/ip", "udp/ip", "i/o", "a/b", "pl/sql", "s/4hana", "24/7", "and/or", "n/a"]);

/** Non-breaking, en and em dashes, minus signs. "AZ‑104" must read like "AZ-104". */
const UNICODE_DASHES = /[\u2010-\u2015\u2212]/g;

function separateSlashes(text: string): string {
  return text.replace(/[^\s/]*\/[^\s]*/g, (token) =>
    SLASH_COMPOUNDS.has(token.replace(/[.-]+$/, "")) ? token : token.split("/").join(" / ")
  );
}

function normalize(text: string): string {
  const basic = (text || "")
    .toLowerCase()
    .replace(/\u00ad/g, "")
    .replace(UNICODE_DASHES, "-")
    .replace(/[\u2018\u2019\u201c\u201d]/g, " ")
    .replace(/[^a-z0-9+#./\s-]/g, " ");
  return (
    separateSlashes(basic)
      // Sentence punctuation is not part of a word: "Azure." must match "Azure".
      // Inner dots survive ("node.js", ".net"); lookahead only - no lookbehind (Safari 14).
      .replace(/[.-]+(?=\s|$)/g, " ")
      .replace(/(^|\s)-+/g, "$1")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Space-padded so `indexOf(" term ")` acts as a word-boundary test. */
function padded(text: string): string {
  return ` ${normalize(text)} `;
}

function tokenize(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean);
}

function isMeaningful(term: string): boolean {
  if (!term) return false;
  if (term.length < 2) return false;
  if (NOISE_TERMS.has(term)) return false;
  if (/^[\d\s.+#/-]+$/.test(term)) return false;
  const words = term.split(" ").filter(Boolean);
  if (words.length === 0 || words.length > 4) return false;
  if (words.every((w) => STOPWORDS.has(w))) return false;
  if (words.length === 1 && (STOPWORDS.has(words[0]) || TOKEN_BLOCKLIST.has(words[0]))) return false;
  return true;
}

function trimTermEdges(term: string): string {
  const words = term.split(" ").filter(Boolean);
  while (words.length && STOPWORDS.has(words[0])) words.shift();
  while (words.length && STOPWORDS.has(words[words.length - 1])) words.pop();
  return words.join(" ");
}

/** Lines stating a hard requirement carry more weight than nice-to-haves. */
const REQUIREMENT_HINT =
  /\b(require[ds]?|must\s+have|must-have|minimum|mandatory|essential|qualification|responsib|proficien|expertise|hands[-\s]?on|demonstrated|proven|at\s+least)\b/i;

function splitLines(text: string): string[] {
  // No lookbehind: vite's default target includes Safari 14, where a lookbehind
  // regex literal is a SyntaxError that would take the whole bundle down.
  return (text || "")
    .replace(/([.;])\s{2,}/g, "$1\n")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

interface TermCandidate {
  term: string;
  sources: Set<string>;
  /** Other spellings the posting uses for this exact term ("vms" for "vm"). */
  surfaces: Set<string>;
}

function addCandidate(map: Map<string, TermCandidate>, rawTerm: string, source: string, rawSurface?: string): void {
  const term = trimTermEdges(normalize(rawTerm));
  if (!isMeaningful(term)) return;
  const surface = rawSurface ? normalize(rawSurface) : "";
  const existing = map.get(term);
  if (existing) {
    existing.sources.add(source);
    if (surface && surface !== term) existing.surfaces.add(surface);
  } else {
    map.set(term, { term, sources: new Set([source]), surfaces: new Set(surface && surface !== term ? [surface] : []) });
  }
}

/**
 * Detects tokens that look like a technology or proper noun in the ORIGINAL
 * casing: internal capitals, digit/letter mixes, all-caps acronyms, or symbols
 * that only appear in tool names (c++, c#, node.js, ci/cd).
 */
function looksTechnical(rawToken: string): boolean {
  const token = rawToken.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9+#]+$/g, "");
  if (token.length < 2 || token.length > 24) return false;
  if (TOKEN_BLOCKLIST.has(token.toLowerCase())) return false;
  if (STOPWORDS.has(token.toLowerCase())) return false;
  if (/^[A-Z]{2,6}$/.test(token)) return true;
  if (/[a-z][A-Z]/.test(token)) return true;
  if (/^[A-Za-z]+[0-9]+$/.test(token) && token.length > 3) return true;
  if (/[+#]/.test(token)) return true;
  // Library-style names ("Node.js", "Socket.io"). An allowlist of extensions, because a
  // missing space after a full stop ("here.You") has the same shape.
  if (/^[A-Za-z0-9]+\.(?:js|ts|jsx|tsx|net|io|py|rb|sh|ai|db)$/i.test(token)) return true;
  return false;
}

/**
 * The technical terms one raw posting token contributes. Slash compounds are
 * split ("Sentinel/Defender", "PKI/Certificates"), sentence punctuation is
 * dropped, plural acronyms are singularised ("VMs", "NSGs") and certification
 * codes are kept whole ("AZ-104").
 */
function technicalTerms(rawToken: string): { term: string; surface?: string }[] {
  const token = rawToken.replace(/[.-]+$/, "");
  const parts = SLASH_COMPOUNDS.has(token.toLowerCase()) ? [token] : token.split("/");
  const out: { term: string; surface?: string }[] = [];
  for (const rawPart of parts) {
    const part = rawPart.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9+#]+$/g, "");
    if (!part || TOKEN_BLOCKLIST.has(part.toLowerCase())) continue;
    if (/^[A-Z]{2,4}-\d{2,4}$/.test(part)) {
      out.push({ term: part });
    } else if (/^[A-Z]{2,6}s$/.test(part)) {
      // The posting only ever says "VMs": keep that spelling so sections and counts still find it.
      out.push({ term: part.slice(0, -1), surface: part });
    } else if (looksTechnical(part)) {
      out.push({ term: part });
    }
  }
  return out;
}

/** Trailing words that make a phrase fragment longer without naming a different skill. */
const GENERIC_TAIL_WORDS = new Set([
  "patterns", "pattern", "concepts", "concept", "fundamentals", "basics", "practices", "practice",
  "fixes", "principles", "experience", "skills", "knowledge", "tooling", "capabilities",
]);

function trimGenericTail(term: string): string {
  const words = term.split(" ");
  while (words.length > 1 && GENERIC_TAIL_WORDS.has(words[words.length - 1])) words.pop();
  return words.join(" ");
}

/** Phrase fragments are read up to this many characters; a fragment that hits the cap may end mid-word. */
const PHRASE_MAX = 160;

const PHRASE_PATTERNS = [
  /(?:experience\s+(?:with|in|using|of)|proficien\w*\s+(?:in|with)|knowledge\s+of|expertise\s+in|familiarity\s+with|skilled\s+in|background\s+in|hands[-\s]?on\s+(?:with|experience\s+with)|working\s+with|strong\s+(?:in|with)|understanding\s+of)\s+([^.;:\n]{3,160})/gi,
];

const PHRASE_SPLIT = /,|;|\(|\)|\/|&|\||\band\b|\bor\b|\bas well as\b|\bsuch as\b|\bincluding\b|\be\.g\b/i;

function extractPhraseTerms(jd: string): string[] {
  const out: string[] = [];
  for (const pattern of PHRASE_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(jd)) !== null) {
      const fragment = match[1];
      const parts = fragment.split(PHRASE_SPLIT);
      // A fragment cut off at the length cap ends mid-word ("... Defender for Cloud, Sentine"):
      // its last part is never a real term.
      if (fragment.length >= PHRASE_MAX) parts.pop();
      for (const part of parts) {
        const cleaned = trimGenericTail(trimTermEdges(normalize(part)));
        if (!cleaned || cleaned.split(" ").length > 4) continue;
        // A lone lowercase word in a sub-list ("sites & services, trusts") is a qualifier, not a
        // skill. Capitalised names ("Figma") and known skills ("backup") are kept.
        if (!cleaned.includes(" ") && !DICTIONARY_SET.has(cleaned)) {
          const original = (part.match(/[A-Za-z0-9][A-Za-z0-9+#.-]*/g) || []).find((w) => w.toLowerCase() === cleaned);
          if (original && /^[a-z]/.test(original)) continue;
        }
        out.push(cleaned);
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Posting sections: what is required, what is nice to have, and what is
 * company boilerplate that names no requirement at all.
 * ------------------------------------------------------------------ */

type SectionKind = RequirementTier | "ignored";

/** Nice-to-haves still count, at this share of a required skill's weight. */
const PREFERRED_WEIGHT = 0.5;
/**
 * Runaway guards, per tier so nice-to-haves never crowd out required skills.
 * Dense postings legitimately name 60+ requirements; these only stop a
 * pathological extraction, never trim a real posting.
 */
const MAX_REQUIRED_TERMS = 90;
const MAX_PREFERRED_TERMS = 30;

/** Every word a pure section heading can be made of ("Required Skills & Experience", "Nice to Have"). */
const HEADING_WORDS = new Set([
  "key", "core", "main", "primary", "minimum", "basic", "required", "requirement", "requirements",
  "essential", "technical", "professional", "job", "role", "position", "description", "summary",
  "overview", "responsibilities", "responsibility", "duties", "qualifications", "qualification",
  "must", "have", "haves", "skills", "skill", "experience", "experiences", "what", "you", "youll",
  "you'll", "bring", "need", "we're", "looking", "who", "tools", "tool", "technologies",
  "technology", "tech", "stack", "about", "opportunity", "nice", "good", "preferred", "desirable",
  "desired", "bonus", "points", "point", "pluses", "plus", "optional", "advantageous",
  "certifications", "certification", "certs", "knowledge", "education", "abilities", "ability",
  "competencies", "competency", "expertise", "background", "additional", "other", "extra",
  "extras", "profile", "ideal", "candidate", "mandatory", "criteria", "your", "tasks", "task",
  "impact", "mission", "day", "life",
]);
const PREFERRED_HEADING_WORDS = new Set([
  "nice", "good", "preferred", "desirable", "desired", "bonus", "pluses", "plus", "optional", "advantageous",
]);
const ROLE_HEADING_WORDS = new Set(["job", "role", "position", "opportunity", "you", "yourself", "candidate", "team"]);
/** Whole-line company/HR headings. Anchored at both ends, so "Benefits administration using Workday" stays content. */
const IGNORED_HEADING =
  /^(?:about\s+(?:us|the\s+company|our\s+company)|who\s+we\s+are|our\s+(?:company|culture|story|mission|values|benefits)|company\s+(?:description|profile|overview|information)|benefits(?:\s+(?:and|&)\s+perks)?|perks(?:\s+(?:and|&)\s+benefits)?|what\s+we\s+offer|why\s+(?:join|work\s+(?:with|for|at))(?:\s+\S+){0,3}|compensation(?:\s+(?:and|&)\s+benefits)?|salary(?:\s+range)?|equal\s+(?:opportunity|employment)(?:\s+\S+){0,3}|eeo(?:\s+statement)?|diversity(?:\s+(?:and|&)\s+inclusion)?(?:\s+statement)?|additional\s+information|how\s+to\s+apply|life\s+at(?:\s+\S+){1,3})$/i;

/** Marks a segment of an otherwise required line as optional: "Terraform (desirable)", "Python is a plus". */
const PREFERRED_INLINE_SOURCE =
  "\\b(?:nice[\\s-]to[\\s-]have|good[\\s-]to[\\s-]have|preferred|preferably|desirable|bonus|a\\s+plus|plus\\s+points?|advantageous|an\\s+advantage|would\\s+be\\s+(?:a\\s+)?(?:plus|bonus|advantage|beneficial|nice)|not\\s+(?:required|mandatory|essential))\\b|\\(\\s*desired\\s*\\)|\\bis\\s+desired\\b";
const PREFERRED_INLINE = new RegExp(PREFERRED_INLINE_SOURCE, "i");
/** Words that qualify an optional marker without naming anything ("legacy familiarity a plus"). */
const INLINE_FILLER = new Set([
  "legacy", "familiarity", "experience", "knowledge", "exposure", "understanding", "basic", "some",
  "highly", "strongly", "very", "also", "would", "nice", "good", "have", "desired",
]);

/** The heading a line opens, or null when the line is content. */
function headingKind(line: string): SectionKind | null {
  // Word processors and job boards write "What You’ll Do" with a curly apostrophe.
  const trimmed = line.replace(/[\u2018\u2019\u02bc]/g, "'").trim();
  if (!trimmed || trimmed.length > 60 || /[.!,;]$/.test(trimmed)) return null;
  const text = trimmed.replace(/[:?\s-]+$/, "").trim();
  const words = text.toLowerCase().replace(/[^a-z0-9\s']/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 7) return null;

  if (IGNORED_HEADING.test(text)) return "ignored";
  // A heading is made entirely of heading vocabulary: "Terraform experience preferred" is content.
  if (words.every((w) => HEADING_WORDS.has(w) || STOPWORDS.has(w))) {
    return words.some((w) => PREFERRED_HEADING_WORDS.has(w)) ? "preferred" : "required";
  }
  // "About KPMG", "KPMG Overview" are company boilerplate; "About the team" is not, and
  // "About 25% travel required" is content.
  if ((words[0] === "about" || words[words.length - 1] === "overview") && words.length <= 4 && !/\d/.test(text)) {
    return words.some((w) => ROLE_HEADING_WORDS.has(w)) ? "required" : "ignored";
  }
  return null;
}

function splitInlinePreferred(line: string): { required: string; preferred: string } {
  const preferred: string[] = [];
  const withoutParens = line.replace(/([^,;()]*)\(([^()]*)\)/g, (whole: string, before: string, inner: string) => {
    if (!PREFERRED_INLINE.test(inner)) return whole;
    const rest = inner.replace(new RegExp(PREFERRED_INLINE_SOURCE, "gi"), " ");
    const named = (rest.toLowerCase().match(/[a-z][a-z0-9+#.-]*/g) || []).filter(
      (w) => !STOPWORDS.has(w) && !INLINE_FILLER.has(w)
    );
    if (named.length > 0) {
      // "Bicep/ARM (Terraform desirable)": only Terraform is optional.
      preferred.push(rest);
      return before;
    }
    // "Intune (desirable)": the thing before the parenthesis is optional.
    preferred.push(before);
    return " ";
  });
  const required: string[] = [];
  for (const part of withoutParens.split(/[,;]/)) {
    if (PREFERRED_INLINE.test(part)) preferred.push(part);
    else required.push(part);
  }
  return { required: required.join(", "), preferred: preferred.join(", ") };
}

interface PostingSections {
  required: string[];
  preferred: string[];
  ignored: string[];
  /** Required lines phrased as a hard requirement, or written as bullets. */
  emphasised: string[];
}

function classifySections(jobDescription: string): PostingSections {
  const sections: PostingSections = { required: [], preferred: [], ignored: [], emphasised: [] };
  let state: SectionKind = "required";
  for (const line of splitLines(jobDescription)) {
    const kind = headingKind(line);
    if (kind) {
      state = kind;
      continue;
    }
    // "Nice to have: Python, Go" - a one-line section.
    const labelled = line.match(/^([^:]{2,50}):\s*(\S.*)$/);
    const labelKind = labelled ? headingKind(labelled[1]) : null;
    const lineState: SectionKind = labelKind || state;
    const body = labelKind && labelled ? labelled[2] : line;

    if (lineState === "ignored") {
      sections.ignored.push(body);
    } else if (lineState === "preferred") {
      sections.preferred.push(body);
    } else {
      const split = splitInlinePreferred(body);
      sections.required.push(split.required);
      if (split.preferred) sections.preferred.push(split.preferred);
      if (REQUIREMENT_HINT.test(body) || /^[-*\u2022\u25cf\d]/.test(body)) sections.emphasised.push(split.required);
    }
  }
  // Safety net: if a boilerplate heading swallowed the whole posting (a requirements heading
  // this parser does not recognise), score it as unclassified rather than drop every requirement.
  if (sections.required.every((line) => !line.trim()) && sections.ignored.length > 0) {
    sections.required.push(...sections.ignored);
    sections.ignored = [];
  }
  return sections;
}

/** Normalized, space-padded text with a de-hyphenated twin, so "SRE-style" still evidences "SRE". */
interface PaddedText {
  plain: string;
  dehyphen: string;
}

function paddedText(text: string): PaddedText {
  const plain = padded(text);
  return { plain, dehyphen: plain.replace(/-/g, " ") };
}

function hasForm(text: PaddedText, form: string): boolean {
  const needle = ` ${form} `;
  return text.plain.includes(needle) || text.dehyphen.includes(needle);
}

function countForm(text: PaddedText, form: string): number {
  return Math.max(countOccurrences(text.plain, form), countOccurrences(text.dehyphen, form));
}

/** Replaces every whole-word occurrence of `form` with a placeholder. */
function maskForm(paddedValue: string, form: string): string {
  const needle = ` ${form} `;
  let out = paddedValue;
  let index = out.indexOf(needle);
  while (index !== -1) {
    out = `${out.slice(0, index)} \u00a7 ${out.slice(index + needle.length)}`;
    index = out.indexOf(needle, index + 2);
  }
  return out;
}

/** One requirement: every wording of it the posting uses, shown to the user in the posting's own words. */
interface Concept {
  term: string;
  forms: string[];
  sources: Set<string>;
}

function displayForm(forms: string[], jd: PaddedText): string {
  return [...forms].sort(
    (a, b) =>
      Number(CASE_SENSITIVE_FORMS.has(a)) - Number(CASE_SENSITIVE_FORMS.has(b)) ||
      countForm(jd, b) - countForm(jd, a) ||
      Number(DICTIONARY_SET.has(b)) - Number(DICTIONARY_SET.has(a)) ||
      b.length - a.length ||
      a.localeCompare(b)
  )[0];
}

/** "Azure AD" and "Entra ID" in one posting are one requirement, not two; so are "VM" and "VMs". */
function mergeSynonyms(candidates: TermCandidate[], jd: PaddedText): Concept[] {
  // A plural the posting also produced as its own candidate ("slas" from a phrase) joins its singular.
  const singularOf = new Map<string, string>();
  for (const candidate of candidates) {
    for (const surface of candidate.surfaces) singularOf.set(surface, candidate.term);
  }
  const familyKey = (term: string): string => {
    const base = singularOf.get(term) ?? term;
    return FAMILY_OF.get(base) ?? base;
  };

  const byFamily = new Map<string, Concept>();
  for (const candidate of candidates) {
    const family = familyKey(candidate.term);
    const forms = [candidate.term, ...candidate.surfaces];
    const existing = byFamily.get(family);
    if (existing) {
      for (const form of forms) if (!existing.forms.includes(form)) existing.forms.push(form);
      candidate.sources.forEach((source) => existing.sources.add(source));
    } else {
      byFamily.set(family, { term: candidate.term, forms, sources: new Set(candidate.sources) });
    }
  }
  const concepts = Array.from(byFamily.values());
  for (const concept of concepts) {
    // Display a canonical spelling, never an inflected surface form the matcher does not know.
    const displayable = concept.forms.filter((form) => !singularOf.has(form) || FAMILY_OF.has(form));
    if (displayable.length > 1) concept.term = displayForm(displayable, jd);
    else if (displayable.length === 1) concept.term = displayable[0];
  }
  return concepts;
}

/**
 * Drops a requirement the posting only ever mentions inside a longer one:
 * "SQL" when every mention is "SQL Server", "SOC" inside "SOC 2". Otherwise one
 * missing skill is penalised twice.
 */
function dropSubsumed(concepts: Concept[], jd: PaddedText): Concept[] {
  const allForms = concepts.flatMap((owner) => owner.forms.map((form) => ({ form, owner })));
  return concepts.filter((concept) => {
    const present = concept.forms.filter((form) => hasForm(jd, form));
    // Verified word-by-word rather than verbatim: nothing to compare against.
    if (present.length === 0) return true;
    const containers = allForms
      .filter(
        ({ form, owner }) =>
          owner !== concept && present.some((f) => form.length > f.length && ` ${form} `.includes(` ${f} `))
      )
      .map(({ form }) => form)
      .sort((a, b) => b.length - a.length);
    if (containers.length === 0) return true;
    let plain = jd.plain;
    let dehyphen = jd.dehyphen;
    for (const form of containers) {
      plain = maskForm(plain, form);
      dehyphen = maskForm(dehyphen, form.replace(/-/g, " "));
    }
    return present.some((form) => hasForm({ plain, dehyphen }, form));
  });
}

interface JdTerm {
  weight: number;
  tier: RequirementTier;
}

type JdTerms = Map<string, JdTerm>;

/**
 * Builds the requirement list the resume is scored against, from the JD itself.
 * Model-supplied keywords are accepted only when they actually occur in the JD,
 * so a hallucinated keyword can never inflate or deflate the score.
 */
function extractJdTerms(jobDescription: string, targetRole: string, providedKeywords: string[]): JdTerms {
  const candidates = new Map<string, TermCandidate>();
  const jd = paddedText(jobDescription);

  for (const skill of SKILL_DICTIONARY) {
    if (hasForm(jd, skill)) addCandidate(candidates, skill, "dictionary");
  }

  const rawTokens = jobDescription.replace(UNICODE_DASHES, "-").match(/[A-Za-z][A-Za-z0-9+#./-]*/g) || [];
  for (const token of rawTokens) {
    for (const { term, surface } of technicalTerms(token)) addCandidate(candidates, term, "pattern", surface);
  }

  for (const phrase of extractPhraseTerms(jobDescription)) {
    addCandidate(candidates, phrase, "phrase");
  }

  for (const keyword of providedKeywords || []) {
    const norm = trimTermEdges(normalize(keyword));
    if (!norm) continue;
    const words = norm.split(" ");
    const verified = hasForm(jd, norm) || (words.length > 1 && words.every((w) => hasForm(jd, w)));
    if (verified) addCandidate(candidates, norm, "extracted");
  }

  const sections = classifySections(jobDescription);
  const requiredText = paddedText(sections.required.join("\n"));
  const preferredText = paddedText(sections.preferred.join("\n"));
  const ignoredText = paddedText(sections.ignored.join("\n"));
  const emphasisedText = paddedText(sections.emphasised.join("\n"));
  const headText = paddedText(jobDescription.slice(0, Math.max(200, Math.floor(jobDescription.length * 0.15))));
  const roleTokens = new Set(tokenize(targetRole || "").filter((t) => !STOPWORDS.has(t)));

  // Collapse redundant phrasings onto the canonical concept. Without this,
  // "infrastructure as code" and "infrastructure as code practices" both consume
  // weight, so one missing skill is penalised twice.
  const canonical = new Set(
    Array.from(candidates.values())
      .filter((c) => DICTIONARY_SET.has(c.term))
      .map((c) => c.term)
  );
  for (const candidate of Array.from(candidates.values())) {
    if (DICTIONARY_SET.has(candidate.term)) continue;
    const paddedTerm = ` ${candidate.term} `;
    for (const base of canonical) {
      if (candidate.term !== base && paddedTerm.includes(` ${base} `)) {
        candidates.delete(candidate.term);
        break;
      }
    }
  }

  const concepts = dropSubsumed(mergeSynonyms(Array.from(candidates.values()), jd), jd);

  const placed = concepts.map((concept) => ({
    concept,
    inRequired: concept.forms.some((f) => hasForm(requiredText, f)),
    inPreferred: concept.forms.some((f) => hasForm(preferredText, f)),
    inIgnored: concept.forms.some((f) => hasForm(ignoredText, f)),
  }));
  const boilerplateOnly = placed.filter((p) => !p.inRequired && !p.inPreferred && p.inIgnored).length;
  // More requirements "only in boilerplate" than anywhere else means a requirements heading
  // this parser did not recognise was swallowed by a company section: stop trusting it.
  const trustIgnored = boilerplateOnly <= placed.length - boilerplateOnly;

  const scored: { term: string; info: JdTerm; occurrences: number }[] = [];
  for (const { concept, inRequired, inPreferred, inIgnored } of placed) {
    // Named only in the company blurb ("KPMG Overview"): not a requirement of the job.
    if (trustIgnored && !inRequired && !inPreferred && inIgnored) continue;
    const tier: RequirementTier = inRequired || !inPreferred ? "required" : "preferred";

    let weight = 1;
    if (concept.forms.some((f) => hasForm(emphasisedText, f))) weight += 1;
    const occurrences = concept.forms.reduce((sum, f) => sum + countForm(jd, f), 0);
    if (occurrences >= 3) weight += 0.5;
    if (concept.forms.some((f) => hasForm(headText, f))) weight += 0.5;
    if (concept.forms.some((f) => f.split(" ").some((w) => roleTokens.has(w)))) weight += 0.5;
    if (concept.sources.has("dictionary") || concept.sources.has("extracted")) weight += 0.5;
    weight = Math.min(3, weight);
    if (tier === "preferred") weight *= PREFERRED_WEIGHT;
    scored.push({ term: concept.term, info: { weight, tier }, occurrences });
  }

  // Strongest first; among equals, the more often the posting repeats a term the more it matters.
  scored.sort((a, b) => b.info.weight - a.info.weight || b.occurrences - a.occurrences || a.term.localeCompare(b.term));
  const required = scored.filter((s) => s.info.tier === "required").slice(0, MAX_REQUIRED_TERMS);
  const preferred = scored.filter((s) => s.info.tier === "preferred").slice(0, MAX_PREFERRED_TERMS);
  return new Map([...required, ...preferred].map((s) => [s.term, s.info] as [string, JdTerm]));
}

function countOccurrences(paddedText: string, term: string): number {
  const needle = ` ${term} `;
  let count = 0;
  let index = paddedText.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = paddedText.indexOf(needle, index + 1);
  }
  return count;
}

/** Plurals of short forms that are other words: "CIS benchmarks" is not CI, "its" is not IT. */
const PLURAL_COLLISIONS = new Set(["cis", "ads", "drs", "has", "arms", "its", "ins", "ons", "ups", "as", "is", "us"]);

function variantsOf(term: string): string[] {
  const variants = new Set<string>([term]);
  for (const alias of ALIAS_LOOKUP.get(term) || []) variants.add(alias);
  for (const base of Array.from(variants)) {
    // "ads", "drs": derived forms of an ambiguous short form are only ordinary words.
    if (CASE_SENSITIVE_FORMS.has(base)) continue;
    const words = base.split(" ");
    const last = words[words.length - 1];
    if (base.endsWith("s")) {
      // Short acronyms ending in "s" are not plurals: VMSS is not "VMs", LAPS is not "lap", AD DS is not "ad d".
      if (last.length > 4) variants.add(base.slice(0, -1));
    } else if (!PLURAL_COLLISIONS.has(`${base}s`)) {
      variants.add(`${base}s`);
    }
    if (base.endsWith("y")) variants.add(`${base.slice(0, -1)}ies`);
    if (base.includes("-")) variants.add(base.replace(/-/g, " "));
    // "sqlserver", but never "adds" from "ad ds": joined short forms read as ordinary words.
    if (words.length > 1 && words.every((w) => w.length >= 3)) variants.add(base.replace(/ /g, ""));
  }
  return Array.from(variants).filter((v) => v.length >= 2);
}

const DERIVATIONAL_SUFFIXES = ["ization", "isation", "ation", "ment", "ing", "ion", "ed", "es", "s"];

/**
 * Crude derivational stem so "automation" in a JD matches "Automated" in a
 * bullet. Only applied to purely alphabetic words long enough that the stem
 * stays specific - normalize() preserves `+ # . / -`, and feeding those to the
 * prefix matcher below would either break the pattern or match wildly.
 */
function stemOf(word: string): string | null {
  if (word.length < 6) return null;
  if (!/^[a-z]+$/.test(word)) return null;
  for (const suffix of DERIVATIONAL_SUFFIXES) {
    if (word.endsWith(suffix)) {
      const stem = word.slice(0, -suffix.length).replace(/([a-z])\1$/, "$1");
      if (stem.length >= 5) return stem;
    }
  }
  return null;
}

function wordPresent(word: string, paddedCorpus: string): boolean {
  if (paddedCorpus.includes(` ${word} `)) return true;
  const stem = stemOf(word);
  if (!stem) return false;
  // Allow a short inflectional tail only: automat -> automated/automating/automation.
  return new RegExp(`\\s${stem}[a-z]{0,5}\\s`).test(paddedCorpus);
}

/** A resume's text, prepared once for every requirement it is checked against. */
export interface Corpus {
  text: PaddedText;
  /** Tokens written in capitals ("AD", "DR"), for short forms that are also ordinary words. */
  upper: Set<string>;
}

function makeCorpus(raw: string): Corpus {
  const upper = new Set<string>();
  for (const token of String(raw || "").match(/[A-Za-z0-9]+/g) || []) {
    if (/[A-Z]/.test(token) && token === token.toUpperCase()) upper.add(token.toLowerCase());
  }
  return { text: paddedText(raw), upper };
}

function corpusHas(corpus: Corpus, form: string): boolean {
  if (CASE_SENSITIVE_FORMS.has(form)) return corpus.upper.has(form);
  return hasForm(corpus.text, form);
}

function wordEvidenced(word: string, corpus: Corpus): boolean {
  if (CASE_SENSITIVE_FORMS.has(word)) return corpus.upper.has(word);
  return wordPresent(word, corpus.text.plain) || wordPresent(word, corpus.text.dehyphen);
}

/** 1 = present verbatim (or via alias/word form), 0.5 = all words present but not adjacent, 0 = absent. */
function termCredit(term: string, corpus: Corpus): number {
  const variants = variantsOf(term);
  for (const variant of variants) {
    if (corpusHas(corpus, variant)) return 1;
  }
  // Word forms of single-word synonyms too: "monitoring" (observability) is evidenced by "Azure Monitor".
  for (const variant of variants) {
    if (!variant.includes(" ") && wordEvidenced(variant, corpus)) return 1;
  }
  const words = term.split(" ").filter((w) => !STOPWORDS.has(w));
  if (words.length > 1 && words.every((w) => wordEvidenced(w, corpus))) return 0.5;
  return 0;
}

const SKILL_HEADER =
  /^\s*(technical\s+|core\s+|key\s+|professional\s+)?(skills?|competencies|technologies|tech\s+stack|toolset|tools?|proficiencies|expertise)\s*:?\s*$/i;
const INLINE_SKILL_LINE = /^\s*(technical\s+)?(skills?|technologies|tools?|tech\s+stack)\s*:/i;
const SECTION_HEADER = /^\s*[A-Z][A-Za-z&\s/]{2,40}:?\s*$/;

/**
 * Evidence = what the candidate demonstrably did, excluding self-declared skill
 * lists. A keyword that appears only in a comma-separated skills dump is far
 * weaker proof than the same keyword inside a delivery bullet, and recruiters
 * read it that way.
 */
function stripSkillSections(rawText: string): string {
  const lines = (rawText || "").split(/\r?\n/);
  const kept: string[] = [];
  let inSkillSection = false;
  for (const line of lines) {
    if (SKILL_HEADER.test(line)) {
      inSkillSection = true;
      continue;
    }
    if (inSkillSection) {
      if (SECTION_HEADER.test(line) && !SKILL_HEADER.test(line)) inSkillSection = false;
      else continue;
    }
    if (INLINE_SKILL_LINE.test(line)) continue;
    kept.push(line);
  }
  return kept.join("\n");
}

function collectStrings(value: any, out: string[], depth = 0): void {
  if (value == null || depth > 6) return;
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, depth + 1);
  } else if (typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (key.startsWith("_")) continue;
      collectStrings(value[key], out, depth + 1);
    }
  }
}

function optimizedFullText(resume: any): string {
  const parts: string[] = [];
  collectStrings(resume?.personal_info, parts);
  if (typeof resume?.summary === "string") parts.push(resume.summary);
  collectStrings(resume?.skills, parts);
  collectStrings(resume?.experience, parts);
  collectStrings(resume?.projects, parts);
  collectStrings(resume?.education, parts);
  collectStrings(resume?.certifications, parts);
  return parts.join("\n");
}

function optimizedEvidenceText(resume: any): string {
  const parts: string[] = [];
  if (typeof resume?.summary === "string") parts.push(resume.summary);
  for (const role of resume?.experience || []) {
    collectStrings(role?.role, parts);
    collectStrings(role?.company, parts);
    collectStrings(role?.bullets, parts);
    collectStrings(role?.description, parts);
  }
  collectStrings(resume?.projects, parts);
  collectStrings(resume?.certifications, parts);
  return parts.join("\n");
}

function roleVocabularyText(resume: any, rawText: string): string {
  const roles: string[] = [];
  for (const role of resume?.experience || []) {
    if (typeof role?.role === "string") roles.push(role.role);
  }
  if (typeof resume?.summary === "string") roles.push(resume.summary);
  return roles.length ? roles.join("\n") : rawText;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseDurationMonths(duration: string): number {
  if (!duration) return 0;
  const text = duration.toLowerCase();

  const explicit = text.match(/(\d+(?:\.\d+)?)\s*(?:\+)?\s*(year|yr|month|mo)/);
  const range = text.match(
    /([a-z]{3,9})?\.?\s*(\d{4})\s*(?:-|–|—|to|through)\s*(present|current|now|[a-z]{3,9})?\.?\s*(\d{4})?/
  );

  if (range) {
    const [, startMonthRaw, startYearRaw, endTokenRaw, endYearRaw] = range;
    const startYear = parseInt(startYearRaw, 10);
    if (!Number.isNaN(startYear)) {
      const startMonth = MONTHS[(startMonthRaw || "").slice(0, 3)] ?? 0;
      const isPresent = /present|current|now/.test(endTokenRaw || "");
      const now = new Date();
      const endYear = isPresent || !endYearRaw ? now.getFullYear() : parseInt(endYearRaw, 10);
      const endMonth = isPresent
        ? now.getMonth()
        : MONTHS[(endTokenRaw || "").slice(0, 3)] ?? 11;
      if (!Number.isNaN(endYear)) {
        const months = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
        if (months > 0 && months < 600) return months;
      }
    }
  }

  if (explicit) {
    const amount = parseFloat(explicit[1]);
    return explicit[2].startsWith("y") ? Math.round(amount * 12) : Math.round(amount);
  }
  return 0;
}

/**
 * Years of professional experience the candidate actually has. Derived from the
 * source facts, so it is identical for the baseline and optimized scores -
 * rewriting a resume cannot manufacture tenure.
 */
function candidateYears(resume: any, rawText: string): number | null {
  let months = 0;
  for (const role of resume?.experience || []) {
    months += parseDurationMonths(String(role?.duration || ""));
  }
  if (months > 0) return Math.round((months / 12) * 10) / 10;

  const years = (rawText.match(/\b(19|20)\d{2}\b/g) || [])
    .map((y) => parseInt(y, 10))
    .filter((y) => y >= 1960 && y <= new Date().getFullYear() + 1);
  if (years.length < 2) return null;
  const span = Math.max(...years) - Math.min(...years);
  return span > 0 && span <= 50 ? span : null;
}

function requiredYears(jobDescription: string): number | null {
  // Matched against normalized text: raw postings carry runs of newlines and
  // non-breaking spaces, and a chain of unbounded \s* groups backtracks
  // catastrophically over them while this runs inside the request handler.
  const collapsed = normalize(jobDescription);
  const matches = Array.from(
    collapsed.matchAll(/(\d{1,2})\s?(?:\+|plus)?\s?(?:-|to)?\s?(?:\d{1,2})?\s?\+?\s?years?\b/g)
  );
  const values = matches
    .map((m) => parseInt(m[1], 10))
    .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 20);
  if (!values.length) return null;
  return Math.min(...values);
}

interface CoverageOutcome {
  score: number;
  matched: string[];
  partial: string[];
  missing: string[];
  required: TierCoverage;
  preferred: TierCoverage;
}

function emptyTier(): TierCoverage {
  return { total: 0, matched: [], partial: [], missing: [] };
}

function coverage(terms: JdTerms, rawCorpus: string): CoverageOutcome {
  const corpus = makeCorpus(rawCorpus);
  let earned = 0;
  let total = 0;
  const matched: string[] = [];
  const partial: string[] = [];
  const missing: string[] = [];
  const tiers: Record<RequirementTier, TierCoverage> = { required: emptyTier(), preferred: emptyTier() };

  for (const [term, { weight, tier }] of terms) {
    total += weight;
    const credit = termCredit(term, corpus);
    earned += weight * credit;
    const bucket = tiers[tier];
    bucket.total += 1;
    if (credit === 1) {
      matched.push(term);
      bucket.matched.push(term);
    } else if (credit > 0) {
      partial.push(term);
      bucket.partial.push(term);
    } else {
      missing.push(term);
      bucket.missing.push(term);
    }
  }

  return {
    score: total > 0 ? earned / total : 0,
    matched,
    partial,
    missing,
    required: tiers.required,
    preferred: tiers.preferred,
  };
}

export interface KeywordCoverageTarget {
  target: number;
  actual: number;
  evidence_ceiling: number;
  status: "met" | "supported_terms_remaining" | "evidence_limited";
  supported_missing: string[];
  unsupported: string[];
}

/** Same weighted JD dictionary/credits as coverage scoring; unrelated role/tenure components are excluded. */
export function computeKeywordCoverageTarget(
  resume: unknown, jobDescription: string, candidateMaterial: string, targetRole = "", target = 80
): KeywordCoverageTarget | null {
  if (jobDescription.trim().length < 40) return null;
  const terms = extractJdTerms(jobDescription, targetRole, []);
  if (terms.size < 3) return null;
  const source = makeCorpus(candidateMaterial);
  const output = makeCorpus(optimizedFullText(resume));
  const supportedMissing: string[] = [];
  const unsupported: string[] = [];
  let total = 0, earned = 0, available = 0;
  for (const [term, { weight }] of terms) {
    total += weight;
    const evidenceCredit = findExcludedTerms(term).length ? 0 : termCredit(term, source);
    const outputCredit = termCredit(term, output);
    // Unsupported wording must not earn this evidence-limited target.
    earned += weight * Math.min(evidenceCredit, outputCredit);
    available += weight * evidenceCredit;
    if (evidenceCredit > outputCredit) supportedMissing.push(term);
    if (evidenceCredit < 1) unsupported.push(term);
  }
  if (!total) return null;
  const actualRaw = earned / total * 100;
  const ceilingRaw = available / total * 100;
  return {
    target, actual: Math.floor(actualRaw * 10) / 10, evidence_ceiling: Math.floor(ceilingRaw * 10) / 10,
    status: actualRaw >= target ? "met" : ceilingRaw < target ? "evidence_limited" : "supported_terms_remaining",
    supported_missing: supportedMissing, unsupported,
  };
}

/** The posting's title: its first line that is neither a heading ("About the job") nor a "Label: value" pair. */
function jdTitleLine(jobDescription: string): string {
  const lines = splitLines(jobDescription);
  for (const line of lines.slice(0, 8)) {
    if (headingKind(line)) continue;
    if (/^[^:]{2,30}:\s/.test(line)) continue;
    return line;
  }
  return lines[0] || "";
}

function roleAlignment(targetRole: string, jobDescription: string, roleText: string): number {
  const tokens = new Set(
    [...tokenize(targetRole || ""), ...tokenize(jdTitleLine(jobDescription)).slice(0, 8)].filter(
      (t) => !STOPWORDS.has(t) && !NOISE_TERMS.has(t) && t.length > 2
    )
  );
  if (tokens.size === 0) return 0;
  const paddedRoleText = padded(roleText);
  let hits = 0;
  for (const token of tokens) {
    if (variantsOf(token).some((v) => paddedRoleText.includes(` ${v} `))) hits += 1;
  }
  return hits / tokens.size;
}

/**
 * Readiness bands. Not a pass mark: no ATS applies one universal cutoff. Labelled
 * as coverage because they read wording, not proof - requirementEvidence.ts says
 * what the candidate's material actually proves.
 */
const READINESS_BANDS: { level: ReadinessLevel; label: string; minScore: number; minRequired: number; guidance: string }[] = [
  {
    level: "strong",
    label: "Strong coverage",
    minScore: 70,
    minRequired: 70,
    guidance: "Uses the language of most of what this posting requires. Wording is not proof - check what your experience evidences.",
  },
  {
    level: "good",
    label: "Good coverage",
    minScore: 55,
    minRequired: 55,
    guidance: "Covers the core of this posting. Close the remaining required gaps only with experience you really have.",
  },
  {
    level: "partial",
    label: "Partial coverage",
    minScore: 40,
    minRequired: 0,
    guidance:
      "Several required skills are not evidenced. If you have them, add them to your master resume or brain dump and re-run.",
  },
  {
    level: "low",
    label: "Low coverage",
    minScore: 0,
    minRequired: 0,
    guidance: "Most required skills are not evidenced - this posting may not be a close fit for this resume.",
  },
];

function readinessFor(score: number, required: TierCoverage): MatchReadiness {
  const requiredCoverage =
    required.total > 0
      ? Math.round(((required.matched.length + 0.5 * required.partial.length) / required.total) * 100)
      : null;
  const requiredBar = requiredCoverage ?? score;
  const band =
    READINESS_BANDS.find((b) => score >= b.minScore && requiredBar >= b.minRequired) ||
    READINESS_BANDS[READINESS_BANDS.length - 1];
  return { level: band.level, label: band.label, required_coverage: requiredCoverage, guidance: band.guidance };
}

function buildBreakdown(components: ScoreComponent[], cov: CoverageOutcome): MatchScoreBreakdown {
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const raw = totalWeight > 0
    ? components.reduce((sum, c) => sum + c.weight * c.score, 0) / totalWeight
    : 0;
  const score = Math.max(5, Math.min(99, Math.round(raw * 100)));
  return {
    score,
    components,
    matched: cov.matched,
    partial: cov.partial,
    missing: cov.missing,
    required: cov.required,
    preferred: cov.preferred,
    readiness: readinessFor(score, cov.required),
  };
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function coverageDetail(cov: CoverageOutcome): string {
  const required = `${cov.required.matched.length} of ${cov.required.total} required skills matched`;
  const partial = cov.required.partial.length > 0 ? ` (+${cov.required.partial.length} partial)` : "";
  const preferred =
    cov.preferred.total > 0
      ? `; ${cov.preferred.matched.length} of ${cov.preferred.total} nice-to-haves (each counts half)`
      : "";
  return `${required}${partial}${preferred}`;
}

/**
 * Builds the four scored components for one document. Shared by the
 * baseline/optimized comparison and by cross-resume ranking so a ranking score
 * and a match score are produced by identical weighting and are comparable.
 */
function scoreDocument(params: {
  terms: JdTerms;
  fullText: string;
  evidenceText: string;
  roleText: string;
  targetRole: string;
  jobDescription: string;
  seniorityScore: number | null;
  seniorityDetail: string;
}): { breakdown: MatchScoreBreakdown; cov: CoverageOutcome } {
  const { terms, fullText, evidenceText, roleText, targetRole, jobDescription } = params;

  const cov = coverage(terms, fullText);
  const evidenceCov = coverage(terms, evidenceText);
  const role = roleAlignment(targetRole, jobDescription, roleText);

  const components: ScoreComponent[] = [
    {
      id: "keyword_coverage",
      label: "JD requirement coverage",
      weight: 0.5,
      score: cov.score,
      detail: coverageDetail(cov),
    },
    {
      id: "evidence_depth",
      label: "Proof in experience",
      weight: 0.2,
      score: evidenceCov.score,
      detail: `${evidenceCov.matched.length} requirements evidenced in roles/projects rather than a skills list`,
    },
    {
      id: "role_alignment",
      label: "Role vocabulary alignment",
      weight: 0.15,
      score: role,
      detail: `${pct(role)} of target-title terms present`,
    },
  ];

  if (params.seniorityScore != null) {
    components.push({
      id: "seniority",
      label: "Experience depth",
      weight: 0.15,
      score: params.seniorityScore,
      detail: params.seniorityDetail,
    });
  }

  return { breakdown: buildBreakdown(components, cov), cov };
}

function seniorityFor(
  needYears: number | null,
  haveYears: number | null
): { score: number | null; detail: string } {
  if (needYears && haveYears != null) {
    return {
      score: Math.max(0, Math.min(1, haveYears / needYears)),
      detail: `${haveYears} yrs evidenced vs ${needYears} yrs required`,
    };
  }
  return { score: null, detail: "no explicit experience requirement in JD" };
}

/**
 * Scores the source resume and the generated resume against the same extracted
 * JD requirements. Returns null when the JD carries too little signal to score
 * honestly, so callers can omit the field rather than show an invented number.
 */
export function computeMatchScores(input: MatchScoreInput): MatchScoreResult | null {
  const { jobDescription, originalResumeText, optimizedResume, targetRole = "", jdKeywords = [] } = input;

  if (!jobDescription || jobDescription.trim().length < 40) return null;

  const providedKeywords = [
    ...(Array.isArray(jdKeywords) ? jdKeywords : []),
    ...(Array.isArray(optimizedResume?.ats_keywords_from_jd) ? optimizedResume.ats_keywords_from_jd : []),
  ].filter((k): k is string => typeof k === "string");

  const terms = extractJdTerms(jobDescription, targetRole, providedKeywords);
  if (terms.size < 3) return null;

  const baselineFull = originalResumeText || "";

  const needYears = requiredYears(jobDescription);
  // Derived from the source facts, so both sides get the same value: a rewrite
  // cannot manufacture tenure.
  const haveYears = candidateYears(optimizedResume, baselineFull);
  const seniority = seniorityFor(needYears, haveYears);

  const baselineScored = scoreDocument({
    terms,
    fullText: baselineFull,
    evidenceText: stripSkillSections(baselineFull),
    roleText: baselineFull,
    targetRole,
    jobDescription,
    seniorityScore: seniority.score,
    seniorityDetail: seniority.detail,
  });

  const optimizedScored = scoreDocument({
    terms,
    fullText: optimizedFullText(optimizedResume),
    evidenceText: optimizedEvidenceText(optimizedResume),
    roleText: roleVocabularyText(optimizedResume, baselineFull),
    targetRole,
    jobDescription,
    seniorityScore: seniority.score,
    seniorityDetail: seniority.detail,
  });

  const baseline = baselineScored.breakdown;
  const optimized = optimizedScored.breakdown;
  const baselineHit = new Set([...baselineScored.cov.matched, ...baselineScored.cov.partial]);
  const addedKeywords = optimizedScored.cov.matched.filter((t) => !baselineHit.has(t));

  return {
    match_score: optimized.score,
    baseline_score: baseline.score,
    ats_keywords_from_jd: Array.from(terms.keys()),
    ats_keywords_added_to_resume: addedKeywords,
    // Required gaps first: they are the ones worth closing.
    keyword_gap: [...optimizedScored.cov.required.missing, ...optimizedScored.cov.preferred.missing],
    score_breakdown: {
      method: "deterministic-jd-coverage-v2",
      jd_keywords_evaluated: terms.size,
      required_years: needYears,
      candidate_years: haveYears,
      baseline,
      optimized,
    },
  };
}

/**
 * Replaces whatever the model guessed with computed values. Mutates and returns
 * the resume object. If the JD is too thin to score - or scoring itself fails -
 * the score fields are removed entirely so the UI hides them instead of
 * rendering a fabricated number.
 *
 * This never throws. Callers invoke it on an already-generated, already-paid-for
 * document; a scoring defect must degrade to "no score", never discard the
 * resume or be mistaken for a malformed model response and retried.
 */
export function applyMatchScores(
  optimizedResume: any,
  params: { jobDescription: string; originalResumeText: string; targetRole?: string; jdKeywords?: string[] }
): any {
  if (!optimizedResume || typeof optimizedResume !== "object") return optimizedResume;

  let scores: MatchScoreResult | null = null;
  try {
    scores = computeMatchScores({
      jobDescription: params.jobDescription,
      originalResumeText: params.originalResumeText,
      optimizedResume,
      targetRole: params.targetRole,
      jdKeywords: params.jdKeywords,
    });
  } catch (e: any) {
    console.warn("[matchScore] Scoring failed; returning document unscored:", e?.message || e);
    scores = null;
  }

  if (!scores) {
    delete optimizedResume.match_score;
    delete optimizedResume.baseline_score;
    delete optimizedResume.score_breakdown;
    return optimizedResume;
  }

  optimizedResume.match_score = scores.match_score;
  optimizedResume.baseline_score = scores.baseline_score;
  optimizedResume.score_breakdown = scores.score_breakdown;
  optimizedResume.ats_keywords_from_jd = scores.ats_keywords_from_jd;
  optimizedResume.ats_keywords_added_to_resume = scores.ats_keywords_added_to_resume;
  optimizedResume.keyword_gap = scores.keyword_gap;
  return optimizedResume;
}

export interface ResumeRankingEntry {
  id: string;
  name: string;
  score: number;
  matched: string[];
  missing: string[];
  components: ScoreComponent[];
}

export interface ResumeRankingResult {
  ranked: ResumeRankingEntry[];
  winner: ResumeRankingEntry;
  runnerUp: ResumeRankingEntry | null;
  margin: number;
  closeCall: boolean;
  jd_keywords_evaluated: number;
}

/** A ranking gap this small is inside the noise floor of keyword matching. */
const CLOSE_CALL_MARGIN = 5;

function toResumeObject(content: unknown): any {
  let parsed: any = content;
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        parsed = null;
      }
    } else {
      parsed = null;
    }
    if (!parsed || typeof parsed !== "object") {
      // Not structured - score it as plain text.
      return { __raw: content };
    }
  }
  if (!parsed || typeof parsed !== "object") return { __raw: "" };

  const summary =
    typeof parsed.summary === "string" ? parsed.summary : parsed?.personal_info?.summary || "";
  return { ...parsed, summary };
}

function rankingTexts(resume: any): { full: string; evidence: string; role: string } {
  if (typeof resume.__raw === "string") {
    return {
      full: resume.__raw,
      evidence: stripSkillSections(resume.__raw),
      role: resume.__raw,
    };
  }
  const full = optimizedFullText(resume);
  return {
    full,
    evidence: optimizedEvidenceText(resume),
    role: roleVocabularyText(resume, full),
  };
}

/**
 * Ranks the user's master resumes against one JD using the same deterministic
 * engine that produces the match score, so the resume that wins here is the one
 * that genuinely starts closest to the posting.
 *
 * Every resume is scored in full - no truncation, no model call - which makes
 * the result reproducible and free. Returns null when the JD is too thin to
 * score, so callers keep the user's current selection rather than guessing.
 */
export function rankResumesByJd(input: {
  jobDescription: string;
  resumes: { id: string; name: string; content: unknown }[];
  targetRole?: string;
  jdKeywords?: string[];
}): ResumeRankingResult | null {
  const { jobDescription, resumes, targetRole = "", jdKeywords = [] } = input;

  try {
    if (!jobDescription || jobDescription.trim().length < 40) return null;
    if (!Array.isArray(resumes) || resumes.length === 0) return null;

    const terms = extractJdTerms(
      jobDescription,
      targetRole,
      (Array.isArray(jdKeywords) ? jdKeywords : []).filter((k): k is string => typeof k === "string")
    );
    if (terms.size < 3) return null;

    const needYears = requiredYears(jobDescription);

    const ranked: ResumeRankingEntry[] = resumes.map((entry) => {
      const resume = toResumeObject(entry.content);
      const texts = rankingTexts(resume);
      const seniority = seniorityFor(needYears, candidateYears(resume, texts.full));

      const { breakdown } = scoreDocument({
        terms,
        fullText: texts.full,
        evidenceText: texts.evidence,
        roleText: texts.role,
        targetRole,
        jobDescription,
        seniorityScore: seniority.score,
        seniorityDetail: seniority.detail,
      });

      return {
        id: entry.id,
        name: entry.name,
        score: breakdown.score,
        matched: breakdown.matched,
        missing: breakdown.missing,
        components: breakdown.components,
      };
    });

    // Stable: equal scores keep the caller's original order rather than
    // shuffling the winner between identical runs.
    ranked.sort((a, b) => b.score - a.score);

    const winner = ranked[0];
    const runnerUp = ranked.length > 1 ? ranked[1] : null;
    const margin = runnerUp ? winner.score - runnerUp.score : winner.score;

    return {
      ranked,
      winner,
      runnerUp,
      margin,
      closeCall: runnerUp != null && margin < CLOSE_CALL_MARGIN,
      jd_keywords_evaluated: terms.size,
    };
  } catch (e: any) {
    console.warn("[matchScore] Ranking failed; keeping current resume selection:", e?.message || e);
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Evidence helpers, shared with the draft review (draftReview.ts)
 * ------------------------------------------------------------------ */

/** The posting's requirement terms: the same list the match score is computed against. */
export function jdRequirementTerms(
  jobDescription: string,
  targetRole = "",
  jdKeywords: string[] = []
): { term: string; tier: RequirementTier }[] {
  try {
    if (typeof jobDescription !== "string" || jobDescription.trim().length < 40) return [];
    const keywords = (Array.isArray(jdKeywords) ? jdKeywords : []).filter((k): k is string => typeof k === "string");
    return Array.from(extractJdTerms(jobDescription, targetRole || "", keywords)).map(([term, info]) => ({
      term,
      tier: info.tier,
    }));
  } catch (e: any) {
    console.warn("[matchScore] Could not extract requirement terms:", e?.message || e);
    return [];
  }
}

/** A text prepared once for repeated evidence checks. */
export function prepareEvidenceText(text: string): Corpus {
  return makeCorpus(typeof text === "string" ? text : "");
}

/** 1 when the text names the term (alias- and word-form-aware), 0.5 when its words all appear apart, 0 otherwise. */
export function termEvidence(term: string, text: Corpus): number {
  const norm = trimTermEdges(normalize(term));
  return norm ? termCredit(norm, text) : 0;
}

/**
 * True when the text shows no trace of the term: not the term, an alias, a word
 * form, nor any of its significant words. Deliberately conservative, so it only
 * fires on "this names something the candidate's material never mentions".
 */
export function termAbsent(term: string, text: Corpus): boolean {
  const norm = trimTermEdges(normalize(term));
  if (!norm || termCredit(norm, text) > 0) return false;
  const words = norm
    .split(" ")
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w) && !NOISE_TERMS.has(w) && !TOKEN_BLOCKLIST.has(w));
  if (words.length === 0) return false;
  return words.every((w) => termCredit(w, text) === 0);
}

export interface FocusedPosting {
  text: string;
  /** Characters in the posting as given. */
  original_chars: number;
  /** Company, benefits and EEO sections were left out to make room. */
  boilerplate_removed: boolean;
  /** It still did not fit and the tail was cut, at a line boundary. */
  truncated: boolean;
  /** Characters of the posting this text does not carry. */
  omitted_chars: number;
}

/**
 * The posting fitted to `maxChars` without silently losing requirements:
 * unchanged when it fits; otherwise company, benefits and EEO sections go first,
 * and only then is the tail cut - at a line boundary, with a visible marker, and
 * reported through the returned flags.
 */
export function focusJobDescription(jobDescription: string, maxChars: number): FocusedPosting {
  const text = typeof jobDescription === "string" ? jobDescription : "";
  const original = text.length;
  const limit = Math.max(500, Math.floor(Number(maxChars) || 0));
  const unchanged = { text, original_chars: original, boilerplate_removed: false, truncated: false, omitted_chars: 0 };
  if (original <= limit) return unchanged;

  // Every line outside company/HR sections, headings included, in order.
  const kept: string[] = [];
  let state: SectionKind = "required";
  let removed = false;
  let contentLines = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const kind = line ? headingKind(line) : null;
    if (kind) state = kind;
    if (state === "ignored") {
      if (line) removed = true;
      continue;
    }
    kept.push(rawLine);
    if (line && !kind) contentLines += 1;
  }
  let focused = removed ? kept.join("\n").replace(/\n{3,}/g, "\n\n").trim() : text;
  // As in classifySections: a boilerplate heading must never swallow the whole posting.
  if (removed && contentLines === 0) {
    focused = text;
    removed = false;
  }
  if (focused.length <= limit) {
    return { text: focused, original_chars: original, boilerplate_removed: removed, truncated: false, omitted_chars: 0 };
  }

  const cut = focused.lastIndexOf("\n", limit);
  const head = (cut > limit * 0.6 ? focused.slice(0, cut) : focused.slice(0, limit)).trimEnd();
  const omitted = focused.length - head.length;
  return {
    text: `${head}\n[... posting truncated: ${omitted} more characters not shown]`,
    original_chars: original,
    boilerplate_removed: removed,
    truncated: true,
    omitted_chars: omitted,
  };
}
