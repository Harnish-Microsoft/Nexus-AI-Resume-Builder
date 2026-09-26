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

export interface ScoreComponent {
  id: string;
  label: string;
  /** Relative weight within the final score. Weights are renormalised when a component is unavailable. */
  weight: number;
  /** 0..1 */
  score: number;
  detail: string;
}

export interface MatchScoreBreakdown {
  score: number;
  components: ScoreComponent[];
  matched: string[];
  partial: string[];
  missing: string[];
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
];

const ALIAS_LOOKUP: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const group of ALIAS_GROUPS) {
    for (const member of group) {
      const existing = map.get(member) || [];
      map.set(member, Array.from(new Set([...existing, ...group])));
    }
  }
  return map;
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
  "aws", "azure", "gcp", "google cloud", "kubernetes", "docker", "terraform", "ansible", "puppet",
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
];

const DICTIONARY_SET = new Set(SKILL_DICTIONARY);

/** Tokens that pass the "looks technical" pattern test but carry no meaning. */
const TOKEN_BLOCKLIST = new Set([
  "i", "a", "us", "uk", "eu", "ok", "ceo", "cto", "cfo", "coo", "vp", "jr", "sr", "phd", "bs",
  "ba", "ma", "ms", "mba", "am", "pm", "eod", "eta", "faq", "tbd", "n/a", "e.g", "i.e", "etc",
  "inc", "llc", "ltd", "corp", "co", "and/or", "24/7", "401k", "pto", "eeo", "id",
]);

function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, " ")
    .replace(/[^a-z0-9+#./\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  return (text || "")
    .split(/\r?\n|(?<=[.;])\s{2,}/)
    .map((l) => l.trim())
    .filter(Boolean);
}

interface TermCandidate {
  term: string;
  sources: Set<string>;
}

function addCandidate(map: Map<string, TermCandidate>, rawTerm: string, source: string): void {
  const term = trimTermEdges(normalize(rawTerm));
  if (!isMeaningful(term)) return;
  const existing = map.get(term);
  if (existing) {
    existing.sources.add(source);
  } else {
    map.set(term, { term, sources: new Set([source]) });
  }
}

/**
 * Detects tokens that look like a technology or proper noun in the ORIGINAL
 * casing: internal capitals, digit/letter mixes, all-caps acronyms, or symbols
 * that only appear in tool names (c++, c#, node.js, ci/cd).
 */
function looksTechnical(rawToken: string): boolean {
  const token = rawToken.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9+#.]+$/g, "");
  if (token.length < 2 || token.length > 24) return false;
  if (TOKEN_BLOCKLIST.has(token.toLowerCase())) return false;
  if (STOPWORDS.has(token.toLowerCase())) return false;
  if (/^[A-Z]{2,6}$/.test(token)) return true;
  if (/[a-z][A-Z]/.test(token)) return true;
  if (/^[A-Za-z]+[0-9]+$/.test(token) && token.length > 3) return true;
  if (/[+#]/.test(token)) return true;
  if (/^[A-Za-z]+\.[A-Za-z]{2,4}$/.test(token)) return true;
  return false;
}

const PHRASE_PATTERNS = [
  /(?:experience\s+(?:with|in|using|of)|proficien\w*\s+(?:in|with)|knowledge\s+of|expertise\s+in|familiarity\s+with|skilled\s+in|background\s+in|hands[-\s]?on\s+(?:with|experience\s+with)|working\s+with|strong\s+(?:in|with)|understanding\s+of)\s+([^.;:\n]{3,80})/gi,
];

function extractPhraseTerms(jd: string): string[] {
  const out: string[] = [];
  for (const pattern of PHRASE_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(jd)) !== null) {
      const fragment = match[1];
      for (const part of fragment.split(/,|\band\b|\bor\b|\/|&|\||\bas well as\b/i)) {
        const cleaned = trimTermEdges(normalize(part));
        if (cleaned && cleaned.split(" ").length <= 4) out.push(cleaned);
      }
    }
  }
  return out;
}

/**
 * Builds the requirement list the resume is scored against, from the JD itself.
 * Model-supplied keywords are accepted only when they actually occur in the JD,
 * so a hallucinated keyword can never inflate or deflate the score.
 */
function extractJdTerms(
  jobDescription: string,
  targetRole: string,
  providedKeywords: string[]
): Map<string, number> {
  const candidates = new Map<string, TermCandidate>();
  const normJd = normalize(jobDescription);
  const paddedJd = ` ${normJd} `;

  for (const skill of SKILL_DICTIONARY) {
    if (paddedJd.includes(` ${skill} `)) addCandidate(candidates, skill, "dictionary");
  }

  const rawTokens = jobDescription.match(/[A-Za-z][A-Za-z0-9+#./-]*/g) || [];
  for (const token of rawTokens) {
    if (looksTechnical(token)) addCandidate(candidates, token, "pattern");
  }

  for (const phrase of extractPhraseTerms(jobDescription)) {
    addCandidate(candidates, phrase, "phrase");
  }

  for (const keyword of providedKeywords || []) {
    const norm = trimTermEdges(normalize(keyword));
    if (!norm) continue;
    const words = norm.split(" ");
    const verified =
      paddedJd.includes(` ${norm} `) ||
      (words.length > 1 && words.every((w) => paddedJd.includes(` ${w} `)));
    if (verified) addCandidate(candidates, norm, "extracted");
  }

  const lines = splitLines(jobDescription);
  const requirementText = padded(
    lines.filter((l) => REQUIREMENT_HINT.test(l) || /^[-*\u2022\u25cf\d]/.test(l)).join(" ")
  );
  const headText = padded(jobDescription.slice(0, Math.max(200, Math.floor(jobDescription.length * 0.15))));
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

  const weights = new Map<string, number>();
  for (const { term, sources } of candidates.values()) {
    let weight = 1;
    if (requirementText.includes(` ${term} `)) weight += 1;
    const occurrences = countOccurrences(paddedJd, term);
    if (occurrences >= 3) weight += 0.5;
    if (headText.includes(` ${term} `)) weight += 0.5;
    if (term.split(" ").some((w) => roleTokens.has(w))) weight += 0.5;
    if (sources.has("dictionary") || sources.has("extracted")) weight += 0.5;
    weights.set(term, Math.min(3, weight));
  }

  // Keep the strongest signals; a 200-term list dilutes every individual miss.
  const ranked = Array.from(weights.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  return new Map(ranked.slice(0, 45));
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

function variantsOf(term: string): string[] {
  const variants = new Set<string>([term]);
  for (const alias of ALIAS_LOOKUP.get(term) || []) variants.add(alias);
  for (const base of Array.from(variants)) {
    if (base.endsWith("s")) variants.add(base.slice(0, -1));
    else variants.add(`${base}s`);
    if (base.endsWith("y")) variants.add(`${base.slice(0, -1)}ies`);
    if (base.includes("-")) variants.add(base.replace(/-/g, " "));
    if (base.includes(" ")) variants.add(base.replace(/ /g, ""));
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

/** 1 = present verbatim (or via alias/word form), 0.5 = all words present but not adjacent, 0 = absent. */
function termCredit(term: string, paddedCorpus: string): number {
  for (const variant of variantsOf(term)) {
    if (paddedCorpus.includes(` ${variant} `)) return 1;
  }
  const words = term.split(" ").filter((w) => !STOPWORDS.has(w));
  if (words.length === 1) return wordPresent(words[0], paddedCorpus) ? 1 : 0;
  if (words.length > 1 && words.every((w) => wordPresent(w, paddedCorpus))) return 0.5;
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
}

function coverage(terms: Map<string, number>, corpus: string): CoverageOutcome {
  const paddedCorpus = padded(corpus);
  let earned = 0;
  let total = 0;
  const matched: string[] = [];
  const partial: string[] = [];
  const missing: string[] = [];

  for (const [term, weight] of terms) {
    total += weight;
    const credit = termCredit(term, paddedCorpus);
    earned += weight * credit;
    if (credit === 1) matched.push(term);
    else if (credit > 0) partial.push(term);
    else missing.push(term);
  }

  return {
    score: total > 0 ? earned / total : 0,
    matched,
    partial,
    missing,
  };
}

function roleAlignment(targetRole: string, jobDescription: string, roleText: string): number {
  const jdTitleLine = splitLines(jobDescription)[0] || "";
  const tokens = new Set(
    [...tokenize(targetRole || ""), ...tokenize(jdTitleLine).slice(0, 8)].filter(
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

function buildBreakdown(components: ScoreComponent[], cov: CoverageOutcome): MatchScoreBreakdown {
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const raw = totalWeight > 0
    ? components.reduce((sum, c) => sum + c.weight * c.score, 0) / totalWeight
    : 0;
  return {
    score: Math.max(5, Math.min(99, Math.round(raw * 100))),
    components,
    matched: cov.matched,
    partial: cov.partial,
    missing: cov.missing,
  };
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
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
  const baselineEvidence = stripSkillSections(baselineFull);
  const optimizedFull = optimizedFullText(optimizedResume);
  const optimizedEvidence = optimizedEvidenceText(optimizedResume);

  const baselineCoverage = coverage(terms, baselineFull);
  const optimizedCoverage = coverage(terms, optimizedFull);
  const baselineEvidenceCoverage = coverage(terms, baselineEvidence);
  const optimizedEvidenceCoverage = coverage(terms, optimizedEvidence);

  const baselineRole = roleAlignment(targetRole, jobDescription, baselineFull);
  const optimizedRole = roleAlignment(
    targetRole,
    jobDescription,
    roleVocabularyText(optimizedResume, baselineFull)
  );

  const needYears = requiredYears(jobDescription);
  const haveYears = candidateYears(optimizedResume, baselineFull);
  const seniorityScore =
    needYears && haveYears != null ? Math.max(0, Math.min(1, haveYears / needYears)) : null;
  const seniorityDetail =
    needYears && haveYears != null
      ? `${haveYears} yrs evidenced vs ${needYears} yrs required`
      : "no explicit experience requirement in JD";

  const makeComponents = (
    cov: CoverageOutcome,
    evidenceCov: CoverageOutcome,
    role: number
  ): ScoreComponent[] => {
    const components: ScoreComponent[] = [
      {
        id: "keyword_coverage",
        label: "JD requirement coverage",
        weight: 0.5,
        score: cov.score,
        detail: `${cov.matched.length} of ${terms.size} weighted requirements matched (${cov.partial.length} partial)`,
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
    if (seniorityScore != null) {
      components.push({
        id: "seniority",
        label: "Experience depth",
        weight: 0.15,
        score: seniorityScore,
        detail: seniorityDetail,
      });
    }
    return components;
  };

  const baseline = buildBreakdown(
    makeComponents(baselineCoverage, baselineEvidenceCoverage, baselineRole),
    baselineCoverage
  );
  const optimized = buildBreakdown(
    makeComponents(optimizedCoverage, optimizedEvidenceCoverage, optimizedRole),
    optimizedCoverage
  );

  const baselineHit = new Set([...baselineCoverage.matched, ...baselineCoverage.partial]);
  const addedKeywords = optimizedCoverage.matched.filter((t) => !baselineHit.has(t));

  return {
    match_score: optimized.score,
    baseline_score: baseline.score,
    ats_keywords_from_jd: Array.from(terms.keys()),
    ats_keywords_added_to_resume: addedKeywords,
    keyword_gap: optimizedCoverage.missing,
    score_breakdown: {
      method: "deterministic-jd-coverage-v1",
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
