"use client";

import { useState } from "react";
import Link from "next/link";
import type { JobState } from "@/lib/job";
import { SAMPLE_JOB, SAMPLE_RESUMES } from "@/lib/sample";
import { useScreening } from "./useScreening";
import { HeuristicNotice, Workspace } from "./Workspace";

const sampleJob = (): JobState => ({
  title: SAMPLE_JOB.title,
  description: SAMPLE_JOB.description,
  requirements: SAMPLE_JOB.requirements.map((r) => ({ ...r, key: r.id })),
  relevanceWeight: 2,
});

const PRIMITIVES = [
  { name: "Noul", body: "Probability that a must-have holds. 0.5 honestly means unclear, and goes to review." },
  { name: "Score", body: "Depth on five described levels, with a full distribution and a confidence." },
  { name: "Choice", body: "Sorts each job-description line into must-have, nice-to-have or neither." },
];

// A fixed, fictional run. It has its own session and never touches the
// user's own screening on the home page. Runs only on click, so link
// previews and crawlers don't spend API credits.
export function SampleFlow({ demo }: { demo: boolean }) {
  const screening = useScreening();
  const [job, setJob] = useState<JobState | null>(null);

  function run() {
    const next = sampleJob();
    screening.reset();
    setJob(next);
    screening.add(
      SAMPLE_RESUMES.map((r) => ({ text: r.text, fileName: r.fileName })),
      next,
      SAMPLE_RESUMES.map((r) => r.note),
    );
  }

  if (job) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        {demo && <HeuristicNotice />}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-subtle px-4 py-2.5 text-sm">
          <span>
            <span className="font-medium">Sample run.</span>{" "}
            <span className="text-muted">A fictional role and 8 fictional applicants, each chosen to test something.</span>
          </span>
          <Link href="/" className="text-accent hover:underline">
            Screen your own →
          </Link>
        </div>
        <Workspace
          demo={demo}
          job={job}
          onJobChange={setJob}
          screening={screening}
          allowUpload={false}
          actions={
            <button className="btn" onClick={run}>
              Run again
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 pt-12 sm:px-6 sm:pt-16">
      {demo && <HeuristicNotice />}
      <p className="label">Sample run</p>
      <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        Eight applicants built to fool a keyword filter.
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
        One fictional role, {SAMPLE_JOB.title}, and {SAMPLE_RESUMES.length} fictional resumes. Each resume gets one Jev
        request. A keyword baseline answers the same questions, so you can see where the two disagree.
      </p>
      <div className="mt-7 flex flex-wrap gap-2">
        <button className="btn-primary !h-10 !px-4 !text-sm" onClick={run}>
          Run the sample
        </button>
        <Link href="/" className="btn !h-10 !px-4 !text-sm">
          Screen your own instead
        </Link>
      </div>

      <div className="mt-12 grid gap-8 md:grid-cols-2">
        <div>
          <p className="label mb-3">The applicants</p>
          <ul className="card divide-y divide-line">
            {SAMPLE_RESUMES.map((r) => (
              <li key={r.fileName} className="px-4 py-2.5">
                <p className="font-mono text-xs text-muted">{r.fileName}</p>
                <p className="text-sm">{r.note}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="label mb-3">The requirements</p>
          <ul className="card divide-y divide-line">
            {SAMPLE_JOB.requirements.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span>{r.text}</span>
                <span className="shrink-0 text-xs text-muted">
                  {r.kind === "skill" ? "Score" : "Noul"} · w{r.weight}
                </span>
              </li>
            ))}
          </ul>
          <p className="label mb-3 mt-8">What Jev returns</p>
          <div className="space-y-2">
            {PRIMITIVES.map((p) => (
              <div key={p.name} className="card flex gap-3 p-3">
                <span className="w-14 shrink-0 font-mono text-xs text-accent">{p.name}</span>
                <span className="text-[13px] leading-relaxed text-muted">{p.body}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
