// Server-only TypeSafe client and the three Jev workflows Sift uses:
// screening a resume, suggesting requirements from a job description,
// and finding the resume lines that support one requirement.
//
// Without TYPESAFE_API_KEY each workflow falls back to a keyword heuristic
// so the UI can be developed. The same heuristic doubles as the keyword
// baseline that Jev's ranking is compared against.

import {
  IS_RESUME_KEY,
  RELEVANCE_KEY,
  RELEVANCE_LEVELS,
  SKILL_LEVELS,
  SCORE_MAX,
  type Judgment,
  type Kind,
  type Requirement,
} from "./ranking";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const MODEL = "jev-latest";
const MAX_RESUME_CHARS = 12_000;
const BATCH_SIZE = 20;

export const isDemoMode = () => !process.env.TYPESAFE_API_KEY;

export type Question =
  | { type: "noul"; instructions: string; criteria?: { true: string; false: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] };

export type Answer =
  | { type: "noul"; noul: number }
  | { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: "score"; score: number; probabilities: Record<string, number>; confidence: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Usage {
  input_tokens: number;
  output_tokens: number;
}

async function ask(
  state: unknown,
  questions: Record<string, Question>,
): Promise<{ answers: Record<string, Answer>; usage: Usage }> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, state, questions }),
    });
    if (res.ok) {
      const data = await res.json();
      return { answers: data.answers, usage: data.usage ?? { input_tokens: 0, output_tokens: 0 } };
    }
    if ((res.status === 429 || res.status === 529) && attempt < 3) {
      await sleep(600 * 2 ** attempt + Math.random() * 300);
      continue;
    }
    // Never echo the request (it contains resume text) into logs or errors.
    throw new Error(`TypeSafe request failed with status ${res.status}`);
  }
}

// Independent questions over the same state, split into parallel requests.
async function askBatched(state: unknown, questions: Record<string, Question>) {
  const entries = Object.entries(questions);
  const chunks: [string, Question][][] = [];
  for (let i = 0; i < entries.length; i += BATCH_SIZE) chunks.push(entries.slice(i, i + BATCH_SIZE));
  const parts = await Promise.all(chunks.map((c) => ask(state, Object.fromEntries(c))));
  return {
    answers: Object.assign({}, ...parts.map((p) => p.answers)) as Record<string, Answer>,
    usage: parts.reduce(
      (u, p) => ({
        input_tokens: u.input_tokens + (p.usage.input_tokens ?? 0),
        output_tokens: u.output_tokens + (p.usage.output_tokens ?? 0),
      }),
      { input_tokens: 0, output_tokens: 0 },
    ),
    requests: chunks.length,
  };
}

function toJudgment(key: string, a: Answer): Judgment {
  if (a.type === "noul") return { key, type: "noul", value: a.noul, confidence: null, probabilities: null };
  if (a.type === "score")
    return { key, type: "score", value: a.score, confidence: a.confidence, probabilities: a.probabilities };
  throw new Error(`Unexpected ${a.type} answer for ${key}`);
}

// ---------------------------------------------------------------- screening

interface JobContext {
  title: string;
  description: string;
}

function requirementQuestion(r: Requirement): Question {
  if (r.kind === "skill")
    return {
      type: "score",
      instructions: `How deep is the candidate's experience with "${r.text}", judged only from \`resume\`?`,
      criteria: SKILL_LEVELS,
    };
  if (r.kind === "must")
    return {
      type: "noul",
      instructions: `Does \`resume\` show that the candidate meets this requirement for the role in \`job\`: "${r.text}"?`,
      criteria: {
        true: "The resume describes experience, work or credentials that satisfy it, not just a matching keyword",
        false: "It is not mentioned, only appears as an unexplained keyword, or the resume contradicts it",
      },
    };
  return {
    type: "noul",
    instructions: `Does \`resume\` show that the candidate satisfies this preference for the role in \`job\`: "${r.text}"?`,
  };
}

// Everything the "under the hood" panel shows for one screening call.
export interface Trace {
  model: string;
  state: { job: unknown; resume: string };
  questions: Record<string, Question>;
  answers: Record<string, Answer>;
  usage: Usage | null;
  requests: number;
  ms: number;
}

export async function screenResume(
  job: JobContext,
  reqs: Requirement[],
  resumeText: string,
): Promise<{ judgments: Judgment[]; baseline: Judgment[]; mode: "jev" | "demo"; trace: Trace }> {
  const resume = resumeText.slice(0, MAX_RESUME_CHARS);
  // The same questions answered by keyword matching, so the UI can show
  // where a keyword filter and Jev disagree.
  const baseline = keywordBaseline(reqs, resume);
  const state = {
    job: {
      title: job.title,
      description: job.description.slice(0, 2_000),
      requirements: reqs.map((r) => r.text),
    },
    resume,
  };
  const questions: Record<string, Question> = {
    [IS_RESUME_KEY]: {
      type: "noul",
      instructions: "Is `resume` a person's resume or CV describing their work history, education or skills?",
    },
    [RELEVANCE_KEY]: {
      type: "score",
      instructions: "How relevant is the candidate's overall experience in `resume` to the role described in `job`?",
      criteria: RELEVANCE_LEVELS,
    },
  };
  for (const r of reqs) questions[r.id] = requirementQuestion(r);

  const started = Date.now();
  if (isDemoMode()) {
    const judgments = baseline;
    const answers = Object.fromEntries(
      judgments.map((j) => [
        j.key,
        j.type === "score"
          ? { type: "score", score: j.value, probabilities: {}, confidence: j.confidence ?? 0 }
          : { type: "noul", noul: j.value },
      ]),
    ) as Record<string, Answer>;
    return {
      judgments,
      baseline,
      mode: "demo",
      trace: { model: "demo-heuristic", state, questions, answers, usage: null, requests: 0, ms: Date.now() - started },
    };
  }

  const { answers, usage, requests } = await askBatched(state, questions);
  return {
    judgments: Object.keys(questions).map((k) => toJudgment(k, answers[k])),
    baseline,
    mode: "jev",
    trace: { model: MODEL, state, questions, answers, usage, requests, ms: Date.now() - started },
  };
}

// ------------------------------------------------------- JD → requirements

export interface Suggestion {
  text: string;
  kind: Kind;
  weight: number;
  label: "must_have" | "nice_to_have" | "not_requirement";
  confidence: number;
}

// Common JD section headings are a fixed list, so code drops them rather
// than asking Jev (which rated "Nice to have" a requirement at 0.53).
const SECTION_HEADING =
  /^(nice[ -]to[ -]haves?|bonus( points)?|preferred( qualifications)?|(minimum |basic )?(requirements|qualifications)|what (we're|we are) looking for|what you('ll| will) (do|bring)|responsibilities|about (us|you|the role|the team)|the role|benefits|perks|what we offer|how we work)\s*:?$/i;

export function splitJdLines(description: string): string[] {
  return description
    .split(/\r?\n|(?<=\.)\s+(?=[A-Z])/)
    // Strip bullets and list numbers ("1." / "2)"), but keep "5+ years".
    .map((l) => l.replace(/^\s*(?:[•*\-–—·●▪◦]+|\d{1,2}[.)](?!\d))\s*/, "").trim())
    .filter((l) => l.length >= 6 && l.length <= 300 && !SECTION_HEADING.test(l))
    .slice(0, 60);
}

export async function suggestRequirements(
  title: string,
  description: string,
): Promise<{ suggestions: Suggestion[]; mode: "jev" | "demo" }> {
  const lines = splitJdLines(description);
  if (lines.length === 0) return { suggestions: [], mode: isDemoMode() ? "demo" : "jev" };
  if (isDemoMode()) return { suggestions: lines.map(demoSuggest).filter(Boolean) as Suggestion[], mode: "demo" };

  const questions: Record<string, Question> = {};
  lines.forEach((_, i) => {
    questions[`role_${i}`] = {
      type: "choice",
      instructions: `\`lines\` come from a job posting for the role \`title\`. What does \`lines.l${i}\` say about the candidate?`,
      criteria: {
        must_have: "A qualification, skill, credential or experience the candidate is required to have",
        nice_to_have: "A qualification described as preferred, a plus, a bonus or nice to have",
        not_requirement:
          "Not a candidate qualification: duties of the job, company description, benefits, process or a heading",
      },
    };
    questions[`skill_${i}`] = {
      type: "noul",
      instructions: `Does \`lines.l${i}\` name a specific tool, technology, language or discipline where a candidate's depth of experience can vary a lot?`,
    };
  });
  const { answers: a } = await askBatched(
    { title, lines: Object.fromEntries(lines.map((l, i) => [`l${i}`, l])) },
    questions,
  );

  const suggestions: Suggestion[] = [];
  lines.forEach((text, i) => {
    const role = a[`role_${i}`];
    const skill = a[`skill_${i}`];
    if (role.type !== "choice" || skill.type !== "noul") return;
    if (role.choice === "not_requirement") return;
    const must = role.choice === "must_have";
    // Only required skills get depth scoring; preferences stay yes/no.
    const isSkill = must && skill.noul >= 0.6;
    suggestions.push({
      text,
      kind: isSkill ? "skill" : must ? "must" : "pref",
      weight: must ? (isSkill ? 4 : 3) : 1,
      label: role.choice as Suggestion["label"],
      confidence: role.confidence,
    });
  });
  return { suggestions, mode: "jev" };
}

// ------------------------------------------------------------- evidence

export interface EvidenceLine {
  index: number;
  text: string;
  p: number;
}

export function resumeLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 12)
    .slice(0, 80);
}

export async function findEvidence(
  requirement: Requirement,
  resumeText: string,
): Promise<{ lines: EvidenceLine[]; mode: "jev" | "demo" }> {
  const lines = resumeLines(resumeText);
  if (isDemoMode()) {
    const terms = keyTerms(requirement.text);
    return {
      lines: lines.map((text, index) => ({ index, text, p: overlap(terms, text.toLowerCase()) > 0 ? 0.8 : 0.05 })),
      mode: "demo",
    };
  }
  const questions: Record<string, Question> = {};
  // Lines are keyed by name, not array index: in testing, Jev resolved
  // `lines.l4` reliably but judged `lines[4]` against the whole resume.
  lines.forEach((_, i) => {
    questions[`l_${i}`] = {
      type: "noul",
      instructions: `Does \`lines.l${i}\` describe hands-on work that shows the candidate meets \`requirement\`?`,
      criteria: {
        true: "The line describes experience, work or a credential that supports the requirement",
        false: "The line is unrelated to the requirement or only a heading",
      },
    };
  });
  const { answers: a } = await askBatched(
    { requirement: requirement.text, lines: Object.fromEntries(lines.map((l, i) => [`l${i}`, l])) },
    questions,
  );
  return {
    lines: lines.map((text, index) => {
      const ans = a[`l_${index}`];
      return { index, text, p: ans?.type === "noul" ? ans.noul : 0 };
    }),
    mode: "jev",
  };
}

// ------------------------------------------------------------- demo mode

const STOP = new Set(
  "and or the a an of in on for with to at by from as is are be have has years year experience strong good plus must nice using use working knowledge ability able any other etc including".split(
    " ",
  ),
);

function keyTerms(text: string): string[] {
  return [...new Set(text.toLowerCase().match(/[a-z0-9+#.]{2,}/g) ?? [])]
    .map((t) => t.replace(/\.$/, ""))
    .filter((t) => !STOP.has(t) && t.length > 1);
}

function overlap(terms: string[], haystack: string): number {
  if (terms.length === 0) return 0;
  return terms.filter((t) => haystack.includes(t)).length / terms.length;
}

export function keywordBaseline(reqs: Requirement[], resume: string): Judgment[] {
  const hay = resume.toLowerCase();
  const out: Judgment[] = [
    {
      key: IS_RESUME_KEY,
      type: "noul",
      value: /experience|education|skills|work|project/i.test(resume) && resume.length > 300 ? 0.95 : 0.2,
      confidence: null,
      probabilities: null,
    },
  ];
  let total = 0;
  for (const r of reqs) {
    const terms = keyTerms(r.text);
    const f = overlap(terms, hay);
    total += f;
    if (r.kind === "skill") {
      const hits = terms.reduce((n, t) => n + (hay.split(t).length - 1), 0);
      const level = Math.min(SCORE_MAX, f === 0 ? 0 : 1 + Math.min(3, Math.floor(hits / 2)));
      out.push({ key: r.id, type: "score", value: level, confidence: 0.4 + 0.5 * f, probabilities: null });
    } else {
      out.push({ key: r.id, type: "noul", value: 0.08 + 0.87 * f, confidence: null, probabilities: null });
    }
  }
  const rel = reqs.length ? (total / reqs.length) * SCORE_MAX : 2;
  out.push({ key: RELEVANCE_KEY, type: "score", value: rel, confidence: 0.6, probabilities: null });
  return out;
}

function demoSuggest(text: string): Suggestion | null {
  const t = text.toLowerCase();
  if (/(we offer|benefit|salary|about us|our team|you will|responsibilit|equal opportunity)/.test(t)) return null;
  const nice = /(nice to have|a plus|bonus|preferred|ideally)/.test(t);
  const must = /(require|must|years|degree|proficien|experience with|experience in|strong)/.test(t);
  if (!nice && !must) return null;
  const isSkill = /(python|java|typescript|react|sql|aws|kubernetes|go\b|rust|design|figma|excel|node)/.test(t);
  return {
    text,
    kind: isSkill ? "skill" : nice ? "pref" : "must",
    weight: nice ? 1 : isSkill ? 4 : 3,
    label: nice ? "nice_to_have" : "must_have",
    confidence: 0.5,
  };
}
