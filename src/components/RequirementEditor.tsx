"use client";

import type { Kind } from "@/lib/ranking";
import { draftKey, type DraftRequirement } from "@/lib/job";

export const KIND_LABEL: Record<Kind, string> = { must: "Must-have", skill: "Skill depth", pref: "Nice-to-have" };
const KIND_HELP: Record<Kind, string> = {
  must: "Yes/no check. Missing ones lower the rank and are flagged, never auto-rejected.",
  skill: "Scored on 5 levels, from not mentioned to led design work with it.",
  pref: "Yes/no check that adds to fit when present.",
};

export function RequirementEditor({
  value,
  onChange,
}: {
  value: DraftRequirement[];
  onChange: (next: DraftRequirement[]) => void;
}) {
  const update = (key: string, patch: Partial<DraftRequirement>) =>
    onChange(value.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          No requirements yet. Extract them from the description or add one.
        </p>
      )}
      {value.map((r) => (
        <div key={r.key} className="card p-3">
          <div className="flex items-start gap-2">
            <input
              className="input flex-1 !py-1.5"
              value={r.text}
              placeholder="e.g. 3+ years building production React apps"
              onChange={(e) => update(r.key, { text: e.target.value })}
            />
            <button
              type="button"
              className="btn-ghost !px-2"
              aria-label="Remove requirement"
              onClick={() => onChange(value.filter((x) => x.key !== r.key))}
            >
              ✕
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="inline-flex rounded-md border border-line p-0.5">
              {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  title={KIND_HELP[k]}
                  onClick={() => update(r.key, { kind: k })}
                  className={`rounded px-2 py-1 text-xs transition-colors ${
                    r.kind === k ? "bg-fg text-bg" : "text-muted hover:text-fg"
                  }`}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-muted">
              Weight
              <input
                type="range"
                min={0}
                max={5}
                value={r.weight}
                onChange={(e) => update(r.key, { weight: Number(e.target.value) })}
                className="w-24"
              />
              <span className="w-3 tabular-nums text-fg">{r.weight}</span>
            </label>
            {r.hint && (
              <span className="min-w-0 max-w-full truncate text-xs text-muted" title={r.hint}>
                {r.hint}
              </span>
            )}
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn w-full border-dashed"
        onClick={() => onChange([...value, { key: draftKey(), text: "", kind: "must", weight: 3 }])}
      >
        + Add requirement
      </button>
    </div>
  );
}
