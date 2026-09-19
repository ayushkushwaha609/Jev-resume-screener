"use client";

import { useState, useSyncExternalStore } from "react";
import { isRemembered, maskKey, setUserKey, useUserKey, verifyKey } from "@/lib/userKey";

// One dialog for the whole app, opened from the header or from a notice.
let dialogOpen = false;
const listeners = new Set<() => void>();
const setDialog = (open: boolean) => {
  dialogOpen = open;
  listeners.forEach((fn) => fn());
};
export const openKeyDialog = () => setDialog(true);
const useDialogOpen = () =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => dialogOpen,
    () => false,
  );

// Header control: shows whose key is in use and opens the dialog.
export function KeyButton() {
  const key = useUserKey();
  return (
    <button
      onClick={openKeyDialog}
      className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors ${
        key ? "border-line text-muted hover:text-fg" : "border-accent/40 bg-accent-soft text-accent hover:border-accent"
      }`}
    >
      <span className={`size-1.5 rounded-full ${key ? "bg-good" : "bg-accent"}`} />
      {key ? `Your key ${maskKey(key)}` : "Add API key"}
    </button>
  );
}

// Shown on pages when no key is available at all, so screening would fall
// back to the keyword heuristic.
export function KeyNotice({ serverKey }: { serverKey: boolean }) {
  const key = useUserKey();
  if (key || serverKey) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-sm">
      <span>
        <span className="font-medium">Bring your own TypeSafe API key to use Jev.</span>{" "}
        <span className="text-muted">Until then, a keyword heuristic answers the questions, so you can try the UI.</span>
      </span>
      <button className="btn-primary shrink-0" onClick={openKeyDialog}>
        Add your key
      </button>
    </div>
  );
}

export function KeyDialogHost() {
  const open = useDialogOpen();
  return open ? <KeyDialog onClose={() => setDialog(false)} /> : null;
}

function KeyDialog({ onClose }: { onClose: () => void }) {
  const saved = useUserKey();
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(isRemembered);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const key = value.trim();
    if (!key) return;
    setChecking(true);
    setError(null);
    const problem = await verifyKey(key);
    setChecking(false);
    if (problem) return setError(problem);
    setUserKey(key, remember);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]" onClick={onClose}>
      <div className="card w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Your TypeSafe API key</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Screening runs on your own key, so usage is billed to your TypeSafe account. Get one from{" "}
          <a href="https://docs.typesafe.ai" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            TypeSafe
          </a>
          .
        </p>

        {saved && (
          <div className="mt-4 flex items-center justify-between rounded-md border border-line bg-subtle px-3 py-2 text-sm">
            <span>
              In use: <span className="font-mono">{maskKey(saved)}</span>
            </span>
            <button
              className="text-xs text-bad hover:underline"
              onClick={() => {
                setUserKey(null);
                onClose();
              }}
            >
              Remove
            </button>
          </div>
        )}

        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="relative">
            <input
              className="input pr-16 font-mono"
              type={show ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder={saved ? "Paste a new key to replace it" : "Paste your API key"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-fg"
              onClick={() => setShow(!show)}
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember on this device
          </label>
          {error && <p className="text-sm text-bad">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!value.trim() || checking}>
              {checking ? "Checking…" : "Save key"}
            </button>
          </div>
        </form>

        <ul className="mt-5 space-y-1 border-t border-line pt-4 text-xs leading-relaxed text-muted">
          <li>Kept only in this browser: for this tab, or on this device if you tick remember.</li>
          <li>Sent with each request to this app&apos;s server, which passes it to TypeSafe and stores nothing.</li>
          <li>Checked with one tiny Jev question when you save it.</li>
        </ul>
      </div>
    </div>
  );
}
