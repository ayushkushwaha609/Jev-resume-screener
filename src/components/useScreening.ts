"use client";

import { useRef, useState } from "react";
import { MAX_CANDIDATES, toRequirements, type AppCandidate, type JobState } from "@/lib/job";
import type { Stage } from "@/lib/ranking";

export type Source = { file?: File; text?: string; fileName: string };

const CONCURRENCY = 4;

let seq = 0;
const newId = () => `c${Date.now().toString(36)}${(seq++).toString(36)}`;

// Owns the candidates of one screening session and the request queue that
// fills them in. Each page that uses it gets its own, unshared session.
export function useScreening() {
  const [candidates, setCandidates] = useState<AppCandidate[]>([]);
  const [scoring, setScoring] = useState<Set<string>>(new Set());
  const [extraCalls, setExtraCalls] = useState(0); // suggest + evidence requests
  const [notice, setNotice] = useState<string | null>(null);

  const sources = useRef(new Map<string, Source>());
  const queue = useRef<{ id: string; job: JobState }[]>([]);
  const active = useRef(0);

  const patch = (id: string, p: Partial<AppCandidate>) =>
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, ...p } : c)));

  function pump() {
    while (active.current < CONCURRENCY && queue.current.length > 0) {
      const { id, job } = queue.current.shift()!;
      const src = sources.current.get(id);
      if (!src) continue;
      active.current++;
      const form = new FormData();
      form.append(
        "job",
        JSON.stringify({
          title: job.title,
          description: job.description,
          requirements: toRequirements(job).map(({ id, text, kind }) => ({ id, text, kind })),
        }),
      );
      if (src.file) form.append("file", src.file);
      else {
        form.append("text", src.text ?? "");
        form.append("fileName", src.fileName);
      }
      fetch("/api/screen", { method: "POST", body: form })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Screening failed");
          const isResume = data.judgments.find((j: { key: string }) => j.key === "is_resume")?.value ?? 1;
          patch(id, {
            displayName: data.displayName,
            redactedText: data.redactedText,
            judgments: data.judgments,
            baseline: data.baseline,
            trace: data.trace,
            mode: data.mode,
            status: isResume < 0.5 ? "invalid" : "scored",
            error: null,
          });
        })
        .catch((e) => patch(id, { status: "error", error: e instanceof Error ? e.message : "Failed" }))
        .finally(() => {
          active.current--;
          setScoring((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          pump();
        });
    }
  }

  function screen(ids: string[], job: JobState) {
    const fresh = ids.filter((id) => !queue.current.some((q) => q.id === id));
    queue.current.push(...fresh.map((id) => ({ id, job })));
    setScoring((prev) => new Set([...prev, ...fresh]));
    pump();
  }

  function add(items: Source[], job: JobState, notes: (string | undefined)[] = []) {
    const room = MAX_CANDIDATES - candidates.length;
    const take = items.slice(0, Math.max(0, room));
    setNotice(take.length < items.length ? `This demo holds up to ${MAX_CANDIDATES} resumes per session.` : null);
    const created: AppCandidate[] = take.map((s, i) => {
      const id = newId();
      sources.current.set(id, s);
      return {
        id,
        fileName: s.fileName,
        displayName: s.fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
        redactedText: "",
        status: "pending",
        error: null,
        mode: null,
        stage: "new",
        createdAt: Date.now() + i,
        judgments: [],
        baseline: [],
        trace: null,
        sampleNote: notes[i],
      };
    });
    setCandidates((prev) => [...prev, ...created]);
    screen(
      created.map((c) => c.id),
      job,
    );
  }

  function reset() {
    sources.current.clear();
    queue.current = [];
    setCandidates([]);
    setScoring(new Set());
    setNotice(null);
  }

  return {
    candidates,
    scoring,
    extraCalls,
    notice,
    add,
    screen,
    reset,
    setStage: (id: string, stage: Stage) => patch(id, { stage }),
    countCall: () => setExtraCalls((n) => n + 1),
  };
}

export type Screening = ReturnType<typeof useScreening>;
