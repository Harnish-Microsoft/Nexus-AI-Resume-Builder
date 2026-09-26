/**
 * Deterministic FAANG-grade impact audit for a generated resume.
 *
 * This is the bullet-quality counterpart to matchScore.ts. Where matchScore asks
 * "does this resume match THIS posting", this asks "would these bullets survive a
 * top-tier engineering screen", independently of any job description.
 *
 * It is computed, not guessed: the same document always produces the same score,
 * and every deduction points at a specific bullet with a concrete fix. No model
 * call is involved, so it is free and instant.
 *
 * Keep this module dependency-free: it is bundled by both esbuild (node, via
 * server.ts) and vite (browser, via geminiService.ts), exactly like matchScore.ts
 * and resumePrompt.ts.
 */

export interface ImpactFinding {
  id: string;
  severity: "low" | "medium" | "high";
  role: string;
  bullet: string;
  issue: string;
  fix: string;
}

export interface ImpactComponent {
  id: string;
  label: string;
  weight: number;
  score: number;
  detail: string;
}

export interface ImpactScoreResult {
  method: string;
  score: number;
  bullets_evaluated: number;
  quantified_ratio: number;
  components: ImpactComponent[];
  findings: ImpactFinding[];
  star_linked: number;
  star_dropped: number;
}

/* ------------------------------------------------------------------ *
 * Vocabulary
 * ------------------------------------------------------------------ */

/** Verbs that signal execution and ownership. Lowercase, base form matched by prefix. */
const STRONG_VERBS = new Set([
  "architected", "authored", "automated", "benchmarked", "broke", "built", "centralized",
  "codified", "consolidated", "constructed", "containerized", "converted", "created",
  "cut", "debugged", "decomposed", "decoupled", "defined", "delivered", "deployed",
  "deprecated", "designed", "diagnosed", "documented", "doubled", "drove", "eliminated",
  "enabled", "enforced", "engineered", "established", "evaluated", "expanded", "extended",
  "governed", "hardened", "identified", "implemented", "improved", "increased",
  "instrumented", "integrated", "introduced", "isolated", "launched", "led", "lowered",
  "maintained", "mentored", "migrated", "minimized", "modeled", "modernized", "monitored",
  "negotiated", "onboarded", "optimized", "owned", "partnered", "patched", "ported",
  "prevented", "prioritized", "profiled", "provisioned", "rearchitected", "rebuilt",
  "reconciled", "recovered", "reduced", "refactored", "released", "remediated", "removed",
  "replaced", "resolved", "restored", "restructured", "retired", "rewrote", "scaled",
  "scoped", "secured", "shipped", "simplified", "standardized", "streamlined", "tested",
  "tightened", "tuned", "unblocked", "unified", "upgraded", "validated", "wrote",
]);

/** Filler verbs that read as AI slop or as borrowed credit. */
const BANNED_VERBS = new Set([
  "spearheaded", "orchestrated", "pioneered", "leveraged", "empowered", "synergized",
  "revolutionized", "championed", "utilized", "facilitated", "helmed", "evangelized",
  "unleashed", "transformed",
]);

/** Phrases that surrender ownership of the work. */
const PASSIVE_PATTERNS: { pattern: RegExp; phrase: string }[] = [
  { pattern: /\bresponsible for\b/, phrase: "responsible for" },
  { pattern: /\bworked on\b/, phrase: "worked on" },
  { pattern: /\bworked with\b/, phrase: "worked with" },
  { pattern: /\bhelped (?:to )?\w+/, phrase: "helped" },
  { pattern: /\bassisted (?:with|in)\b/, phrase: "assisted with" },
  { pattern: /\b(?:was |were )?involved in\b/, phrase: "involved in" },
  { pattern: /\bparticipated in\b/, phrase: "participated in" },
  { pattern: /\bwas part of\b/, phrase: "was part of" },
  { pattern: /\btasked with\b/, phrase: "tasked with" },
  { pattern: /\bduties included\b/, phrase: "duties included" },
  { pattern: /\bcontributed to\b/, phrase: "contributed to" },
  { pattern: /\bexposure to\b/, phrase: "exposure to" },
  { pattern: /\bfamiliar with\b/, phrase: "familiar with" },
];

/** Words that occupy space without narrowing anything. */
const VAGUE_PATTERNS: { pattern: RegExp; phrase: string }[] = [
  { pattern: /\bvarious\b/, phrase: "various" },
  { pattern: /\bmultiple\b/, phrase: "multiple" },
  { pattern: /\bseveral\b/, phrase: "several" },
  { pattern: /\bnumerous\b/, phrase: "numerous" },
  { pattern: /\bas needed\b/, phrase: "as needed" },
  { pattern: /\bday[- ]to[- ]day\b/, phrase: "day-to-day" },
  { pattern: /\bbest practices\b/, phrase: "best practices" },
  { pattern: /\bcutting[- ]edge\b/, phrase: "cutting-edge" },
  { pattern: /\bstate[- ]of[- ]the[- ]art\b/, phrase: "state-of-the-art" },
  { pattern: /\bworld[- ]class\b/, phrase: "world-class" },
  { pattern: /\bseamless(?:ly)?\b/, phrase: "seamless" },
  { pattern: /\brobust\b/, phrase: "robust" },
  { pattern: /\bhighly (?:scalable|available|efficient)\b/, phrase: "highly scalable/available" },
  { pattern: /\bwide range of\b/, phrase: "wide range of" },
];

/** Signals that a bullet closes on a consequence rather than a duty. */
const OUTCOME_MARKERS = [
  "reducing", "reduced", "cutting", "eliminating", "eliminated", "improving", "improved",
  "increasing", "increased", "enabling", "enabled", "unblocking", "preventing", "prevented",
  "resulting in", "which removed", "which cut", "saving", "saved", "accelerating",
  "shortening", "raising", "lowering", "lifting", "dropping", "freeing", "removing",
  "retiring", "consolidating", "halving", "restoring", "stabilizing", "avoiding",
];

/** Outcome nouns worth closing on when no number exists. */
const OUTCOME_NOUNS = [
  "uptime", "latency", "downtime", "throughput", "cost", "spend", "churn", "adoption",
  "coverage", "lead time", "cycle time", "mttr", "mtbf", "error rate", "failure rate",
  "toil", "escalation", "escalations", "incident", "incidents", "outage", "outages",
  "backlog", "onboarding time", "build time", "deploy time", "page load", "conversion",
  "retention", "compliance", "audit", "sla", "slo",
];

/** Round figures that read as invented rather than measured. */
const ROUND_NUMBER_PATTERN = /\b(?:10|20|25|30|40|50|60|70|75|80|90|100)%|\b[2-9]x\b|\bover \d+00\b|\bmillions of\b/;

const QUANTIFIER_PATTERN =
  /(?:\d+(?:[.,]\d+)?\s*%)|(?:[$€£₹]\s?\d)|(?:\b\d+(?:[.,]\d+)?\s*(?:k|m|bn|b|mn)\b)|(?:\b\d+(?:[.,]\d+)?\s*(?:ms|s|sec|secs|seconds|min|mins|minutes|hours|hrs|days|weeks|months)\b)|(?:\b\d+(?:[.,]\d+)?\s*(?:x|tb|gb|mb|qps|rps|req\/s|users|customers|clients|servers|nodes|clusters|services|endpoints|tickets|engineers|teams|regions|environments|pipelines|repositories|accounts)\b)|(?:\b\d{2,}\b)/;

/** Bands for the share of bullets that should carry a number. */
const QUANT_IDEAL_LOW = 0.25;
const QUANT_IDEAL_HIGH = 0.5;

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function lower(text: string): string {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function words(text: string): string[] {
  return lower(text).split(" ").filter(Boolean);
}

/** Leading verb of a bullet, ignoring an optional "&"/"and" compound lead. */
function leadVerb(bullet: string): string {
  const tokens = words(bullet);
  if (tokens.length === 0) return "";
  return tokens[0].replace(/[^a-z]/g, "");
}

function isStrongVerb(word: string): boolean {
  if (!word) return false;
  if (STRONG_VERBS.has(word)) return true;
  // Regular past tense not in the list is still a credible action lead.
  return word.length > 4 && word.endsWith("ed") && !BANNED_VERBS.has(word);
}

function hasQuantifier(bullet: string): boolean {
  return QUANTIFIER_PATTERN.test(lower(bullet));
}

function hasOutcome(bullet: string): boolean {
  const text = lower(bullet);
  if (OUTCOME_MARKERS.some((m) => text.includes(m))) return true;
  if (OUTCOME_NOUNS.some((n) => text.includes(n))) return true;
  return false;
}

/** Technology-ish or otherwise concrete tokens, as a proxy for specificity. */
function specificTokenCount(bullet: string): number {
  const raw = String(bullet || "").split(/\s+/);
  let count = 0;
  for (const token of raw) {
    const clean = token.replace(/[^A-Za-z0-9+#./-]/g, "");
    if (clean.length < 2) continue;
    const hasInternalCaps = /[a-z][A-Z]/.test(clean);
    const isAcronym = /^[A-Z0-9]{2,6}$/.test(clean);
    const mixesDigits = /[A-Za-z]/.test(clean) && /\d/.test(clean);
    const hasSymbol = /[+#./]/.test(clean) && /[A-Za-z]/.test(clean);
    if (hasInternalCaps || isAcronym || mixesDigits || hasSymbol) count += 1;
  }
  return count;
}

/** First three words, used to detect a repeated sentence skeleton. */
function skeletonOf(bullet: string): string {
  return words(bullet).slice(0, 3).join(" ");
}

function clamp01(value: number): number {
  if (!isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

interface BulletRef {
  role: string;
  company: string;
  index: number;
  text: string;
}

function collectBullets(resume: any): BulletRef[] {
  const out: BulletRef[] = [];
  const experience = Array.isArray(resume?.experience) ? resume.experience : [];
  for (const role of experience) {
    const bullets = Array.isArray(role?.bullets) ? role.bullets : [];
    bullets.forEach((bullet: any, index: number) => {
      if (typeof bullet === "string" && bullet.trim().length > 0) {
        out.push({
          role: String(role?.role || "Role"),
          company: String(role?.company || ""),
          index,
          text: bullet.trim(),
        });
      }
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * STAR linkage (Phase 3 enforcement)
 * ------------------------------------------------------------------ */

function normalizeForMatch(text: string): string {
  return lower(text).replace(/[^a-z0-9 ]/g, "");
}

/**
 * Minimum length before a non-exact STAR bullet match is trusted. Short stubs
 * prefix-match unrelated bullets, and a mis-link is worse than a dropped story:
 * it hands the candidate an interview answer for work the bullet never claimed.
 */
const MIN_FALLBACK_KEY_LENGTH = 25;

/**
 * Ties each STAR story back to the bullet it expands and discards the ones that
 * do not correspond to any emitted bullet.
 *
 * The prompt requires star_stories[].bullet to be copied verbatim from a bullet
 * in experience. A story that matches nothing is describing work the document
 * does not actually claim, which is exactly the fabrication the pipeline exists
 * to prevent - and it would be handed to the candidate as interview prep.
 */
export function linkStarStories(resume: any): { kept: number; dropped: number } {
  const stories = Array.isArray(resume?.star_stories) ? resume.star_stories : null;
  if (!stories) return { kept: 0, dropped: 0 };

  const bullets = collectBullets(resume);
  const byText = new Map<string, BulletRef>();
  for (const bullet of bullets) byText.set(normalizeForMatch(bullet.text), bullet);

  const kept: any[] = [];
  // One bullet can back at most one story. Without this, two stories that both
  // resolve to the same bullet would both survive, inflating the grounding
  // score and rendering two interview cards for a single bullet.
  const claimed = new Set<BulletRef>();
  let dropped = 0;

  for (const story of stories) {
    if (!story || typeof story !== "object") {
      dropped += 1;
      continue;
    }
    const key = normalizeForMatch(String(story.bullet || ""));
    if (!key) {
      dropped += 1;
      continue;
    }

    let match = byText.get(key);

    if (match && claimed.has(match)) {
      dropped += 1;
      continue;
    }

    if (!match && key.length >= MIN_FALLBACK_KEY_LENGTH) {
      // Tolerate trailing punctuation or truncation, but only on a key long
      // enough to identify one bullet. A short stub like "led migration" would
      // otherwise prefix-match whichever bullet happens to come first.
      const candidates = bullets.filter((b) => {
        if (claimed.has(b)) return false;
        const candidate = normalizeForMatch(b.text);
        return candidate.startsWith(key) || key.startsWith(candidate);
      });

      if (candidates.length > 0) {
        const distance = (b: BulletRef) =>
          Math.abs(normalizeForMatch(b.text).length - key.length);
        candidates.sort((a, b) => distance(a) - distance(b));
        // An exact tie means the key cannot identify one bullet; never guess.
        const ambiguous =
          candidates.length > 1 && distance(candidates[0]) === distance(candidates[1]);
        if (!ambiguous) match = candidates[0];
      }
    }

    if (!match) {
      dropped += 1;
      continue;
    }

    claimed.add(match);
    kept.push({
      ...story,
      bullet: match.text,
      role: story.role || match.role,
      company: story.company || match.company,
    });
  }

  resume.star_stories = kept;
  return { kept: kept.length, dropped };
}

/* ------------------------------------------------------------------ *
 * Impact scoring
 * ------------------------------------------------------------------ */

/**
 * Scores bullet quality against the conventions a top-tier engineering screen
 * applies. Returns null when there are too few bullets to say anything honest.
 */
export function computeImpactScore(resume: any): ImpactScoreResult | null {
  const bullets = collectBullets(resume);
  if (bullets.length < 3) return null;

  const findings: ImpactFinding[] = [];
  const addFinding = (
    id: string,
    severity: ImpactFinding["severity"],
    bullet: BulletRef,
    issue: string,
    fix: string
  ) => {
    findings.push({ id, severity, role: bullet.role, bullet: bullet.text, issue, fix });
  };

  let strongLeads = 0;
  let outcomeBullets = 0;
  let quantifiedBullets = 0;
  let passiveBullets = 0;
  let vagueBullets = 0;
  let specificBullets = 0;
  let consecutiveQuantified = 0;
  let maxConsecutiveQuantified = 0;
  let roundNumberBullets = 0;

  const skeletons = new Map<string, number>();
  const leadVerbs = new Map<string, number>();
  const lengths: number[] = [];

  for (const bullet of bullets) {
    const text = bullet.text;
    const lengthInWords = words(text).length;
    lengths.push(lengthInWords);

    // --- verb strength ---
    const lead = leadVerb(text);
    leadVerbs.set(lead, (leadVerbs.get(lead) || 0) + 1);
    if (BANNED_VERBS.has(lead)) {
      addFinding(
        "banned_verb",
        "medium",
        bullet,
        `Opens with "${lead}", a filler verb recruiters read as AI-generated.`,
        "Replace with the concrete action actually taken (Built, Migrated, Reduced, Automated)."
      );
    } else if (isStrongVerb(lead)) {
      strongLeads += 1;
    } else {
      addFinding(
        "weak_lead",
        "medium",
        bullet,
        `Does not open with an action verb (starts with "${lead || "?"}").`,
        "Start the bullet with a past-tense action verb so ownership is unambiguous."
      );
    }

    // --- ownership ---
    const passiveHit = PASSIVE_PATTERNS.find((p) => p.pattern.test(lower(text)));
    if (passiveHit) {
      passiveBullets += 1;
      addFinding(
        "passive_ownership",
        "high",
        bullet,
        `Uses "${passiveHit.phrase}", which hands the work to someone else.`,
        "State what you personally decided and executed, not what you were near."
      );
    }

    // --- specificity ---
    const vagueHit = VAGUE_PATTERNS.find((p) => p.pattern.test(lower(text)));
    if (vagueHit) {
      vagueBullets += 1;
      addFinding(
        "vague_filler",
        "low",
        bullet,
        `Contains "${vagueHit.phrase}", which narrows nothing.`,
        "Name the actual system, count, or technology instead."
      );
    }
    if (specificTokenCount(text) > 0) specificBullets += 1;

    // --- outcome ---
    const quantified = hasQuantifier(text);
    if (quantified) {
      quantifiedBullets += 1;
      consecutiveQuantified += 1;
      maxConsecutiveQuantified = Math.max(maxConsecutiveQuantified, consecutiveQuantified);
      if (ROUND_NUMBER_PATTERN.test(lower(text))) {
        roundNumberBullets += 1;
        addFinding(
          "round_number",
          "medium",
          bullet,
          "Carries a suspiciously round figure; real measurements are uneven.",
          "Use the exact source figure, or drop the number and close on the concrete change."
        );
      }
    } else {
      consecutiveQuantified = 0;
    }

    if (quantified || hasOutcome(text)) {
      outcomeBullets += 1;
    } else {
      addFinding(
        "no_outcome",
        "high",
        bullet,
        "Describes an activity but never says what changed as a result.",
        "Close on the consequence: the failure mode removed, the step eliminated, the system retired."
      );
    }

    if (lengthInWords > 34) {
      addFinding(
        "overlong",
        "low",
        bullet,
        `Runs to ${lengthInWords} words and will wrap past two lines.`,
        "Cut to the decision and its effect; move supporting detail to the interview."
      );
    }
  }

  const total = bullets.length;

  // --- cadence variation (anti-AI-tell) ---
  for (const bullet of bullets) {
    const key = skeletonOf(bullet.text);
    skeletons.set(key, (skeletons.get(key) || 0) + 1);
  }
  const repeatedSkeletons = Array.from(skeletons.values()).filter((n) => n > 1).reduce(
    (sum, n) => sum + (n - 1),
    0
  );
  const repeatedVerbs = Array.from(leadVerbs.values()).filter((n) => n > 1).reduce(
    (sum, n) => sum + (n - 1),
    0
  );
  const meanLength = lengths.reduce((a, b) => a + b, 0) / total;
  const variance =
    lengths.reduce((sum, n) => sum + (n - meanLength) * (n - meanLength), 0) / total;
  // The prompt asks for a deliberate mix of 8-12 and 18-25 word bullets, which
  // lands around a 5-word spread. Uniform length is itself a tell of generated text.
  const lengthSpread = clamp01(Math.sqrt(variance) / 5);
  const repeats = repeatedSkeletons + repeatedVerbs;
  const cadenceScore = clamp01(0.5 * (1 - repeats / total) + 0.5 * lengthSpread);
  const cadenceDetail =
    repeats === 0
      ? `no repeated skeletons or lead verbs; bullet length spread ${pct(lengthSpread)} of target`
      : `${repeatedSkeletons} repeated skeletons, ${repeatedVerbs} repeated lead verbs`;

  if (repeatedSkeletons > 0) {
    const worst = Array.from(skeletons.entries()).sort((a, b) => b[1] - a[1])[0];
    if (worst && worst[1] > 1) {
      findings.push({
        id: "repeated_skeleton",
        severity: "medium",
        role: "Document",
        bullet: worst[0],
        issue: `${worst[1]} bullets open with the same three words ("${worst[0]}").`,
        fix: "Rotate bullet shapes: outcome-led, scope-led, decision-led, problem-led.",
      });
    }
  }

  // --- quantification balance ---
  const quantifiedRatio = quantifiedBullets / total;
  let quantScore: number;
  let quantDetail: string;
  if (quantifiedRatio < QUANT_IDEAL_LOW) {
    quantScore = clamp01(quantifiedRatio / QUANT_IDEAL_LOW);
    quantDetail = `${pct(quantifiedRatio)} of bullets carry a measurement; aim for ${pct(QUANT_IDEAL_LOW)}-${pct(QUANT_IDEAL_HIGH)}`;
  } else if (quantifiedRatio <= QUANT_IDEAL_HIGH) {
    quantScore = 1;
    quantDetail = `${pct(quantifiedRatio)} of bullets carry a measurement - in the credible band`;
  } else {
    // Over-quantification reads as fabricated and discredits the whole document.
    quantScore = clamp01(1 - (quantifiedRatio - QUANT_IDEAL_HIGH) / 0.4);
    quantDetail = `${pct(quantifiedRatio)} of bullets carry a number - dense enough to read as invented`;
    findings.push({
      id: "metric_density",
      severity: "high",
      role: "Document",
      bullet: "",
      issue: `${quantifiedBullets} of ${total} bullets contain a figure.`,
      fix: "Keep the figures the source actually supports and close the rest on concrete change.",
    });
  }
  if (maxConsecutiveQuantified > 2) {
    findings.push({
      id: "metric_run",
      severity: "medium",
      role: "Document",
      bullet: "",
      issue: `${maxConsecutiveQuantified} consecutive bullets each carry a number.`,
      fix: "Break the run so no more than two quantified bullets sit together.",
    });
  }

  // Round-number theatre discredits the figures that ARE real, so it costs
  // score rather than only raising a warning.
  if (quantifiedBullets > 0 && roundNumberBullets > 0) {
    quantScore = clamp01(quantScore * (1 - 0.5 * (roundNumberBullets / quantifiedBullets)));
    quantDetail += `; ${roundNumberBullets} of ${quantifiedBullets} figures are suspiciously round`;
  }

  // --- STAR grounding ---
  const starLink = linkStarStories(resume);
  const starTarget = Math.min(4, Math.max(2, Math.round(total / 4)));
  const starScore = clamp01(starLink.kept / starTarget);
  if (starLink.dropped > 0) {
    findings.push({
      id: "star_unlinked",
      severity: "medium",
      role: "Document",
      bullet: "",
      issue: `${starLink.dropped} STAR ${starLink.dropped === 1 ? "story" : "stories"} did not match any bullet in the resume and were removed.`,
      fix: "Interview answers must expand a bullet the resume actually makes.",
    });
  }

  const components: ImpactComponent[] = [
    {
      id: "verb_strength",
      label: "Action-verb ownership",
      weight: 0.2,
      score: strongLeads / total,
      detail: `${strongLeads} of ${total} bullets open with a strong action verb`,
    },
    {
      id: "outcome_focus",
      label: "Impact stated, not duties",
      weight: 0.25,
      score: outcomeBullets / total,
      detail: `${outcomeBullets} of ${total} bullets say what changed as a result`,
    },
    {
      id: "quantification",
      label: "Measurement balance",
      weight: 0.15,
      score: quantScore,
      detail: quantDetail,
    },
    {
      id: "specificity",
      label: "Concrete systems named",
      weight: 0.15,
      score: clamp01(specificBullets / total - (vagueBullets / total) * 0.5),
      detail: `${specificBullets} of ${total} bullets name a concrete technology or system${
        vagueBullets > 0 ? `; ${vagueBullets} contain vague filler` : ""
      }`,
    },
    {
      id: "ownership",
      label: "No passive phrasing",
      weight: 0.1,
      score: clamp01(1 - passiveBullets / total),
      detail:
        passiveBullets === 0
          ? "no passive or borrowed-credit phrasing"
          : `${passiveBullets} of ${total} bullets surrender ownership`,
    },
    {
      id: "cadence",
      label: "Human cadence variation",
      weight: 0.1,
      score: cadenceScore,
      detail: cadenceDetail,
    },
    {
      id: "star_grounding",
      label: "Interview-ready STAR depth",
      weight: 0.05,
      score: starScore,
      detail: `${starLink.kept} STAR ${starLink.kept === 1 ? "story" : "stories"} linked to real bullets (target ${starTarget})`,
    },
  ];

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const raw = components.reduce((sum, c) => sum + c.weight * clamp01(c.score), 0) / totalWeight;

  const severityRank = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return {
    method: "deterministic-impact-audit-v1",
    score: Math.max(5, Math.min(99, Math.round(raw * 100))),
    bullets_evaluated: total,
    quantified_ratio: Math.round(quantifiedRatio * 100) / 100,
    components: components.map((c) => ({ ...c, score: clamp01(c.score) })),
    findings: findings.slice(0, 25),
    star_linked: starLink.kept,
    star_dropped: starLink.dropped,
  };
}

/**
 * Attaches the impact audit to a generated resume and prunes unlinked STAR
 * stories. Mutates and returns the resume.
 *
 * Never throws. Like applyMatchScores, this runs on an already-generated,
 * already-paid-for document: a defect here must degrade to "no impact audit",
 * never discard the resume or be mistaken for a malformed model response.
 */
export function applyImpactAudit(optimizedResume: any): any {
  if (!optimizedResume || typeof optimizedResume !== "object") return optimizedResume;

  try {
    const result = computeImpactScore(optimizedResume);
    if (result) {
      optimizedResume.impact_audit = result;
    } else {
      // Still enforce STAR linkage even when there is too little to score.
      linkStarStories(optimizedResume);
      delete optimizedResume.impact_audit;
    }
  } catch (e: any) {
    console.warn("[impactScore] Impact audit failed; returning document unaudited:", e?.message || e);
    delete optimizedResume.impact_audit;
  }

  return optimizedResume;
}
