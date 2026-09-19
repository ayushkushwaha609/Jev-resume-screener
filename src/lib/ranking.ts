// Client-safe types and the ranking policy. Everything here is plain code:
// Jev supplies judgments once, and this file turns them into fit scores,
// must-have states and review flags whenever weights change.

export type Kind = "must" | "skill" | "pref";
export type Stage = "new" | "shortlisted" | "maybe" | "rejected";
export type Status = "pending" | "scored" | "error" | "invalid";

export interface Requirement {
  id: string;
  text: string;
  kind: Kind;
  weight: number; // 0–5
  position: number;
}

export interface Judgment {
  key: string;
  type: "noul" | "score" | "choice";
  value: number; // noul: probability 0–1; score: 0–4
  confidence: number | null;
  probabilities: Record<string, number> | null;
}

export interface Candidate {
  id: string;
  fileName: string;
  displayName: string;
  redactedText: string;
  status: Status;
  error: string | null;
  mode: "jev" | "demo" | null;
  stage: Stage;
  createdAt: number;
  judgments: Judgment[];
}

export const RELEVANCE_KEY = "relevance";
export const IS_RESUME_KEY = "is_resume";
export const SCORE_MAX = 4;

// Starting thresholds; tune them on a labeled benchmark set.
export const MUST_MET = 0.7;
export const MUST_MISSING = 0.3;
export const LOW_CONFIDENCE = 0.45;

export const SKILL_LEVELS = [
  "Not mentioned anywhere in the resume",
  "Listed as a keyword or in a skills section, with no described use",
  "Used in at least one job or project, with some specifics about what was built",
  "A primary tool across multiple roles or projects, with concrete outcomes",
  "Led design, architecture, scaling or performance work with it, or taught others",
];

export const RELEVANCE_LEVELS = [
  "Unrelated field; no transferable experience for this role",
  "Adjacent field with a few transferable skills",
  "Related role, but a different domain or noticeably lower seniority",
  "Same kind of role at a similar level",
  "Same role, same domain, and a track record at this level or above",
];

export type MustState = "met" | "unclear" | "missing" | "pending";

export interface RequirementResult {
  requirement: Requirement;
  judgment: Judgment | null;
  normalized: number | null; // 0–1
  mustState: MustState | null; // only for must-haves
  lowConfidence: boolean;
}

export interface Ranked {
  candidate: Candidate;
  fit: number | null; // 0–100
  results: RequirementResult[];
  relevance: Judgment | null;
  mustMet: number;
  mustTotal: number;
  mustMissing: number;
  mustUnclear: number;
  needsReview: boolean;
  reviewReasons: string[];
  stale: boolean; // scored before some requirement existed
}

export function mustStateOf(p: number): MustState {
  if (p >= MUST_MET) return "met";
  if (p < MUST_MISSING) return "missing";
  return "unclear";
}

function normalize(j: Judgment): number {
  return j.type === "score" ? j.value / SCORE_MAX : j.value;
}

export function rankCandidate(
  candidate: Candidate,
  reqs: Requirement[],
  relevanceWeight: number,
): Ranked {
  const byKey = new Map(candidate.judgments.map((j) => [j.key, j]));
  const scored = candidate.status === "scored";
  const reasons: string[] = [];
  let num = 0;
  let den = 0;
  let stale = false;

  const results: RequirementResult[] = reqs.map((r) => {
    const j = byKey.get(r.id) ?? null;
    if (scored && !j) stale = true;
    const normalized = j ? normalize(j) : null;
    const lowConfidence = !!j && j.type === "score" && (j.confidence ?? 1) < LOW_CONFIDENCE;
    const mustState: MustState | null =
      r.kind === "must" ? (j ? mustStateOf(j.value) : "pending") : null;
    if (normalized !== null && r.weight > 0) {
      num += r.weight * normalized;
      den += r.weight;
    }
    if (mustState === "unclear") reasons.push(`Unclear must-have: ${r.text}`);
    if (lowConfidence) reasons.push(`Uncertain depth: ${r.text}`);
    return { requirement: r, judgment: j, normalized, mustState, lowConfidence };
  });

  const relevance = byKey.get(RELEVANCE_KEY) ?? null;
  if (relevance && relevanceWeight > 0) {
    num += relevanceWeight * normalize(relevance);
    den += relevanceWeight;
  }
  if (relevance && (relevance.confidence ?? 1) < LOW_CONFIDENCE) {
    reasons.push("Uncertain overall relevance");
  }

  const musts = results.filter((r) => r.mustState !== null);
  const isResume = byKey.get(IS_RESUME_KEY);
  if (candidate.status === "invalid" || (isResume && isResume.value < 0.5)) {
    reasons.push("May not be a resume");
  }

  return {
    candidate,
    fit: scored && den > 0 ? Math.round((100 * num) / den) : null,
    results,
    relevance,
    mustMet: musts.filter((r) => r.mustState === "met").length,
    mustTotal: musts.length,
    mustMissing: musts.filter((r) => r.mustState === "missing").length,
    mustUnclear: musts.filter((r) => r.mustState === "unclear").length,
    needsReview: reasons.length > 0,
    reviewReasons: reasons,
    stale,
  };
}

// Missing must-haves lower the rank; they never remove anyone.
export function rankAll(candidates: Candidate[], reqs: Requirement[], relevanceWeight: number) {
  return candidates
    .map((c) => rankCandidate(c, reqs, relevanceWeight))
    .sort((a, b) => {
      if ((a.fit === null) !== (b.fit === null)) return a.fit === null ? 1 : -1;
      if (a.mustMissing !== b.mustMissing) return a.mustMissing - b.mustMissing;
      return (b.fit ?? 0) - (a.fit ?? 0) || a.candidate.createdAt - b.candidate.createdAt;
    });
}
