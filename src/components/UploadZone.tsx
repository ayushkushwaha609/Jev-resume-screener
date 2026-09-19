"use client";

import { useRef, useState } from "react";

const ACCEPT = ".pdf,.docx,.txt,.md";

export function UploadZone({
  onFiles,
  disabled,
  label = "Drop resumes here",
  hint = "PDF, DOCX or TXT · up to 10 at once · 4 MB each",
  multiple = true,
  tall = false,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
  multiple?: boolean;
  tall?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) onFiles(Array.from(e.dataTransfer.files).slice(0, multiple ? undefined : 1));
        }}
        className={`flex w-full flex-col items-center justify-center rounded-lg border border-dashed px-4 text-center transition-colors disabled:opacity-50 ${
          tall ? "py-12" : "py-7"
        } ${over ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-muted"}`}
      >
        <span className="text-sm font-medium">{disabled ? "Limit reached" : label}</span>
        <span className="mt-1 text-xs text-muted">{hint}</span>
      </button>
      <input
        ref={input}
        type="file"
        multiple={multiple}
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
    </div>
  );
}
