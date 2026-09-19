import type { Kind, Requirement } from "./ranking";

const KINDS: Kind[] = ["must", "skill", "pref"];
export const MAX_REQUIREMENTS = 15;

export interface JobInput {
  title: string;
  description: string;
  requirements: Requirement[];
}

// The browser owns the job; every request carries it. Nothing is stored.
export function parseJob(input: unknown): JobInput | null {
  const o = input as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  const title = typeof o.title === "string" ? o.title.trim().slice(0, 120) : "";
  const description = typeof o.description === "string" ? o.description.slice(0, 4_000) : "";
  if (!Array.isArray(o.requirements) || o.requirements.length === 0) return null;
  if (o.requirements.length > MAX_REQUIREMENTS) return null;
  const requirements: Requirement[] = [];
  for (const [position, r] of (o.requirements as Record<string, unknown>[]).entries()) {
    const text = typeof r?.text === "string" ? r.text.trim().slice(0, 300) : "";
    const id = typeof r?.id === "string" && /^[\w-]{1,40}$/.test(r.id) ? r.id : null;
    if (!text || !id || !KINDS.includes(r.kind as Kind)) return null;
    requirements.push({ id, text, kind: r.kind as Kind, weight: 3, position });
  }
  return { title: title || "Untitled role", description, requirements };
}
