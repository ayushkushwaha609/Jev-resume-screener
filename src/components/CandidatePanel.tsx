"use client";

import { useState } from "react";
import {
  IS_RESUME_KEY,
  MUST_MET,
  MUST_MISSING,
  RELEVANCE_LEVELS,
  SCORE_MAX,
  SKILL_LEVELS,
  type Judgment,
  type Ranked,
  type RequirementResult,
  type Kind,
  type Stage,
} from "@/lib/ranking";
import type { AppCandidate } from "@/lib/job";
import { keyHeaders } from "@/lib/userKey";
import { STAGE_LABEL } from "./bits";

type Tab = "judgments" | "hood" | "resume";
interface Evidence {
  lines: { index: number; text: string; p: number }[];
  ms: number;
}

const EVIDENCE_MIN = 0.6;

export function CandidatePanel({
  ranked,
  candidate,
  rank,
  total,
  pending,
  onClose,
  onStage,
  onCall,
  relevanceWeight,
}: {
  ranked: Ranked;
  candidate: AppCandidate;
  relevanceWeight: number;
  rank: number;
  total: number;
  pending: boolean;
  onClose: () => void;
  onStage: (s: Stage) => void;
  onCall: () => void;
}) {
  const [tab, setTab] = useState<Tab>("judgments");
  const [evidence, setEvidence] = useState<Record<string, Evidence>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [focusReq, setFocusReq] = useState<string | null>(null);
  const [evError, setEvError] = useState<string | null>(null);

  async function loadEvidence(reqId: string, text: string) {
    if (evidence[reqId]) {
      setFocusReq(focusReq === reqId ? null : reqId);
      return;
    }
    setLoading(reqId);
    setEvError(null);
    try {
      const res = await fetch("/api/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...keyHeaders() },
        body: JSON.stringify({ requirement: text, text: candidate.redactedText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      if (data.mode === "jev") onCall();
      setEvidence((prev) => ({ ...prev, [reqId]: { lines: data.lines, ms: data.ms } }));
      setFocusReq(reqId);
    } catch (e) {
      setEvError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(null);
    }
  }

  const scored = candidate.status === "scored" || candidate.status === "invalid";
  const isResume = candidate.judgments.find((j) => j.key === IS_RESUME_KEY);

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/20" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-[600px] flex-col border-l border-line bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-line px-5 pb-0 pt-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">
                #{rank} of {total} · {candidate.fileName}
              </p>
              <h2 className="truncate text-lg font-semibold tracking-tight">{candidate.displayName}</h2>
              {candidate.sampleNote && <p className="mt-0.5 text-xs text-muted">Sample: {candidate.sampleNote}</p>}
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold tabular-nums tracking-tight">{ranked.fit ?? "—"}</p>
              <p className="text-[11px] text-muted">fit / 100</p>
            </div>
            <button className="btn-ghost !px-2" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(["shortlisted", "maybe", "rejected"] as Stage[]).map((s) => (
              <button
                key={s}
                onClick={() => onStage(candidate.stage === s ? "new" : s)}
                className={`btn !h-7 !text-xs ${candidate.stage === s ? "!border-fg !bg-fg !text-bg" : ""}`}
              >
                {STAGE_LABEL[s]}
              </button>
            ))}
          </div>
          <nav className="mt-3 flex gap-4 text-[13px]">
            {(
              [
                ["judgments", "Judgments"],
                ["hood", "Under the hood"],
                ["resume", "Resume sent to Jev"],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`-mb-px border-b-2 pb-2 transition-colors ${
                  tab === id ? "border-fg font-medium" : "border-transparent text-muted hover:text-fg"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {pending || candidate.status === "pending" ? (
            <p className="animate-pulse text-sm text-muted">Asking Jev…</p>
          ) : candidate.status === "error" ? (
            <p className="text-sm text-bad">{candidate.error}</p>
          ) : !scored ? null : tab === "judgments" ? (
            <div className="space-y-6">
              {ranked.reviewReasons.length > 0 && (
                <div className="rounded-lg border border-warn/30 bg-warn/10 px-4 py-3 text-sm">
                  <p className="font-medium text-warn">Needs a human look</p>
                  <ul className="mt-1 space-y-0.5 text-[13px] text-muted">
                    {ranked.reviewReasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              {SECTIONS.map(({ kind, title }) => {
                const rows = ranked.results.filter((r) => r.requirement.kind === kind);
                if (rows.length === 0) return null;
                const met = rows.filter((r) => r.mustState === "met").length;
                return (
                  <Section key={kind} title={title} aside={
                      kind === "must"
                        ? `${met} of ${rows.length} met · met ≥ ${MUST_MET}, missing < ${MUST_MISSING}`
                        : undefined
                    }>
                    {rows.map((r) => (
                      <ResultRow
                        key={r.requirement.id}
                        r={r}
                        evidence={evidence[r.requirement.id]}
                        open={focusReq === r.requirement.id}
                        loading={loading === r.requirement.id}
                        onEvidence={() => loadEvidence(r.requirement.id, r.requirement.text)}
                      />
                    ))}
                  </Section>
                );
              })}
              {evError && <p className="text-xs text-bad">{evError}</p>}
              <Section title="Overall">
                {ranked.relevance && (
                  <Row
                    title="Relevance to the role"
                    value={<ScoreValue j={ranked.relevance} />}
                    viz={<LevelMeter j={ranked.relevance} levels={RELEVANCE_LEVELS} />}
                    caption={RELEVANCE_LEVELS[Math.round(ranked.relevance.value)]}
                    meta={`Score · w${relevanceWeight}${confText(ranked.relevance)}`}
                  />
                )}
                {isResume && (
                  <Row
                    title="Is this a resume?"
                    value={
                      <Pill tone={isResume.value < 0.5 ? "bad" : "neutral"}>
                        {isResume.value < 0.5 ? "Probably not" : "Yes"}
                        <Num>{isResume.value.toFixed(2)}</Num>
                      </Pill>
                    }
                    caption={isResume.value < 0.5 ? "Not ranked, since it does not look like a resume." : undefined}
                    meta="Noul · gate, not weighted"
                  />
                )}
              </Section>
            </div>
          ) : tab === "hood" ? (
            <UnderTheHood candidate={candidate} ranked={ranked} relevanceWeight={relevanceWeight} />
          ) : (
            <ResumeText text={candidate.redactedText} evidence={focusReq ? evidence[focusReq] : undefined} />
          )}
        </div>
      </aside>
    </div>
  );
}

// ------------------------------------------------------------------ rows

const SECTIONS: { kind: Kind; title: string }[] = [
  { kind: "must", title: "Must-haves" },
  { kind: "skill", title: "Skills" },
  { kind: "pref", title: "Nice-to-haves" },
];

type Tone = "good" | "warn" | "bad" | "neutral" | "accent";
const PILL: Record<Tone, string> = {
  good: "bg-good/12 text-good",
  warn: "bg-warn/12 text-warn",
  bad: "bg-bad/12 text-bad",
  neutral: "bg-subtle text-fg",
  accent: "bg-accent-soft text-accent",
};
const BAR: Record<Tone, string> = {
  good: "bg-good",
  warn: "bg-warn",
  bad: "bg-bad",
  neutral: "bg-muted",
  accent: "bg-accent",
};

function Section({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="label">{title}</h3>
        {aside && <span className="text-[11px] text-muted">{aside}</span>}
      </div>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${PILL[tone]}`}>
      {children}
    </span>
  );
}

function Num({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[11px] tabular-nums opacity-80">{children}</span>;
}

const confText = (j: Judgment) => (j.confidence !== null ? ` · conf ${j.confidence.toFixed(2)}` : "");

// One judgment: title and value on top, a slim meter, then one quiet line
// with the level description, weight, confidence and the evidence action.
function Row({
  title,
  value,
  viz,
  caption,
  meta,
  action,
  children,
}: {
  title: string;
  value: React.ReactNode;
  viz?: React.ReactNode;
  caption?: string;
  meta: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-3">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm leading-snug">{title}</p>
        {value}
      </div>
      {viz && <div className="mt-2">{viz}</div>}
      <div className="mt-1.5 flex items-baseline gap-3 text-[11px] text-muted">
        <span className="min-w-0 flex-1 truncate" title={caption}>
          {caption}
        </span>
        <span className="shrink-0">{meta}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function ResultRow({
  r,
  evidence,
  open,
  loading,
  onEvidence,
}: {
  r: RequirementResult;
  evidence?: Evidence;
  open: boolean;
  loading: boolean;
  onEvidence: () => void;
}) {
  const j = r.judgment;
  const w = `w${r.requirement.weight}`;
  if (!j) return <Row title={r.requirement.text} value={<Pill tone="neutral">Not scored</Pill>} meta={w} />;

  const action = (
    <button className="shrink-0 font-medium text-accent hover:underline" onClick={onEvidence} disabled={loading}>
      {loading ? "Checking…" : open ? "Hide evidence" : "Evidence"}
    </button>
  );
  const evidenceList = open && evidence && <EvidenceList evidence={evidence} />;

  if (j.type === "score")
    return (
      <Row
        title={r.requirement.text}
        value={<ScoreValue j={j} />}
        viz={<LevelMeter j={j} levels={SKILL_LEVELS} />}
        caption={SKILL_LEVELS[Math.round(j.value)]}
        meta={`Score · ${w}${confText(j)}`}
        action={action}
      >
        {evidenceList}
      </Row>
    );

  const must = r.requirement.kind === "must";
  const state = r.mustState;
  const tone: Tone = !must ? "accent" : state === "met" ? "good" : state === "missing" ? "bad" : "warn";
  const label = !must
    ? j.value >= 0.5
      ? "Likely"
      : "Unlikely"
    : state === "met"
      ? "Met"
      : state === "missing"
        ? "Missing"
        : "Unclear";
  return (
    <Row
      title={r.requirement.text}
      value={
        <Pill tone={tone}>
          {label}
          <Num>{j.value.toFixed(2)}</Num>
        </Pill>
      }
      viz={<ProbabilityBar p={j.value} tone={tone} thresholds={must} />}
      meta={`Noul · ${w}`}
      action={action}
    >
      {evidenceList}
    </Row>
  );
}

function ScoreValue({ j }: { j: Judgment }) {
  return (
    <span className="shrink-0 font-mono text-sm tabular-nums">
      {j.value.toFixed(2)}
      <span className="text-xs text-muted"> / {SCORE_MAX}</span>
    </span>
  );
}

function ProbabilityBar({ p, tone, thresholds }: { p: number; tone: Tone; thresholds: boolean }) {
  return (
    <div className="relative h-1 rounded-full bg-subtle" title={`p = ${p.toFixed(2)}`}>
      <div className={`h-full rounded-full ${BAR[tone]}`} style={{ width: `${p * 100}%` }} />
      {thresholds &&
        [MUST_MISSING, MUST_MET].map((t) => (
          <span key={t} className="absolute -top-0.5 h-2 w-px bg-muted/40" style={{ left: `${t * 100}%` }} />
        ))}
    </div>
  );
}

// Five segments, one per level. Shading shows the probability Jev put on
// each level; the ring marks the level nearest the score. Hover for numbers.
function LevelMeter({ j, levels }: { j: Judgment; levels: string[] }) {
  const probs = j.probabilities ?? {};
  const hasDist = Object.keys(probs).length > 0;
  const nearest = Math.round(j.value);
  return (
    <div className="grid grid-cols-5 gap-1">
      {levels.map((l, i) => {
        const p = hasDist ? (probs[String(i)] ?? 0) : i === nearest ? 1 : 0;
        return (
          <div
            key={i}
            title={`Level ${i}: ${l} — ${(p * 100).toFixed(0)}%`}
            className={`h-1.5 rounded-full bg-subtle ${i === nearest ? "ring-1 ring-accent/60 ring-offset-1 ring-offset-bg" : ""}`}
          >
            <div className="h-full rounded-full bg-accent" style={{ opacity: p }} />
          </div>
        );
      })}
    </div>
  );
}

function EvidenceList({ evidence }: { evidence: Evidence }) {
  const hits = evidence.lines.filter((l) => l.p >= EVIDENCE_MIN).sort((a, b) => b.p - a.p);
  return (
    <div className="mt-2 rounded-md border border-line bg-surface p-3">
      <p className="mb-2 text-[11px] text-muted">
        One Noul per resume line ({evidence.lines.length} lines, {evidence.ms} ms). Lines with p ≥ {EVIDENCE_MIN}:
      </p>
      {hits.length === 0 ? (
        <p className="text-xs text-muted">No line supports this requirement.</p>
      ) : (
        <ul className="space-y-1.5">
          {hits.map((l) => (
            <li key={l.index} className="flex gap-2 text-[13px] leading-snug">
              <span className="w-9 shrink-0 font-mono text-[11px] tabular-nums text-muted">{l.p.toFixed(2)}</span>
              <span className="rounded-sm bg-mark px-1">{l.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------ under the hood

function UnderTheHood({
  candidate,
  ranked,
  relevanceWeight,
}: {
  candidate: AppCandidate;
  ranked: Ranked;
  relevanceWeight: number;
}) {
  const t = candidate.trace;
  const [copied, setCopied] = useState(false);
  if (!t) return <p className="text-sm text-muted">No trace for this resume.</p>;

  const request = { model: t.model, state: t.state, questions: t.questions };
  const terms = ranked.results
    .filter((r) => r.normalized !== null && r.requirement.weight > 0)
    .map((r) => ({ w: r.requirement.weight, v: r.normalized! }));
  if (ranked.relevance && relevanceWeight > 0) {
    terms.push({ w: relevanceWeight, v: ranked.relevance.value / SCORE_MAX });
  }

  return (
    <div className="space-y-5 text-sm">
      <div className="grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-line bg-line text-center">
        {[
          ["Model", t.model],
          ["Requests", String(t.requests)],
          ["Latency", `${t.ms} ms`],
          ["Tokens", t.usage ? `${t.usage.input_tokens + t.usage.output_tokens}` : "—"],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted">{k}</p>
            <p className="mt-0.5 truncate font-mono text-xs">{v}</p>
          </div>
        ))}
      </div>

      <p className="leading-relaxed text-muted">
        One request carried the job and the redacted resume as <code className="font-mono text-xs">state</code>, plus{" "}
        {Object.keys(t.questions).length} independent questions answered in parallel.{" "}
        {t.requests > 0 ? "Jev returned typed values only, no prose." : "In heuristic mode, keyword matching answered them."} The
        fit score is ordinary code. Noul values count as-is; Scores are divided by 4:
      </p>
      <pre className="whitespace-pre-wrap break-words rounded-md border border-line bg-surface p-3 font-mono text-[11.5px] leading-relaxed">
        {`fit = 100 × Σ(weight × value) / Σ weight\n    = 100 × (${terms
          .map((x) => `${x.w}×${x.v.toFixed(2)}`)
          .join(" + ")}${ranked.relevance ? " + relevance" : ""}) / …\n    = ${ranked.fit ?? "—"}`}
      </pre>

      <div className="space-y-3">
        {Object.entries(t.questions).map(([key, q]) => (
          <details key={key} className="group rounded-md border border-line bg-surface">
            <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2.5">
              <span className="mt-0.5 rounded bg-accent-soft px-1.5 font-mono text-[10px] uppercase text-accent">
                {q.type}
              </span>
              <span className="flex-1 text-[13px] leading-snug">{q.instructions}</span>
              <span className="font-mono text-xs tabular-nums text-muted">{answerSummary(t.answers[key])}</span>
            </summary>
            <div className="grid gap-2 border-t border-line p-3 sm:grid-cols-2">
              <div>
                <p className="label mb-1">criteria</p>
                <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted">
                  {q.criteria ? JSON.stringify(q.criteria, null, 2) : "—"}
                </pre>
              </div>
              <div>
                <p className="label mb-1">answer</p>
                <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                  {JSON.stringify(t.answers[key], null, 2)}
                </pre>
              </div>
            </div>
          </details>
        ))}
      </div>

      <button
        className="btn"
        onClick={async () => {
          await navigator.clipboard.writeText(JSON.stringify(request, null, 2));
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : "Copy full request JSON"}
      </button>
    </div>
  );
}

function answerSummary(a: unknown) {
  const x = a as { type?: string; noul?: number; score?: number; choice?: string } | undefined;
  if (!x) return "";
  if (x.type === "noul") return `p ${x.noul?.toFixed(2)}`;
  if (x.type === "score") return `${x.score?.toFixed(2)}/4`;
  return x.choice ?? "";
}

function ResumeText({ text, evidence }: { text: string; evidence?: Evidence }) {
  const strong = new Map((evidence?.lines ?? []).filter((l) => l.p >= EVIDENCE_MIN).map((l) => [l.text, l.p]));
  return (
    <div>
      <p className="mb-3 text-xs text-muted">
        Exactly what Jev received. Contact details and the name were removed in code first.
        {evidence ? " Highlighted lines support the selected requirement." : " Find evidence lines on the Judgments tab to highlight them."}
      </p>
      <div className="rounded-md border border-line bg-surface p-4 font-mono text-[12px] leading-relaxed">
        {text.split("\n").map((line, i) => (
          <div key={i} className={strong.has(line.trim()) ? "-mx-1 rounded-sm bg-mark px-1" : ""}>
            {line || " "}
          </div>
        ))}
      </div>
    </div>
  );
}
