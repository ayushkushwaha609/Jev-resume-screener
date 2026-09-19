"use client";

import { useEffect, useMemo, useState } from "react";
import type { Trace } from "@/lib/jev";
import { downloadCsv } from "@/lib/csv";
import { MAX_CANDIDATES, MAX_PER_DROP, toRequirements, type AppCandidate, type JobState } from "@/lib/job";
import { rankAll, type Candidate, type Stage } from "@/lib/ranking";
import { FitBar, Kbd, MustDots, StagePill } from "./bits";
import { CandidatePanel } from "./CandidatePanel";
import { JobDialog } from "./JobDialog";
import { KIND_LABEL } from "./RequirementEditor";
import { UploadZone } from "./UploadZone";
import type { Screening } from "./useScreening";

type Filter = "all" | "review" | Stage;
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "review", label: "Needs review" },
  { id: "shortlisted", label: "Shortlisted" },
  { id: "maybe", label: "Maybe" },
  { id: "rejected", label: "Rejected" },
];

// Times one re-rank, to show a slider move costs milliseconds of plain code
// and zero model calls.
function timeRank(candidates: Candidate[], job: JobState): number {
  const t = performance.now();
  rankAll(candidates, toRequirements(job), job.relevanceWeight);
  return performance.now() - t;
}

// The results view: stats, weights, ranked table and candidate panel.
// Used by both the user's own screening and the separate sample page.
export function Workspace({
  demo,
  job,
  onJobChange,
  screening,
  actions,
  allowUpload,
}: {
  demo: boolean;
  job: JobState;
  onJobChange: (job: JobState) => void;
  screening: Screening;
  actions?: React.ReactNode;
  allowUpload: boolean;
}) {
  const { candidates, scoring, extraCalls } = screening;
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [rerankMs, setRerankMs] = useState<number | null>(null);

  const reqs = useMemo(() => toRequirements(job), [job]);
  const ranked = useMemo(() => rankAll(candidates, reqs, job.relevanceWeight), [candidates, reqs, job.relevanceWeight]);
  const rankOf = useMemo(() => new Map(ranked.map((r, i) => [r.candidate.id, i + 1])), [ranked]);

  // Where a keyword filter would have put each resume, for comparison.
  // In heuristic mode both rankings are the same, so the column is hidden.
  const keywordRankOf = useMemo(() => {
    if (demo) return null;
    const asKeywords = candidates.map((c) => ({ ...c, judgments: c.baseline }));
    return new Map(rankAll(asKeywords, reqs, job.relevanceWeight).map((r, i) => [r.candidate.id, i + 1]));
  }, [demo, candidates, reqs, job.relevanceWeight]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: ranked.length, review: 0, new: 0, shortlisted: 0, maybe: 0, rejected: 0 };
    for (const r of ranked) {
      c[r.candidate.stage]++;
      if (r.needsReview) c.review++;
    }
    return c;
  }, [ranked]);
  const visible = ranked.filter((r) =>
    filter === "all" ? true : filter === "review" ? r.needsReview : r.candidate.stage === filter,
  );
  const selected = ranked.find((r) => r.candidate.id === selectedId) ?? null;

  const stats = useMemo(() => {
    const traces = candidates.map((c) => c.trace).filter((t): t is Trace => !!t);
    return {
      screened: traces.length,
      requests: traces.reduce((n, t) => n + t.requests, 0),
      avgMs: traces.length ? Math.round(traces.reduce((n, t) => n + t.ms, 0) / traces.length) : null,
      tokens: traces.reduce((n, t) => n + (t.usage ? t.usage.input_tokens + t.usage.output_tokens : 0), 0),
    };
  }, [candidates]);

  const outdated = ranked.filter((r) => {
    const c = r.candidate;
    if (scoring.has(c.id)) return false;
    if (c.status === "error" || (r.stale && c.status === "scored")) return true;
    // Screened by the keyword heuristic, but a key is available now.
    return !demo && c.mode === "demo" && (c.status === "scored" || c.status === "invalid");
  });

  function applyJob(next: JobState) {
    setRerankMs(timeRank(candidates, next));
    onJobChange(next);
  }

  // ------------------------------------------------------ page lifecycle
  useEffect(() => {
    if (candidates.length === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [candidates.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (editing || t.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const idx = visible.findIndex((r) => r.candidate.id === selectedId);
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const next = e.key === "j" ? Math.min(visible.length - 1, idx + 1) : Math.max(0, idx - 1);
        if (visible[next]) setSelectedId(visible[next].candidate.id);
      } else if (e.key === "Escape") {
        setSelectedId(null);
      } else if (selectedId && ["s", "m", "r", "n"].includes(e.key)) {
        const stage = ({ s: "shortlisted", m: "maybe", r: "rejected", n: "new" } as const)[e.key as "s" | "m" | "r" | "n"];
        screening.setStage(selectedId, stage);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="label">Role</p>
          <h1 className="mt-1 truncate text-xl font-semibold tracking-tight">{job.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions}
          <button className="btn" onClick={() => setEditing(true)}>
            Edit requirements
          </button>
          <button className="btn-primary" disabled={stats.screened === 0} onClick={() => downloadCsv(job, ranked)}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        <Stat label="Resumes screened" value={`${stats.screened}`} />
        <Stat label="Jev requests" value={`${stats.requests + extraCalls}`} />
        <Stat label="Avg latency / resume" value={stats.avgMs === null ? "—" : `${stats.avgMs} ms`} />
        <Stat label="Tokens" value={stats.tokens ? stats.tokens.toLocaleString() : "—"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-18 lg:self-start">
          {allowUpload && (
            <>
              <UploadZone
                label="Add more resumes"
                disabled={candidates.length >= MAX_CANDIDATES}
                onFiles={(files) => screening.add(files.slice(0, MAX_PER_DROP).map((f) => ({ file: f, fileName: f.name })), job)}
              />
              {screening.notice && <p className="text-xs text-muted">{screening.notice}</p>}
            </>
          )}

          <div className="card p-4">
            <h2 className="mb-1 text-sm font-medium">Weights</h2>
            <p className="mb-3 text-[11px] text-muted">
              {rerankMs !== null ? (
                <>
                  Re-ranked {ranked.length} in {rerankMs.toFixed(2)} ms ·{" "}
                  <span className="font-medium text-good">0 model calls</span>
                </>
              ) : (
                "Judgments are stored once. Sliders only re-run code."
              )}
            </p>
            <div className="space-y-3">
              {job.requirements.map((r) => (
                <WeightRow
                  key={r.key}
                  label={r.text}
                  sub={KIND_LABEL[r.kind]}
                  value={r.weight}
                  onChange={(weight) =>
                    applyJob({ ...job, requirements: job.requirements.map((x) => (x.key === r.key ? { ...x, weight } : x)) })
                  }
                />
              ))}
              <WeightRow
                label="Overall relevance to the role"
                sub="Always asked"
                value={job.relevanceWeight}
                onChange={(relevanceWeight) => applyJob({ ...job, relevanceWeight })}
              />
            </div>
          </div>

          <div className="card space-y-2 p-4 text-xs text-muted">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="size-2 rounded-full bg-good" /> Met
              <span className="ml-1 size-2 rounded-full bg-warn" /> Unclear
              <span className="ml-1 size-2 rounded-full bg-bad" /> Missing
            </p>
            <p>
              <Kbd>J</Kbd> <Kbd>K</Kbd> move · <Kbd>S</Kbd> <Kbd>M</Kbd> <Kbd>R</Kbd> mark · <Kbd>Esc</Kbd> close
            </p>
            <p>Nothing is stored. Closing the tab clears everything, so export first.</p>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded-md px-2.5 py-1 text-[13px] transition-colors ${
                  filter === f.id ? "bg-fg text-bg" : "text-muted hover:bg-subtle hover:text-fg"
                }`}
              >
                {f.label}
                <span className="ml-1.5 tabular-nums opacity-60">{counts[f.id]}</span>
              </button>
            ))}
          </div>

          {outdated.length > 0 && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm">
              <span>
                {outdated.length} resume{outdated.length === 1 ? "" : "s"} need screening
                <span className="text-muted"> — failed, scored before a change, or scored without Jev.</span>
              </span>
              <button
                className="btn-primary shrink-0"
                onClick={() =>
                  screening.screen(
                    outdated.map((r) => r.candidate.id),
                    job,
                  )
                }
              >
                Screen {outdated.length}
              </button>
            </div>
          )}
          {scoring.size > 0 && (
            <p className="mb-3 text-xs text-muted">
              <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-accent align-middle" />
              Screening {scoring.size} resume{scoring.size === 1 ? "" : "s"} with {demo ? "the keyword heuristic" : "Jev"}…
            </p>
          )}

          {ranked.length === 0 ? (
            <div className="card px-6 py-16 text-center text-sm text-muted">No resumes yet.</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                    <th className="w-10 py-2.5 pl-4 font-medium">#</th>
                    <th className="py-2.5 font-medium">Candidate</th>
                    <th className="w-36 py-2.5 font-medium">Fit</th>
                    {keywordRankOf && (
                      <th className="hidden w-24 py-2.5 font-medium sm:table-cell" title="Rank a keyword filter would give">
                        Keyword #
                      </th>
                    )}
                    <th className="hidden w-28 py-2.5 font-medium md:table-cell">Must-haves</th>
                    <th className="hidden w-40 py-2.5 font-medium lg:table-cell">Flags</th>
                    <th className="w-28 py-2.5 pr-4 text-right font-medium">Mark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((r) => {
                    const c = r.candidate as AppCandidate;
                    const flags: { text: string; tone: string }[] = [];
                    if (c.status === "error") flags.push({ text: "Error", tone: "text-bad" });
                    if (c.status === "invalid") flags.push({ text: "Not a resume?", tone: "text-bad" });
                    if (r.needsReview && c.status === "scored") flags.push({ text: "Needs review", tone: "text-warn" });
                    if (r.mustMissing > 0) flags.push({ text: `${r.mustMissing} missing`, tone: "text-muted" });
                    if (r.stale) flags.push({ text: "Outdated", tone: "text-muted" });
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedId(c.id)}
                        className={`cursor-pointer transition-colors ${
                          c.id === selectedId ? "bg-accent-soft" : "hover:bg-subtle"
                        } ${c.stage === "rejected" ? "opacity-55" : ""}`}
                      >
                        <td className="py-3 pl-4 tabular-nums text-muted">{rankOf.get(c.id)}</td>
                        <td className="py-3 pr-3">
                          <p className="truncate font-medium">{c.displayName}</p>
                          <p className="truncate text-xs text-muted">
                            {c.status === "error" ? c.error : (c.sampleNote ?? c.fileName)}
                          </p>
                        </td>
                        <td className="py-3 pr-3">
                          <FitBar fit={r.fit} pending={scoring.has(c.id) || c.status === "pending"} />
                        </td>
                        {keywordRankOf && (
                          <td className="hidden py-3 pr-3 sm:table-cell">
                            <KeywordRank
                              jev={rankOf.get(c.id)!}
                              keyword={r.fit === null ? null : (keywordRankOf.get(c.id) ?? null)}
                            />
                          </td>
                        )}
                        <td className="hidden py-3 pr-3 md:table-cell">
                          <MustDots states={r.results.filter((x) => x.mustState).map((x) => x.mustState!)} />
                        </td>
                        <td className="hidden py-3 pr-3 lg:table-cell">
                          <div className="flex flex-wrap gap-x-2 text-xs">
                            {flags.map((f) => (
                              <span key={f.text} className={f.tone}>
                                {f.text}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <StagePill stage={c.stage} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visible.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">Nobody here.</p>}
            </div>
          )}
        </section>
      </div>

      {selected && (
        <CandidatePanel
          key={selected.candidate.id}
          ranked={selected}
          candidate={selected.candidate as AppCandidate}
          relevanceWeight={job.relevanceWeight}
          rank={rankOf.get(selected.candidate.id)!}
          total={ranked.length}
          pending={scoring.has(selected.candidate.id)}
          onClose={() => setSelectedId(null)}
          onStage={(stage) => screening.setStage(selected.candidate.id, stage)}
          onCall={screening.countCall}
        />
      )}

      {editing && (
        <JobDialog
          initial={job}
          onClose={() => setEditing(false)}
          onCall={screening.countCall}
          onSave={(j) => {
            onJobChange(j);
            setEditing(false);
          }}
        />
      )}
    </>
  );
}

function KeywordRank({ jev, keyword }: { jev: number; keyword: number | null }) {
  if (keyword === null) return <span className="text-xs text-muted">—</span>;
  const diff = keyword - jev; // positive: Jev ranks this resume higher than keywords do
  return (
    <span className="font-mono text-xs tabular-nums">
      <span className="text-muted">#{keyword}</span>
      {diff !== 0 && (
        <span className={`ml-1.5 ${Math.abs(diff) >= 3 ? "font-semibold" : ""} ${diff > 0 ? "text-good" : "text-bad"}`}>
          {diff > 0 ? "▲" : "▼"}
          {Math.abs(diff)}
        </span>
      )}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

function WeightRow({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-[13px] leading-snug">{label}</span>
        <span className="text-[13px] tabular-nums text-muted">{value}</span>
      </span>
      <span className="text-[11px] text-muted">{sub}</span>
      <input
        type="range"
        min={0}
        max={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full"
      />
    </label>
  );
}
