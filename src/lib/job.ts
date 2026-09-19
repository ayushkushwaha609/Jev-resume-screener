// Client-side job and candidate shapes. The browser owns all of this state;
// the server only ever sees one request at a time.

import type { Trace } from "./jev";
import type { Candidate, Judgment, Kind, Requirement } from "./ranking";
import { keyHeaders } from "./userKey";

export interface DraftRequirement {
  key: string; // stable React key
  id?: string; // question id; changes when the question's meaning changes
  text: string;
  kind: Kind;
  weight: number;
  hint?: string;
}

export interface JobState {
  title: string;
  description: string;
  requirements: DraftRequirement[]; // id is always set
  relevanceWeight: number;
}

export interface AppCandidate extends Candidate {
  trace: Trace | null;
  baseline: Judgment[]; // the same questions answered by keyword matching
  sampleNote?: string;
}

export const MAX_PER_DROP = 10;
export const MAX_CANDIDATES = 30;
export const MAX_REQUIREMENTS = 15;

let counter = 0;
export const draftKey = () => `d${Date.now().toString(36)}${(counter++).toString(36)}`;

export function toRequirements(job: JobState): Requirement[] {
  return job.requirements.map((r, position) => ({ id: r.id!, text: r.text, kind: r.kind, weight: r.weight, position }));
}

// A requirement whose wording or type changes asks Jev a different question,
// so it gets a new id and old answers stop counting (candidates show Outdated).
export function withIds(prev: DraftRequirement[], next: DraftRequirement[]): DraftRequirement[] {
  const before = new Map(prev.map((r) => [r.key, r]));
  return next.map((r) => {
    const old = before.get(r.key);
    const same = old && old.id && old.text === r.text && old.kind === r.kind;
    return { ...r, id: same ? old.id : draftKey() };
  });
}

export interface Suggestion {
  text: string;
  kind: Kind;
  weight: number;
  confidence: number;
  source?: string; // the JD phrase it came from (generative extraction only)
}

export type SuggestMode = "groq" | "jev" | "demo";

export function describeExtraction(mode: SuggestMode, count: number, fallback?: string, unquoted = 0): string {
  if (count === 0) return fallback ?? "No new requirements found. Add them by hand.";
  const n = `${count} requirement${count === 1 ? "" : "s"}`;
  const lead =
    mode === "groq"
      ? `gpt-oss-120b rewrote the description into ${n}, each tied to a quote from it.`
      : mode === "jev"
        ? `Jev sorted each line of the description and found ${n}.`
        : `The keyword heuristic found ${n}.`;
  const dropped = unquoted
    ? ` ${unquoted} more ${unquoted === 1 ? "was" : "were"} dropped because ${unquoted === 1 ? "its quote wasn't" : "their quotes weren't"} found in the description.`
    : "";
  return `${fallback ? fallback + " " : ""}${lead}${dropped} Check the types and weights.`;
}

export async function fetchSuggestions(title: string, description: string) {
  const res = await fetch("/api/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...keyHeaders() },
    body: JSON.stringify({ title, description }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not read the job description");
  return data as { suggestions: Suggestion[]; mode: SuggestMode; fallback?: string; unquoted?: number };
}

export function suggestionsToDrafts(suggestions: Suggestion[], existing: DraftRequirement[]): DraftRequirement[] {
  return suggestions
    .filter((s) => !existing.some((r) => r.text.trim().toLowerCase() === s.text.toLowerCase()))
    .slice(0, Math.max(0, MAX_REQUIREMENTS - existing.length))
    .map((s) => ({
      key: draftKey(),
      text: s.text,
      kind: s.kind,
      weight: s.weight,
      hint: s.source ? `From the JD: “${s.source}”` : s.confidence < 0.6 ? "Low confidence: check the type" : undefined,
    }));
}
