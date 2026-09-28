/**
 * Target-audience profiles and the blended audience brief.
 *
 * Selecting several audiences used to run one full optimization per audience,
 * and the user only ever saw one of the results. The selected audiences are now
 * blended into a single brief instead: the primary reader frames the summary and
 * the order of emphasis, secondary readers decide which additional evidence earns
 * a place, and the job description settles every conflict. One generation run,
 * whatever the mix.
 *
 * Dependency-free: bundled by esbuild (server) and vite (browser). No regex
 * lookbehind (Safari 14 build target). Profile text never uses the pipeline's
 * forbidden terms, because the model echoes whatever the brief says.
 */

export const MAX_BLENDED_AUDIENCES = 3;
export const CUSTOM_AUDIENCE_ID = "custom";
/** Key under which the single blended result is stored and displayed. */
export const BLENDED_RESULT_KEY = "blended";

/** A reader below this share adds prompt noise rather than direction, and is dropped. */
const MIN_READER_SHARE = 10;
/** Weights for a hand-picked blend, by position: the first pick is the primary reader. */
const DEFAULT_WEIGHTS: readonly (readonly number[])[] = [[100], [65, 35], [50, 30, 20]];
const MAX_LABEL_LENGTH = 80;
const MAX_REASON_LENGTH = 160;

export interface AudienceSignal {
  label: string;
  pattern: RegExp;
}

export interface AudienceProfile {
  id: string;
  label: string;
  /** Who reads the resume. */
  reader: string;
  /** What this reader scans for, most important first. */
  priorities: string[];
  /** What the summary and each role should open with for this reader. */
  leadWith: string;
  /** What this reader discounts or distrusts. */
  discounts: string;
  /** Evidence this reader looks for, checked deterministically in the final resume. */
  signals: AudienceSignal[];
}

export type AudienceMixSource = "ai" | "keywords" | "manual";

export interface AudienceMixEntry {
  id: string;
  label: string;
  /** Integer percent; the weights of a mix sum to 100. */
  weight: number;
  /** Why the job description points at this reader. */
  reason?: string;
}

export interface AudienceMix {
  /** Highest weight first: entries[0] is the primary reader. */
  entries: AudienceMixEntry[];
  source: AudienceMixSource;
}

export interface AudienceCoverageEntry {
  id: string;
  label: string;
  weight: number;
  primary: boolean;
  reason?: string;
  /** False for custom readers, which have no signal set to check. */
  scored: boolean;
  signal_count: number;
  /** Share of this reader's signals evidenced in the final resume. */
  coverage: number | null;
  /** The same share in the source resume, before optimization. */
  baseline: number | null;
  matched: string[];
  missing: string[];
  /** Evidenced now, but not in the source resume. */
  gained: string[];
  /** Evidenced in the source resume, but not in the final one. */
  lost: string[];
}

export interface AudienceCoverageReport {
  method: string;
  headline: string;
  source: AudienceMixSource;
  /** Coverage averaged by weight across the scored readers. */
  weighted: number | null;
  baseline_weighted: number | null;
  entries: AudienceCoverageEntry[];
}

/* ------------------------------------------------------------------ *
 * Profiles
 * ------------------------------------------------------------------ */

function signal(label: string, terms: string): AudienceSignal {
  return { label, pattern: new RegExp(`\\b(?:${terms})`, "i") };
}

const TEAM_LEADERSHIP = signal(
  "Team leadership",
  "led (?:a |the )?team|managed (?:a |the )?team|team of \\d|direct reports|people manager|managing \\d|supervis|headcount"
);
const PEOPLE_DEVELOPMENT = signal(
  "Hiring and developing people",
  "mentor|coach|hired|hiring|recruited|onboarded|upskill|career development|performance review"
);
const STAKEHOLDERS = signal(
  "Stakeholder management",
  "stakeholder|executive|leadership team|business partner|sponsor|steering"
);
const ROADMAP = signal("Roadmap and prioritization", "roadmap|prioriti|planning|okr|strateg");
const COST = signal("Cost and budget ownership", "cost|budget|spend|savings|finops|p&l|forecast");
const MICROSOFT_STACK = "Azure and Microsoft stack";

const PROFILES: AudienceProfile[] = [
  {
    id: "general",
    label: "General Professional",
    reader: "A recruiter or hiring manager screening broadly for the role",
    priorities: [
      "a clear scope of responsibility in every role",
      "concrete outcomes the work produced",
      "skills relevant to the posting, stated plainly",
      "steady career progression",
    ],
    leadWith: "the outcome most relevant to the posting",
    discounts: "unexplained jargon, acronym lists and duties without results",
    signals: [
      signal("Concrete outcomes", "reduced|improved|increased|cut|saved|accelerated|eliminated|grew"),
      signal("Ownership", "owned|led|built|designed|delivered|launched|established"),
      signal("Collaboration", "partnered|collaborat|cross-functional|stakeholder"),
      signal("Operating scale", "users|customers|environments|regions|servers|endpoints|sites|countries"),
      signal("Career progression", "promoted|senior|lead|principal|head"),
    ],
  },
  {
    id: "microsoft",
    label: "Microsoft / Enterprise",
    reader: "An enterprise hiring manager on the Microsoft stack, reading for scale, governance and Azure depth",
    priorities: [
      "hands-on depth in Azure and the wider Microsoft ecosystem (identity, endpoint, security, Microsoft 365)",
      "enterprise scale: the tenants, regions, users and devices supported",
      "security, identity and compliance built into the work",
      "customer and business impact",
      "collaboration across teams and partners",
      "a growth mindset: new capabilities learned, adopted and certified",
    ],
    leadWith: "enterprise-scale outcomes on the Microsoft platform",
    discounts: "generic cloud claims with no named Microsoft services or governance context",
    signals: [
      signal(
        MICROSOFT_STACK,
        "azure|entra|active directory|aad\\b|intune|microsoft 365|m365\\b|office 365|o365\\b|defender|sentinel|bicep|arm template|aks\\b|hyper-v|sccm\\b|mecm\\b|powershell|windows server|exchange online|exchange server|sharepoint|microsoft teams"
      ),
      signal("Governance and compliance", "governance|compliance|polic(?:y|ies)|audit|iso ?27001|soc ?2|gdpr|hipaa|regulat"),
      signal("Security and identity", "security|identity|iam\\b|rbac\\b|zero trust|mfa\\b|multi-factor|conditional access|least privilege"),
      signal(
        "Enterprise scale",
        "enterprise|global|multi-region|tenant|org-wide|organization-wide|company-wide|thousands|\\d[\\d,]* (?:users|devices|endpoints|servers|employees|mailboxes)"
      ),
      signal("Customer and business impact", "customer|client|business unit|adoption|end users|satisfaction"),
      signal("Growth mindset", "certified|certification|adopted|introduced|upskill|new capabilit"),
    ],
  },
  {
    id: "leadership",
    label: "Leadership / Manager",
    reader: "A senior leader hiring a people manager, reading for team outcomes and people development",
    priorities: [
      "the size and scope of the team led",
      "results delivered through the team, not only personally",
      "hiring, mentoring and growing people",
      "stakeholder management and communication upward",
      "prioritization and planning",
      "operational discipline: processes, service levels, metrics",
    ],
    leadWith: "what the team delivered under this person's leadership",
    discounts: "individual heroics presented as leadership, and leadership claims with no team context",
    signals: [
      TEAM_LEADERSHIP,
      PEOPLE_DEVELOPMENT,
      signal("Delivery through the team", "delivered|shipped|launched|rolled out|completed"),
      STAKEHOLDERS,
      ROADMAP,
      signal("Operational discipline", "process|sla\\b|kpi|metric|incident|service level|operational"),
    ],
  },
  {
    id: "cloud-architect",
    label: "Cloud Architect",
    reader: "A cloud architecture lead evaluating design authority and technical depth",
    priorities: [
      "architecture decisions and the trade-offs behind them",
      "depth on the cloud platforms the posting names",
      "reliability by design: availability, disaster recovery, failover",
      "security and compliance designed in, not bolted on",
      "cost-aware design",
      "infrastructure as code and automation",
    ],
    leadWith: "the design decision, the constraint it resolved, and its operating scale",
    discounts: "tool lists without design decisions, and operations work presented as architecture",
    signals: [
      signal("Architecture decisions", "architect|designed|reference architecture|landing zone|blueprint|trade-?off|design review"),
      signal("Cloud platforms", "aws\\b|azure|gcp\\b|google cloud|oci\\b|cloud"),
      signal(
        "Resilience and disaster recovery",
        "high availability|ha\\b|disaster recovery|dr\\b|failover|resilien|redundan|rto\\b|rpo\\b|uptime|availability|reliab"
      ),
      signal("Security by design", "security|iam\\b|encryption|zero trust|compliance|segmentation|private endpoint|key vault|kms\\b"),
      signal("Cost-aware design", "cost|finops|spend|savings|rightsiz|reserved instance|savings plan"),
      signal("Infrastructure as code", "terraform|bicep|cloudformation|arm template|infrastructure as code|iac\\b|pulumi|ansible"),
    ],
  },
  {
    id: "solution-architect",
    label: "Solution Architect",
    reader: "A pre-sales or delivery leader hiring someone who turns business requirements into solutions customers adopt",
    priorities: [
      "translating business requirements into solution designs",
      "customer and stakeholder engagement: workshops, presentations, demos",
      "integration across systems and platforms",
      "proofs of concept and pilots that led to adoption",
      "the business value delivered",
      "clear documentation and handover",
    ],
    leadWith: "the customer problem, the solution designed, and the business result",
    discounts: "deep implementation detail with no customer or business context",
    signals: [
      signal("Requirements to design", "requirement|discovery|business need|use case|scoping|scoped"),
      signal("Solution design and integration", "solution|integrat|apis?\\b|interoperab|architect"),
      signal("Customer engagement", "customer|client|stakeholder|workshop|presentation|presented|demo"),
      signal("Proofs of concept", "proof of concept|poc\\b|pilot|prototype"),
      signal("Business value", "revenue|roi\\b|business value|adoption|time to market|won\\b|deal"),
      signal("Documentation and handover", "documented|documentation|runbook|hld\\b|lld\\b|design document|handover|knowledge transfer"),
    ],
  },
  {
    id: "consulting",
    label: "Consulting / Client-Facing",
    reader: "A consulting partner or engagement manager reading for client impact and delivery discipline",
    priorities: [
      "outcomes delivered for clients",
      "engagement scope and delivery against deadlines",
      "advisory work: assessments, recommendations, roadmaps",
      "stakeholder management up to executive level",
      "commercial contribution: proposals, statements of work, renewals",
      "versatility across clients, industries or domains",
    ],
    leadWith: "the client outcome and the engagement it came from",
    discounts: "internal-only work with no client, stakeholder or commercial angle",
    signals: [
      signal("Client outcomes", "client|customer"),
      signal("Engagement delivery", "engagement|project|on time|on schedule|deadline|milestone"),
      signal("Advisory work", "advis|recommend|assessment|assessed|roadmap"),
      STAKEHOLDERS,
      signal("Commercial contribution", "proposal|statement of work|sow\\b|pre-?sales|bid\\b|rfp\\b|renewal|upsell"),
      signal("Versatility", "clients across|multiple clients|industries|sectors|verticals"),
    ],
  },
  {
    id: "cloud-eng-mgr",
    label: "Cloud Engineering Manager",
    reader: "A director hiring a manager who runs cloud engineering teams: people, delivery and platform reliability",
    priorities: [
      "leading and growing a cloud engineering team",
      "cloud platform delivery and migrations",
      "reliability and operations: service levels, incidents, on-call health",
      "roadmap ownership and prioritization",
      "hiring and mentoring engineers",
      "cloud cost governance",
    ],
    leadWith: "the team's platform outcomes and the reliability it sustained",
    discounts: "hands-on detail with no team, delivery or reliability ownership",
    signals: [
      TEAM_LEADERSHIP,
      signal("Cloud platform delivery", "aws\\b|azure|gcp\\b|cloud|kubernetes|migrat"),
      signal("Reliability and operations", "slo\\b|sla\\b|incident|on-?call|uptime|availability|postmortem|post-incident|mttr\\b"),
      ROADMAP,
      PEOPLE_DEVELOPMENT,
      COST,
    ],
  },
  {
    id: "infra-mgr",
    label: "Infrastructure Manager",
    reader: "An IT or operations leader hiring an infrastructure manager for stable, secure and cost-controlled operations",
    priorities: [
      "availability and service stability",
      "service management discipline (ITIL, change and problem management)",
      "vendor, contract and budget management",
      "security, patching, backup and compliance",
      "leading operations teams",
      "infrastructure modernization",
    ],
    leadWith: "stability and service outcomes, then the modernization delivered",
    discounts: "project work with no operational ownership or service-level accountability",
    signals: [
      signal("Availability and stability", "uptime|availability|sla\\b|outage|incident|mttr\\b|stabili"),
      signal("Service management", "itil|itsm|servicenow|change management|problem management|service desk|change advisory"),
      signal("Vendors and budget", "vendor|contract|budget|procure|licens|cost"),
      signal("Security and compliance", "patch|vulnerab|compliance|audit|security|backup"),
      TEAM_LEADERSHIP,
      signal("Modernization", "migrat|moderniz|virtuali|consolidat|upgrade|cloud"),
    ],
  },
  {
    id: "assoc-director",
    label: "Associate Director / Lead roles",
    reader: "A VP hiring a first-line senior leader who already leads other leads and owns a portfolio",
    priorities: [
      "ownership of a portfolio or of several teams",
      "turning strategy into executed initiatives",
      "influence with executives and peer leaders",
      "budget ownership",
      "developing managers and senior talent",
      "governance through metrics and reporting",
    ],
    leadWith: "the portfolio owned and the business result it delivered",
    discounts: "single-project delivery presented as portfolio leadership",
    signals: [
      signal("Portfolio ownership", "portfolio|program|multiple teams|across teams|org-wide|department|division"),
      signal("Strategy execution", "strateg|initiative|transformation|roadmap"),
      signal("Executive influence", "executive|leadership team|influenc|c-suite|vp\\b"),
      COST,
      signal("Developing leaders", "managers|team leads|succession|mentor|coach|hired"),
      signal("Metrics and governance", "kpi|metric|okr|governance|reporting|dashboard|scorecard"),
    ],
  },
  {
    id: "director-mid",
    label: "Director / Head of Cloud (mid-size)",
    reader: "A CTO at a mid-size company hiring a Head of Cloud who is both strategist and hands-on builder",
    priorities: [
      "a cloud strategy this person set and then delivered",
      "hands-on credibility: they still build",
      "building and scaling the team",
      "cost and value for money",
      "vendor and partner selection",
      "reliability and security posture",
    ],
    leadWith: "the strategy set and what it delivered, backed by hands-on work",
    discounts: "pure people management with no technical credibility, or pure engineering with no strategy",
    signals: [
      signal("Cloud strategy", "strateg|roadmap|vision|cloud adoption|target architecture"),
      signal("Hands-on delivery", "built|implemented|configured|automated|terraform|kubernetes|scripted"),
      signal("Team building", "built (?:a |the )?team|hired|grew the team|scaled the team|team of \\d|recruited"),
      COST,
      signal("Vendors and partners", "vendor|partner|contract|negotiat|evaluated|selected"),
      signal("Reliability and security", "availability|security|compliance|incident|disaster recovery|resilien"),
    ],
  },
  {
    id: "director-large",
    label: "Director / Head of Cloud (large-size)",
    reader: "An enterprise CIO or CTO hiring a Head of Cloud for a large organization: governance, scale and executive influence",
    priorities: [
      "enterprise-scale programs across business units or regions",
      "governance, risk and compliance",
      "executive and board-level stakeholder management",
      "budget ownership at scale",
      "leading leaders: organization design and managers of managers",
      "operating models such as a cloud center of excellence",
    ],
    leadWith: "enterprise scope, governance and the executive outcome",
    discounts: "hands-on detail at the expense of scope, governance and organizational leadership",
    signals: [
      signal("Enterprise scale", "enterprise|global|multi-region|org-wide|organization-wide|business units|thousands|regions"),
      signal("Governance and risk", "governance|compliance|risk|audit|regulat|polic(?:y|ies)"),
      signal("Executive influence", "executive|c-suite|board|steering|leadership team|cio\\b|cto\\b|ciso\\b"),
      signal("Budget at scale", "budget|p&l|multi-million|million|cost"),
      signal("Leading leaders", "managers|leaders|org design|organization design|headcount|team of \\d"),
      signal("Operating model", "operating model|center of excellence|centre of excellence|ccoe\\b|standardi|framework"),
    ],
  },
  {
    id: "principal-architect",
    label: "Principal Cloud Architect",
    reader:
      "A distinguished engineer or VP evaluating the most senior individual contributor: technical direction across the organization and influence without authority",
    priorities: [
      "technical direction set across teams or the organization",
      "hard architecture trade-offs, and why",
      "standards, patterns and reference architectures that others adopted",
      "mentoring architects and senior engineers",
      "influence without authority",
      "deep expertise in distributed, scalable systems",
    ],
    leadWith: "the technical direction set and how widely it was adopted",
    discounts: "people-management framing, and implementation detail confined to one team",
    signals: [
      signal("Technical direction", "technical direction|technical strategy|architecture strategy|vision|north star|roadmap"),
      signal("Architecture trade-offs", "trade-?off|architect|design review|decision record|adr\\b|evaluated"),
      signal("Standards others adopted", "standard|reference architecture|pattern|guardrail|framework|blueprint|adopted by"),
      signal("Mentoring", "mentor|coach|guided|upskill"),
      signal("Influence without authority", "influenc|cross-team|cross-org|aligned|consensus|stakeholder"),
      signal("Distributed-systems depth", "distributed|scalab|latency|throughput|performance|resilien|kubernetes|multi-region"),
    ],
  },
  {
    id: "cto-vp",
    label: "CTO / VP of Engineering",
    reader: "A CEO or board hiring an engineering executive: business outcomes, organization building and technical strategy",
    priorities: [
      "business outcomes: revenue, margin, time to market",
      "technology strategy and its results",
      "building the organization and its culture",
      "communication with the board and the executive team",
      "budget ownership",
      "risk, security and compliance posture",
    ],
    leadWith: "the business outcome and the organization that delivered it",
    discounts: "technical detail that does not connect to business results",
    signals: [
      signal("Business outcomes", "revenue|growth|margin|time to market|arr\\b|profit|customer acquisition|retention"),
      signal("Technology strategy", "technology strategy|technical strategy|vision|roadmap|platform strategy|strateg"),
      signal(
        "Organization building",
        "built (?:the |an? )?(?:team|org)|scaled (?:the )?(?:team|org)|hired|org design|culture|headcount"
      ),
      signal("Board and executive communication", "board|ceo\\b|executive|investor|c-suite"),
      COST,
      signal("Risk and security posture", "risk|security|compliance|governance"),
    ],
  },
  {
    id: "digital-transform",
    label: "Digital Transformation Lead",
    reader: "A transformation sponsor hiring someone to modernize legacy estates and drive adoption",
    priorities: [
      "legacy modernization and migration",
      "change management and adoption",
      "business process improvement and automation",
      "cloud and digital platform adoption",
      "alignment across business units and sponsors",
      "measurable transformation outcomes",
    ],
    leadWith: "the before and after of what was transformed, and who adopted it",
    discounts: "technology changes with no adoption, process or business outcome",
    signals: [
      signal("Legacy modernization", "moderniz|legacy|migrat|re-?platform|refactor|decommission"),
      signal("Change and adoption", "adoption|change management|training|rollout|rolled out|onboard"),
      signal("Process improvement", "process|automat|workflow|efficien|streamlin|manual"),
      signal("Digital platforms", "cloud|saas\\b|digital|platform|erp\\b|crm\\b"),
      STAKEHOLDERS,
      signal("Measurable outcomes", "reduced|improved|increased|cut|saved|faster"),
    ],
  },
  {
    id: "platform-dir",
    label: "Platform Engineering Director",
    reader: "A VP of Engineering hiring a platform engineering leader: internal platforms, developer experience and paved roads",
    priorities: [
      "an internal platform other engineering teams build on",
      "developer experience and productivity",
      "containers, Kubernetes and infrastructure as code at scale",
      "site reliability practice: service level objectives, observability, incident response",
      "self-service, standardization and reusable building blocks",
      "leading platform teams",
    ],
    leadWith: "what the platform let other teams do, and how many teams used it",
    discounts: "one-off infrastructure projects with no platform, self-service or adoption angle",
    signals: [
      signal("Internal platform", "internal (?:developer )?platform|platform team|self-service|golden path|paved road|backstage"),
      signal("Developer experience", "developer experience|developer productivity|devex|lead time|deployment frequency|onboarding time"),
      signal("Containers and infrastructure as code", "kubernetes|k8s\\b|container|docker|terraform|helm|gitops|argo"),
      signal("Site reliability", "sre\\b|slo\\b|sli\\b|error budget|observability|monitoring|incident"),
      signal("Standardization", "standardi|template|module|reusable|guardrail|paved"),
      TEAM_LEADERSHIP,
    ],
  },
];

/** Keyed by id and by lower-case label; a Map, so no key can resolve to an Object.prototype member. */
const PROFILE_MAP = new Map<string, AudienceProfile>();
for (const profile of PROFILES) {
  PROFILE_MAP.set(profile.id, profile);
  PROFILE_MAP.set(profile.label.toLowerCase(), profile);
}

export const AUDIENCE_PROFILES: readonly AudienceProfile[] = PROFILES;

/** The catalog profile for an id or label ("cloud-architect", "Cloud Architect", "cloud_architect"). */
export function audienceProfile(idOrLabel: unknown): AudienceProfile | null {
  if (typeof idOrLabel !== "string") return null;
  const key = idOrLabel.trim().toLowerCase();
  if (!key) return null;
  return PROFILE_MAP.get(key) ?? PROFILE_MAP.get(key.replace(/[\s_]+/g, "-")) ?? null;
}

/* ------------------------------------------------------------------ *
 * Mix normalization
 * ------------------------------------------------------------------ */

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3).trimEnd()}...` : text;
}

function isMixSource(value: unknown): value is AudienceMixSource {
  return value === "ai" || value === "keywords" || value === "manual";
}

/** Integer percentages summing to 100 (largest remainder), preserving order. */
function toPercentages(weights: number[]): number[] {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (!(total > 0)) {
    const share = Math.floor(100 / weights.length);
    return weights.map((_, i) => (i === 0 ? 100 - share * (weights.length - 1) : share));
  }
  const exact = weights.map((w) => (w / total) * 100);
  const result = exact.map((v) => Math.floor(v));
  const remainder = 100 - result.reduce((sum, v) => sum + v, 0);
  const order = exact
    .map((v, i) => ({ i, fraction: v - Math.floor(v) }))
    .sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  for (let k = 0; k < remainder; k++) result[order[k % order.length].i] += 1;
  return result;
}

interface Candidate {
  id: string;
  label: string;
  /** null when no weight was given; 0 when a non-positive one was. */
  weight: number | null;
  reason?: string;
}

function toCandidate(item: unknown): Candidate | null {
  let rawId = "";
  let label = "";
  let weight: number | null = null;
  let reason: string | undefined;

  if (typeof item === "string") {
    rawId = item;
  } else if (item && typeof item === "object") {
    const obj = item as Record<string, unknown>;
    rawId = typeof obj.id === "string" ? obj.id : "";
    label = cleanText(obj.label, MAX_LABEL_LENGTH);
    const raw = typeof obj.weight === "number" ? obj.weight : typeof obj.weight === "string" ? Number(obj.weight) : NaN;
    if (Number.isFinite(raw)) weight = raw > 0 ? raw : 0;
    reason = cleanText(obj.reason, MAX_REASON_LENGTH) || undefined;
  } else {
    return null;
  }

  const profile = audienceProfile(rawId) || audienceProfile(label);
  if (profile) return { id: profile.id, label: profile.label, weight, reason };

  // "custom", or a reader outside the catalog: kept as the one custom reader, under its own name.
  const isCustomId = rawId.trim().toLowerCase() === CUSTOM_AUDIENCE_ID;
  const name = label || (isCustomId ? "" : cleanText(rawId, MAX_LABEL_LENGTH));
  if (!name) return null;
  return { id: CUSTOM_AUDIENCE_ID, label: name, weight, reason };
}

/**
 * Validates any audience selection - a model's JSON, a stored mix, a request
 * body or a plain list of ids - into at most three readers whose integer
 * weights sum to 100, primary first. Returns null when nothing usable remains.
 *
 * Weighted input is ordered by weight; unweighted input keeps its order and
 * takes the default weights for that many readers. Readers under 10% are
 * dropped (the primary never is).
 */
export function normalizeAudienceMix(raw: unknown, source?: AudienceMixSource): AudienceMix | null {
  let items: unknown = raw;
  let declaredSource: unknown;
  if (items && typeof items === "object" && !Array.isArray(items)) {
    const obj = items as Record<string, unknown>;
    declaredSource = obj.source;
    items = Array.isArray(obj.entries) ? obj.entries : Array.isArray(obj.audiences) ? obj.audiences : null;
  }
  if (!Array.isArray(items)) return null;

  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const candidate = toCandidate(item);
    if (!candidate || candidate.weight === 0 || seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    candidates.push(candidate);
  }
  if (candidates.length === 0) return null;

  let chosen: Candidate[];
  let weights: number[];
  if (candidates.every((c) => c.weight !== null)) {
    chosen = candidates
      .map((candidate, index) => ({ candidate, index }))
      .sort((a, b) => (b.candidate.weight as number) - (a.candidate.weight as number) || a.index - b.index)
      .slice(0, MAX_BLENDED_AUDIENCES)
      .map(({ candidate }) => candidate);
    weights = toPercentages(chosen.map((c) => c.weight as number));
  } else {
    chosen = candidates.slice(0, MAX_BLENDED_AUDIENCES);
    weights = [...DEFAULT_WEIGHTS[chosen.length - 1]];
  }

  const kept = chosen
    .map((candidate, i) => ({ candidate, weight: weights[i] }))
    .filter((entry, i) => i === 0 || entry.weight >= MIN_READER_SHARE);
  const finalWeights = kept.length === chosen.length ? weights : toPercentages(kept.map((entry) => entry.weight));

  return {
    entries: kept.map(({ candidate }, i) => ({
      id: candidate.id,
      label: candidate.label,
      weight: finalWeights[i],
      ...(candidate.reason ? { reason: candidate.reason } : {}),
    })),
    source: source ?? (isMixSource(declaredSource) ? declaredSource : "manual"),
  };
}

/**
 * The blend for the audiences currently selected in the UI, in priority order.
 *
 * Keeps the weights and reasons of the last Auto-Select while every selected
 * reader came from it in the same order (removing one simply re-shares the
 * weight). Adding or re-ordering readers makes the blend hand-picked, which
 * takes the default weights by position.
 */
export function resolveAudienceMix(
  selectedIds: unknown,
  options: { customLabel?: string; suggested?: AudienceMix | null } = {}
): AudienceMix | null {
  const ids: string[] = [];
  for (const raw of Array.isArray(selectedIds) ? selectedIds : []) {
    const id = typeof raw === "string" ? raw.trim() : "";
    if (id && !ids.includes(id)) ids.push(id);
  }
  const chosen = ids.slice(0, MAX_BLENDED_AUDIENCES);
  if (chosen.length === 0) return null;

  const suggested = options.suggested && Array.isArray(options.suggested.entries) ? options.suggested : null;
  const suggestedFor = (id: string) => suggested?.entries.find((entry) => entry && entry.id === id);
  const customLabel =
    cleanText(options.customLabel, MAX_LABEL_LENGTH) || suggestedFor(CUSTOM_AUDIENCE_ID)?.label || "Custom Persona";

  const weights = chosen.map((id) => suggestedFor(id)?.weight);
  const keepSuggested = weights.every(
    (w, i) => typeof w === "number" && w > 0 && (i === 0 || w <= (weights[i - 1] as number))
  );

  return normalizeAudienceMix(
    chosen.map((id, i) => ({
      id,
      label: id === CUSTOM_AUDIENCE_ID ? customLabel : id,
      weight: keepSuggested ? weights[i] : undefined,
      reason: suggestedFor(id)?.reason,
    })),
    keepSuggested && suggested ? suggested.source : "manual"
  );
}

/** "Cloud Architect 60% + Cloud Engineering Manager 40%", or just the label for one reader. */
export function audienceHeadline(mix: AudienceMix | null | undefined): string {
  if (!mix || !Array.isArray(mix.entries) || mix.entries.length === 0) return "";
  if (mix.entries.length === 1) return mix.entries[0].label;
  return mix.entries.map((entry) => `${entry.label} ${entry.weight}%`).join(" + ");
}

/**
 * Fingerprint of the posting an Auto-Select suggestion was made for. Its
 * weights and reasons describe that posting only, so a suggestion stops
 * applying once the job description changes. Whitespace and case are ignored.
 */
export function postingFingerprint(jobDescription: unknown): string {
  const text = typeof jobDescription === "string" ? jobDescription.replace(/\s+/g, " ").trim().toLowerCase() : "";
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${text.length}:${hash.toString(16)}`;
}

/* ------------------------------------------------------------------ *
 * Keyword fallback for Auto-Select
 * ------------------------------------------------------------------ */

const LEADERSHIP_TITLE = /\b(?:manager|director|head|vp|vice president|chief|cto|cio|lead|supervisor)\b/i;

/** Readers who judge a people leader: never chosen for an individual-contributor title. */
const PEOPLE_LEADER_AUDIENCES = new Set([
  "leadership",
  "cloud-eng-mgr",
  "infra-mgr",
  "assoc-director",
  "director-mid",
  "director-large",
  "cto-vp",
  "platform-dir",
  "digital-transform",
]);

const TITLE_BOOSTS: { pattern: RegExp; label: string; boosts: [string, number][] }[] = [
  { pattern: /\b(?:cto|chief technology officer|vp|vice president)\b/i, label: "executive title", boosts: [["cto-vp", 6], ["director-large", 2]] },
  { pattern: /\bassociate director\b/i, label: "associate director title", boosts: [["assoc-director", 6]] },
  { pattern: /\b(?:director|head of)\b/i, label: "director-level title", boosts: [["director-mid", 4], ["director-large", 3]] },
  { pattern: /\bmanager\b/i, label: "manager title", boosts: [["leadership", 3], ["cloud-eng-mgr", 3], ["infra-mgr", 2]] },
  { pattern: /\b(?:lead|supervisor)\b/i, label: "lead title", boosts: [["leadership", 2], ["assoc-director", 1]] },
  { pattern: /\binfrastructure\b/i, label: "infrastructure focus", boosts: [["infra-mgr", 2]] },
  { pattern: /\bplatform\b/i, label: "platform focus", boosts: [["platform-dir", 3]] },
  { pattern: /\bprincipal\b/i, label: "principal-level title", boosts: [["principal-architect", 5]] },
  { pattern: /\bsolutions? architect/i, label: "solution architect title", boosts: [["solution-architect", 6]] },
  { pattern: /\barchitect/i, label: "architect title", boosts: [["cloud-architect", 4], ["principal-architect", 1]] },
  { pattern: /\bconsult/i, label: "consulting title", boosts: [["consulting", 5]] },
  { pattern: /\btransformation\b/i, label: "transformation focus", boosts: [["digital-transform", 5]] },
  { pattern: /\b(?:azure|microsoft)\b/i, label: "Microsoft stack in the title", boosts: [["microsoft", 3]] },
  { pattern: /\bcloud\b/i, label: "cloud focus", boosts: [["cloud-architect", 1], ["cloud-eng-mgr", 1], ["director-mid", 1]] },
];

/**
 * Deterministic Auto-Select used when the model is unavailable or returns
 * nothing usable: title cues carry most of the weight, evidence in the posting
 * adds to it, and people-leadership readers are only considered for a
 * leadership title. Falls back to the general reader.
 */
export function keywordAudienceMix(jobDescription: string, targetRole: string): AudienceMix {
  const jd = String(jobDescription || "");
  const role = String(targetRole || "").trim();
  const title = role || (jd.split(/\r?\n/).find((line) => line.trim()) || "").slice(0, 160);
  const leadsPeople = LEADERSHIP_TITLE.test(title);

  const scored: { profile: AudienceProfile; score: number; reason: string; order: number }[] = [];
  PROFILES.forEach((profile, order) => {
    if (profile.id === "general") return;
    if (!leadsPeople && PEOPLE_LEADER_AUDIENCES.has(profile.id)) return;
    const hits = profile.signals.filter((s) => s.pattern.test(jd)).map((s) => s.label);
    if (profile.id === "microsoft" && !hits.includes(MICROSOFT_STACK) && !/\b(?:azure|microsoft)\b/i.test(title)) return;

    let score = hits.length * 0.5;
    const cues: string[] = [];
    for (const rule of TITLE_BOOSTS) {
      if (!rule.pattern.test(title)) continue;
      const boost = rule.boosts.find(([id]) => id === profile.id);
      if (!boost) continue;
      score += boost[1];
      cues.push(rule.label);
    }
    if (score < 2) return;

    const reasonParts: string[] = [];
    if (cues.length > 0) reasonParts.push(cues.join(", "));
    if (hits.length > 0) reasonParts.push(`posting mentions ${hits.slice(0, 3).map((h) => h.toLowerCase()).join(", ")}`);
    scored.push({ profile, score, reason: cleanText(reasonParts.join("; "), MAX_REASON_LENGTH), order });
  });

  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  const mix = normalizeAudienceMix(
    scored.slice(0, MAX_BLENDED_AUDIENCES).map((s) => ({ id: s.profile.id, weight: s.score, reason: s.reason })),
    "keywords"
  );
  return (
    mix || {
      entries: [
        {
          id: "general",
          label: "General Professional",
          weight: 100,
          reason: "No title or posting cue pointed at a more specific reader",
        },
      ],
      source: "keywords",
    }
  );
}

/* ------------------------------------------------------------------ *
 * The brief
 * ------------------------------------------------------------------ */

export type AudienceBriefScope = "document" | "role";

/**
 * The reader brief for the generation prompts: the whole-document prompt
 * ("document") or a single role's prompt ("role"). Empty when there is no mix.
 */
export function buildAudienceBrief(mix: AudienceMix | null | undefined, scope: AudienceBriefScope = "document"): string {
  if (!mix || !Array.isArray(mix.entries) || mix.entries.length === 0) return "";
  const entries = mix.entries;
  const single = entries.length === 1;
  const lines: string[] = [
    single
      ? "=== TARGET READER ==="
      : `=== AUDIENCE BLEND - ONE document that must work for ${entries.length} readers ===`,
  ];

  entries.forEach((entry, i) => {
    const profile = entry.id === CUSTOM_AUDIENCE_ID ? null : audienceProfile(entry.id);
    const tag = single ? "READER" : i === 0 ? `PRIMARY (${entry.weight}%)` : `SECONDARY (${entry.weight}%)`;
    lines.push(`${tag}: ${entry.label}`);
    if (profile) {
      lines.push(`  Who: ${profile.reader}.`);
      lines.push(`  Scans for, most important first: ${profile.priorities.join("; ")}.`);
      if (i === 0) lines.push(`  Lead with: ${profile.leadWith}.`);
      lines.push(`  Discounts: ${profile.discounts}.`);
    } else {
      lines.push(
        `  A reader defined by the candidate. Infer what a "${entry.label}" values from that title and the job description.`
      );
    }
    if (entry.reason) lines.push(`  Why this reader: ${entry.reason}`);
  });

  const rules: string[] = [
    single
      ? "The TARGET JOB DESCRIPTION outranks this reader: the reader decides emphasis only among achievements relevant to the posting, and wherever the reader's priorities and the posting disagree - on order, selection or framing - the TARGET JOB DESCRIPTION decides."
      : "The TARGET JOB DESCRIPTION outranks every reader: readers decide emphasis only among achievements relevant to the posting, and wherever a reader's priorities and the posting disagree - on order, selection or framing - or readers disagree with each other, the TARGET JOB DESCRIPTION decides.",
  ];
  if (single) {
    rules.push(
      scope === "document"
        ? "Among the achievements relevant to the posting, frame the summary for this reader and put what this reader values most first in each role."
        : "Among this role's achievements relevant to the posting, open with the one this reader values most, and order the rest by the same priorities."
    );
  } else if (scope === "document") {
    rules.push(
      "Among the achievements relevant to the posting, the PRIMARY reader sets the summary's framing, the opening bullet of each role, and the order of emphasis within it.",
      "SECONDARY readers decide which additional, genuinely evidenced achievements earn a place. Give each roughly its weight's share of emphasis across the document - never at the expense of the primary reader's top priorities.",
      "Write ONE voice and ONE document: no per-reader sections, and never name these readers in the resume."
    );
  } else {
    rules.push(
      "Among this role's achievements relevant to the posting, open with the one the PRIMARY reader values most.",
      "Include a SECONDARY reader's priority only where this role's own evidence shows it; other roles cover it otherwise."
    );
  }
  rules.push(
    "A reader never licenses a claim. If the source holds no evidence for a priority, leave it out" +
      (scope === "document" ? " (list it in keyword_gap only if the job description asks for it)" : "") +
      ". Never invent team sizes, budgets, titles, scope or leadership to satisfy a reader.",
    "Readers change which bullets are chosen and in what order - never how many. The bullet budget still applies."
  );
  if (scope === "document") {
    rules.push(
      single
        ? 'In "audience_alignment_notes", state in one or two sentences how the document serves this reader.'
        : 'In "audience_alignment_notes", state in one sentence per reader how the document serves them.'
    );
  }

  lines.push(single ? "HOW TO WRITE FOR THIS READER:" : "HOW TO BLEND:");
  rules.forEach((rule) => lines.push(`- ${rule}`));
  return lines.join("\n");
}

/* ------------------------------------------------------------------ *
 * Coverage
 * ------------------------------------------------------------------ */

function collectStrings(value: unknown, out: string[], depth = 0): void {
  if (value == null || depth > 6) return;
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, depth + 1);
  } else if (typeof value === "object") {
    for (const key of Object.keys(value as object)) {
      if (key.startsWith("_") || key === "personal_info") continue;
      collectStrings((value as Record<string, unknown>)[key], out, depth + 1);
    }
  }
}

/** What a reader actually sees: summary, skills, role titles and bullets, projects, education, certifications. */
function resumeEvidenceText(resume: any): string {
  const parts: string[] = [];
  collectStrings(resume?.summary, parts);
  collectStrings(resume?.skills, parts);
  for (const role of Array.isArray(resume?.experience) ? resume.experience : []) {
    collectStrings(role?.role, parts);
    collectStrings(role?.bullets, parts);
    collectStrings(role?.description, parts);
  }
  collectStrings(resume?.projects, parts);
  collectStrings(resume?.education, parts);
  collectStrings(resume?.certifications, parts);
  return parts.join("\n");
}

/** The source resume's text. For JSON only the values count: key names such as "projects" are not evidence. */
function sourceEvidenceText(sourceText: string): string {
  const text = String(sourceText || "");
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parts: string[] = [];
      collectStrings(JSON.parse(trimmed), parts);
      return parts.join("\n");
    } catch {
      // Not JSON: read it as plain text.
    }
  }
  return text;
}

function weightedAverage(values: { weight: number; value: number | null }[]): number | null {
  const scored = values.filter((v) => typeof v.value === "number");
  const totalWeight = scored.reduce((sum, v) => sum + v.weight, 0);
  if (scored.length === 0 || totalWeight <= 0) return null;
  return Math.round(scored.reduce((sum, v) => sum + v.weight * (v.value as number), 0) / totalWeight);
}

/**
 * How much of what each selected reader scans for is evidenced in the final
 * resume, against the source resume. Keyword evidence only: a missing signal
 * means the words are absent, not that the candidate lacks the experience -
 * and it should only be added if it is true.
 */
export function computeAudienceCoverage(
  resume: any,
  mix: AudienceMix | null | undefined,
  options: { sourceText?: string } = {}
): AudienceCoverageReport | null {
  if (!resume || typeof resume !== "object") return null;
  const normalized = normalizeAudienceMix(mix);
  if (!normalized) return null;

  const finalText = resumeEvidenceText(resume);
  const sourceText = options.sourceText ? sourceEvidenceText(options.sourceText) : "";

  const entries: AudienceCoverageEntry[] = normalized.entries.map((entry, i) => {
    const profile = entry.id === CUSTOM_AUDIENCE_ID ? null : audienceProfile(entry.id);
    const base = {
      id: entry.id,
      label: entry.label,
      weight: entry.weight,
      primary: i === 0,
      ...(entry.reason ? { reason: entry.reason } : {}),
    };
    if (!profile) {
      return {
        ...base,
        scored: false,
        signal_count: 0,
        coverage: null,
        baseline: null,
        matched: [],
        missing: [],
        gained: [],
        lost: [],
      };
    }
    const total = profile.signals.length;
    const matched = profile.signals.filter((s) => s.pattern.test(finalText)).map((s) => s.label);
    const before = sourceText ? profile.signals.filter((s) => s.pattern.test(sourceText)).map((s) => s.label) : null;
    return {
      ...base,
      scored: true,
      signal_count: total,
      coverage: Math.round((matched.length / total) * 100),
      baseline: before ? Math.round((before.length / total) * 100) : null,
      matched,
      missing: profile.signals.map((s) => s.label).filter((label) => !matched.includes(label)),
      gained: before ? matched.filter((label) => !before.includes(label)) : [],
      lost: before ? before.filter((label) => !matched.includes(label)) : [],
    };
  });

  return {
    method: "audience-signal-coverage-v1",
    headline: audienceHeadline(normalized),
    source: normalized.source,
    weighted: weightedAverage(entries.map((e) => ({ weight: e.weight, value: e.coverage }))),
    baseline_weighted: sourceText
      ? weightedAverage(entries.map((e) => ({ weight: e.weight, value: e.baseline })))
      : null,
    entries,
  };
}

/** Attaches resume.audience_coverage. Never throws: coverage is a report, not a gate. */
export function applyAudienceCoverage(
  resume: any,
  mix: AudienceMix | null | undefined,
  options: { sourceText?: string } = {}
): any {
  if (!resume || typeof resume !== "object") return resume;
  try {
    const report = computeAudienceCoverage(resume, mix, options);
    if (report) resume.audience_coverage = report;
    else delete resume.audience_coverage;
  } catch (e: any) {
    console.warn("[audienceProfiles] Audience coverage failed; returning document without it:", e?.message || e);
    delete resume.audience_coverage;
  }
  return resume;
}
