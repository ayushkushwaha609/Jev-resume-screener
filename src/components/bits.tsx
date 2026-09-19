import type { MustState, Stage } from "@/lib/ranking";

export function FitBar({ fit, pending }: { fit: number | null; pending?: boolean }) {
  if (fit === null)
    return <span className="text-xs text-muted">{pending ? <span className="animate-pulse">Scoring…</span> : "—"}</span>;
  const tone = fit >= 70 ? "bg-good" : fit >= 45 ? "bg-accent" : "bg-muted/60";
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 text-right text-sm font-medium tabular-nums">{fit}</span>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-subtle">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${fit}%` }} />
      </div>
    </div>
  );
}

const DOT: Record<MustState, string> = {
  met: "bg-good",
  unclear: "bg-warn",
  missing: "bg-bad",
  pending: "bg-line",
};

export function MustDots({ states }: { states: MustState[] }) {
  if (states.length === 0) return <span className="text-xs text-muted">—</span>;
  return (
    <div className="flex flex-wrap gap-1" aria-label={states.join(", ")}>
      {states.map((s, i) => (
        <span key={i} title={s} className={`size-2 rounded-full ${DOT[s]}`} />
      ))}
    </div>
  );
}

export const STAGE_LABEL: Record<Stage, string> = {
  new: "New",
  shortlisted: "Shortlisted",
  maybe: "Maybe",
  rejected: "Rejected",
};

const STAGE_TONE: Record<Stage, string> = {
  new: "text-muted border-line",
  shortlisted: "text-good border-good/40 bg-good/10",
  maybe: "text-warn border-warn/40 bg-warn/10",
  rejected: "text-bad border-bad/30 bg-bad/5",
};

export function StagePill({ stage }: { stage: Stage }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${STAGE_TONE[stage]}`}>
      {STAGE_LABEL[stage]}
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-subtle px-1 font-mono text-[10px] text-muted">{children}</kbd>
  );
}
