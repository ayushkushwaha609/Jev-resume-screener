// Job description → requirements with an open-weight generative model
// (gpt-oss-120b on Groq's free plan). Runs once per job, at setup; screening
// every resume stays on Jev.
//
// Rewriting a JD into distinct, checkable requirements is a generation task,
// which Jev doesn't do. To keep the result traceable, the model must quote the
// JD phrase behind each requirement, and code drops any requirement whose
// quote isn't actually in the JD.
//
// Boundary: this model only proposes requirement wording and type. It never
// sets weights, never sees a resume, and nothing it returns reaches Jev
// except the requirement text and type the recruiter keeps. An ESLint rule
// allows importing this file only from the suggest route.

import type { Kind } from "./ranking";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-120b";
const MAX_REQUIREMENTS = 15;
const MAX_JD_CHARS = 12_000;

export const hasGroqKey = () => !!process.env.GROQ_API_KEY;

export class GroqUnavailableError extends Error {}

export interface ExtractedRequirement {
  text: string;
  kind: Kind;
  weight: number;
  source: string; // the JD phrase it came from, verified to exist in the JD
}

// Same defaults as Jev's line-by-line extraction, so the extractor never
// shapes the ranking. The recruiter changes weights, not the model.
const DEFAULT_WEIGHT: Record<Kind, number> = { must: 3, skill: 4, pref: 1 };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["requirements"],
  properties: {
    requirements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "kind", "source_quote"],
        properties: {
          text: { type: "string" },
          kind: { type: "string", enum: ["must", "skill", "pref"] },
          source_quote: { type: "string" },
        },
      },
    },
  },
};

const INSTRUCTIONS = `You turn a job description into the requirements a recruiter would check on a resume.

Rules:
- One entry per distinct requirement. Merge duplicates and near-duplicates ("React experience" and "deep React knowledge" are one requirement).
- Each technology or skill appears in exactly one requirement. Fold sub-skills and closely related items into their parent: "React hooks and state management" belongs inside the React requirement; "PostgreSQL" and "solid SQL" are one database requirement.
- Years of experience is its own requirement and names no tools: "4+ years with React and TypeScript" becomes "4+ years building web applications" plus a React skill and a TypeScript skill.
- Keep alternatives together ("Go, Python or Java" is one requirement).
- Merging never loses anything: the merged entry names every item it covers ("PostgreSQL and solid SQL").
- Before answering, check your list twice: if two entries would be satisfied by the same resume evidence, merge them; and every required technology, credential or amount of experience in the JD must appear in some entry.
- Only include things a resume could show evidence of. Skip duties of the job, company description, benefits, salary, process, and vague traits like "team player" or "passion".
- Write each requirement as a short, specific phrase in plain English, 3 to 12 words. Keep numbers and named tools from the JD.
- kind: "skill" for a required named technology, language or discipline, even when the JD calls it essential or a must; "must" for required things that are not a named technology, such as years of experience, degrees, credentials or a kind of work done; "pref" for anything described as preferred, a plus, bonus or nice to have.
- source_quote: copy the exact words from the job description this requirement comes from, 3 to 15 words, verbatim. Do not paraphrase the quote.
- At most ${MAX_REQUIREMENTS} requirements.`;

// Case-, whitespace- and punctuation-insensitive form, used to check that a
// quote really appears in the JD.
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/[^a-z0-9+#.%'"\-]+/g, " ")
    .trim();

export async function extractWithGroq(
  title: string,
  description: string,
): Promise<{ requirements: ExtractedRequirement[]; unquoted: number }> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new GroqUnavailableError("No Groq key configured");
  const jd = description.slice(0, MAX_JD_CHARS);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        reasoning_effort: "low",
        messages: [
          { role: "system", content: INSTRUCTIONS },
          { role: "user", content: `Role title: ${title || "(not given)"}\n\nJob description:\n${jd}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "requirements", strict: true, schema: SCHEMA },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new GroqUnavailableError("Groq did not respond");
  }
  // Rate limits, outages and bad keys all mean: fall back to Jev.
  if (!res.ok) throw new GroqUnavailableError(`Groq returned ${res.status}`);

  let parsed: { requirements: { text: string; kind: Kind; source_quote: string }[] };
  try {
    const data = await res.json();
    parsed = JSON.parse(data.choices[0].message.content);
  } catch {
    throw new GroqUnavailableError("Groq returned an unreadable answer");
  }

  const haystack = normalize(jd);
  const seen = new Set<string>();
  const out: ExtractedRequirement[] = [];
  let unquoted = 0;
  for (const r of parsed.requirements ?? []) {
    const text = r.text.replace(/[‐‑‒]/g, "-").trim().replace(/\.$/, "");
    const quote = normalize(r.source_quote);
    if (!text || quote.length < 4) continue;
    // Drop anything the model can't point to in the JD.
    if (!haystack.includes(quote)) {
      unquoted++;
      continue;
    }
    const dedupe = normalize(text);
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({
      text,
      kind: r.kind,
      weight: DEFAULT_WEIGHT[r.kind] ?? 3,
      source: r.source_quote.replace(/[‐‑‒]/g, "-").trim(),
    });
    if (out.length >= MAX_REQUIREMENTS) break;
  }
  return { requirements: out, unquoted };
}
