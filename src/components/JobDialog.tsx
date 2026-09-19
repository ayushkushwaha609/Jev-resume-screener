"use client";

import { useState } from "react";
import { RequirementEditor } from "./RequirementEditor";
import {
  MAX_REQUIREMENTS,
  describeExtraction,
  fetchSuggestions,
  suggestionsToDrafts,
  withIds,
  type DraftRequirement,
  type JobState,
} from "@/lib/job";

export function JobDialog({
  initial,
  onClose,
  onSave,
  onCall,
}: {
  initial: JobState | null;
  onClose: () => void;
  onSave: (job: JobState) => void;
  onCall: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [reqs, setReqs] = useState<DraftRequirement[]>(initial?.requirements ?? []);
  const [suggesting, setSuggesting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function suggest() {
    setSuggesting(true);
    setError(null);
    try {
      const data = await fetchSuggestions(title, description);
      if (data.mode === "jev") onCall();
      const incoming = suggestionsToDrafts(data.suggestions, reqs);
      setReqs([...reqs, ...incoming]);
      setNote(describeExtraction(data.mode, incoming.length, data.fallback, data.unquoted));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSuggesting(false);
    }
  }

  const filled = reqs.filter((r) => r.text.trim());
  const tooMany = filled.length > MAX_REQUIREMENTS;

  function save() {
    onSave({
      title: title.trim() || "Untitled role",
      description,
      requirements: withIds(initial?.requirements ?? [], filled),
      relevanceWeight: initial?.relevanceWeight ?? 2,
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-center overflow-y-auto bg-black/40 p-4 sm:p-10" onClick={onClose}>
      <div className="card h-fit w-full max-w-2xl p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">{initial ? "Edit requirements" : "Your job"}</h2>
        <p className="mt-1 text-sm text-muted">
          Each requirement becomes one Jev question. Write them as things a resume could show.
        </p>
        <div className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="jd-title">
              Title
            </label>
            <input
              id="jd-title"
              className="input mt-1.5"
              placeholder="Senior Frontend Engineer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-end justify-between">
              <label className="label" htmlFor="jd-text">
                Job description
              </label>
              <button className="btn" onClick={suggest} disabled={!description.trim() || suggesting}>
                {suggesting ? "Reading…" : "Extract requirements"}
              </button>
            </div>
            <textarea
              id="jd-text"
              className="input mt-1.5 min-h-36 font-mono text-[12.5px] leading-relaxed"
              placeholder="Paste a job description, then extract its requirements…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {note && <p className="mt-2 text-xs text-muted">{note}</p>}
          </div>
          <div>
            <p className="label mb-1.5">
              Requirements · {filled.length}/{MAX_REQUIREMENTS}
            </p>
            <RequirementEditor value={reqs} onChange={setReqs} />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-bad">{error}</p>}
        {tooMany && <p className="mt-3 text-sm text-bad">Keep it to {MAX_REQUIREMENTS} requirements.</p>}
        <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={filled.length === 0 || tooMany}>
            {initial ? "Save" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
