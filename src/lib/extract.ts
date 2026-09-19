import { extractText as extractPdfText } from "unpdf";
import mammoth from "mammoth";

export const ACCEPTED = [".pdf", ".docx", ".txt", ".md"];

export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".pdf")) {
    const { text } = await extractPdfText(new Uint8Array(buf), { mergePages: true });
    return clean(text);
  }
  if (name.endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return clean(value);
  }
  if (name.endsWith(".txt") || name.endsWith(".md")) return clean(buf.toString("utf8"));
  throw new Error(`Unsupported file type: ${file.name}`);
}

function clean(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------- redaction
// Identity details are removed in code so the model never sees them.

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b(?:linkedin|github|gitlab|behance|dribbble)\.com\/\S*/gi;
const PHONE = /(?:[+(]?\d[\d\s().-]{7,}\d)/g;
const PERSONAL_LINE =
  /^\s*(date of birth|dob|born|age|gender|sex|marital status|nationality|religion|citizenship|address|pronouns)\b.*$/gim;

export function guessName(text: string, fileName: string): string {
  const first = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  if (/^[\p{L}][\p{L}'’. -]{1,40}$/u.test(first) && first.split(/\s+/).length <= 5) return titleCase(first);
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\b(resume|cv)\b/gi, "").trim() || fileName;
}

function titleCase(s: string) {
  return s === s.toUpperCase() ? s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : s;
}

export function redact(text: string, name: string): string {
  let out = text
    .replace(EMAIL, "[email]")
    .replace(URL_RE, "[link]")
    .replace(PHONE, (m) => (isPhone(m) ? "[phone]" : m))
    .replace(PERSONAL_LINE, "[personal detail removed]");
  for (const part of name.split(/\s+/).filter((p) => p.length > 1)) {
    out = out.replace(new RegExp(`\\b${escapeRe(part)}\\b`, "gi"), "[name]");
  }
  return out;
}

// Year ranges like "2019 - 2021" look like phone numbers to the regex.
function isPhone(m: string) {
  return m.replace(/\D/g, "").length >= 9 && !/^(\d{4}\D+)*\d{4}$/.test(m.trim());
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
