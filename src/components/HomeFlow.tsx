"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  MAX_PER_DROP,
  MAX_REQUIREMENTS,
  fetchSuggestions,
  suggestionsToDrafts,
  withIds,
  type DraftRequirement,
  type JobState,
} from "@/lib/job";
import { RequirementEditor } from "./RequirementEditor";
import { UploadZone } from "./UploadZone";
import { useScreening } from "./useScreening";
import { HeuristicNotice, Workspace } from "./Workspace";

const MAX_FILE_BYTES = 4 * 1024 * 1024;

// The user's own screening: job description + resumes in, ranking out.
// Shares no state with the sample page.
export function HomeFlow({ demo }: { demo: boolean }) {
  const screening = useScreening();
  const [job, setJob] = useState<JobState | null>(null);

  // setup state, kept when starting a new screening so the JD can be reused
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reqs, setReqs] = useState<DraftRequirement[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<"jd" | "extract" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const jdInput = useRef<HTMLInputElement>(null);

  async function readJdFile(file: File) {
    setBusy("jd");
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not read the file");
      setDescription(data.text);
      if (!title) setTitle(guessTitle(data.text));
      await extractRequirements(data.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the file");
    } finally {
      setBusy(null);
    }
  }

  async function extractRequirements(text = description, existing = reqs) {
    setBusy("extract");
    setError(null);
    try {
      const data = await fetchSuggestions(title, text);
      if (data.mode === "jev") screening.countCall();
      const incoming = suggestionsToDrafts(data.suggestions, existing);
      setReqs([...existing, ...incoming]);
      setNote(
        incoming.length
          ? `Jev sorted each line of the description and found ${incoming.length} requirement${incoming.length === 1 ? "" : "s"}. Check the types and weights.`
          : "No new requirements found. Add them by hand.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the job description");
    } finally {
      setBusy(null);
    }
  }

  function addFiles(list: File[]) {
    setError(null);
    const tooBig = list.filter((f) => f.size > MAX_FILE_BYTES).map((f) => f.name);
    const ok = list.filter((f) => f.size <= MAX_FILE_BYTES && !files.some((x) => x.name === f.name && x.size === f.size));
    const next = [...files, ...ok].slice(0, MAX_PER_DROP);
    setFiles(next);
    if (tooBig.length) setError(`Skipped files over 4 MB: ${tooBig.join(", ")}`);
    else if (files.length + ok.length > MAX_PER_DROP) setError(`Up to ${MAX_PER_DROP} resumes per screening.`);
  }

  const filled = reqs.filter((r) => r.text.trim());
  const blocker =
    filled.length === 0
      ? "Add a job description and extract its requirements"
      : filled.length > MAX_REQUIREMENTS
        ? `Keep it to ${MAX_REQUIREMENTS} requirements`
        : files.length === 0
          ? "Add at least one resume"
          : null;

  function start() {
    const next: JobState = {
      title: title.trim() || "Untitled role",
      description,
      requirements: withIds(reqs, filled),
      relevanceWeight: 2,
    };
    setReqs(next.requirements);
    setJob(next);
    screening.add(
      files.map((f) => ({ file: f, fileName: f.name })),
      next,
    );
    setFiles([]);
  }

  function startOver() {
    if (screening.candidates.length && !confirm("Start a new screening? Current results will be cleared.")) return;
    screening.reset();
    setJob(null);
  }

  if (job) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        {demo && <HeuristicNotice />}
        <Workspace
          demo={demo}
          job={job}
          onJobChange={setJob}
          screening={screening}
          allowUpload
          actions={
            <button className="btn" onClick={startOver}>
              New screening
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-6 sm:pt-16">
      {demo && <HeuristicNotice />}
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Rank applicants on evidence, not keywords.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Add a job description and resumes. Jev answers one small question per requirement with a typed probability,
          and code does the ranking. Nothing is stored, and names and contact details are removed before Jev sees a
          resume.{" "}
          <Link href="/sample" className="text-accent hover:underline">
            See a sample run →
          </Link>
        </p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section className="card p-5">
          <Step n={1} title="Job description" />
          <div className="mt-4 space-y-3">
            <input
              className="input"
              placeholder="Role title, e.g. Senior Frontend Engineer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="input min-h-44 font-mono text-[12.5px] leading-relaxed"
              placeholder="Paste the job description, or upload it as a file…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={() => jdInput.current?.click()} disabled={!!busy}>
                {busy === "jd" ? "Reading file…" : "Upload JD file"}
              </button>
              <input
                ref={jdInput}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) readJdFile(f);
                  e.target.value = "";
                }}
              />
              <button
                className="btn-primary"
                onClick={() => extractRequirements()}
                disabled={!description.trim() || !!busy}
              >
                {busy === "extract" ? "Extracting…" : "Extract requirements"}
              </button>
            </div>
            {note && <p className="text-xs text-muted">{note}</p>}
          </div>

          {(reqs.length > 0 || description.trim()) && (
            <div className="mt-6 border-t border-line pt-5">
              <p className="label mb-2">
                Requirements · {filled.length}/{MAX_REQUIREMENTS}
              </p>
              <RequirementEditor value={reqs} onChange={setReqs} />
            </div>
          )}
        </section>

        <section className="card flex flex-col p-5 lg:self-start">
          <Step n={2} title="Resumes" />
          <div className="mt-4">
            <UploadZone
              tall
              onFiles={addFiles}
              disabled={files.length >= MAX_PER_DROP}
              hint={`PDF, DOCX or TXT · up to ${MAX_PER_DROP} · 4 MB each`}
            />
          </div>
          {files.length > 0 && (
            <ul className="mt-3 divide-y divide-line rounded-md border border-line">
              {files.map((f) => (
                <li key={f.name + f.size} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="text-xs tabular-nums text-muted">{Math.max(1, Math.round(f.size / 1024))} KB</span>
                  <button
                    className="text-muted hover:text-fg"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => setFiles(files.filter((x) => x !== f))}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 border-t border-line pt-5">
            <button className="btn-primary !h-10 w-full !text-sm" onClick={start} disabled={!!blocker || !!busy}>
              {files.length ? `Screen ${files.length} resume${files.length === 1 ? "" : "s"}` : "Screen resumes"}
            </button>
            <p className="mt-2 text-center text-xs text-muted">
              {blocker ?? `${filled.length} requirements · one Jev request per resume`}
            </p>
            {error && <p className="mt-2 text-center text-xs text-bad">{error}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="flex items-center gap-2.5 font-medium">
      <span className="grid size-6 place-items-center rounded-full bg-fg text-xs font-semibold text-bg">{n}</span>
      {title}
    </h2>
  );
}

// First short line of the JD is usually the role title.
function guessTitle(text: string): string {
  const first = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  return first.length <= 80 ? first.replace(/\s+[—–-]\s+.*$/, "") : "";
}
