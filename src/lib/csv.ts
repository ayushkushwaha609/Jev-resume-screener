import type { Ranked } from "./ranking";
import type { JobState } from "./job";

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Built in the browser: the export is the only record, since nothing is stored.
export function downloadCsv(job: JobState, ranked: Ranked[]) {
  const reqs = job.requirements;
  const rows: unknown[][] = [
    [
      "rank", "name", "file", "mark", "fit", "must_met", "must_total", "needs_review", "review_reasons",
      `relevance_0_4 (w${job.relevanceWeight})`,
      ...reqs.map((r) => `${r.kind}: ${r.text} (w${r.weight})`),
      "source",
    ],
  ];
  ranked.forEach((r, i) => {
    const byKey = new Map(r.candidate.judgments.map((j) => [j.key, j]));
    rows.push([
      i + 1, r.candidate.displayName, r.candidate.fileName, r.candidate.stage, r.fit, r.mustMet, r.mustTotal,
      r.needsReview ? "yes" : "no", r.reviewReasons.join("; "), r.relevance?.value.toFixed(2),
      ...reqs.map((q) => byKey.get(q.id!)?.value.toFixed(2) ?? ""),
      r.candidate.mode === "jev" ? "jev-latest" : r.candidate.mode ?? "",
    ]);
  });
  const blob = new Blob([rows.map((row) => row.map(cell).join(",")).join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${job.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sift"}-results.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
