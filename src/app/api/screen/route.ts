import { ACCEPTED, extractText, guessName, redact } from "@/lib/extract";
import { KeyRejectedError, keyFromRequest, screenResume } from "@/lib/jev";
import { rateLimit } from "@/lib/limit";
import { parseJob } from "@/lib/validate";

const MAX_BYTES = 4 * 1024 * 1024; // Vercel caps request bodies at about 4.5 MB
const MAX_TEXT = 30_000;

// Stateless: extract → redact → one Jev request → return. Nothing is kept.
// Body is multipart: `job` (JSON) plus either `file` or `text` + `fileName`.
export async function POST(req: Request) {
  const limited = rateLimit(req, "screen");
  if (limited) return limited;

  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "Expected form data" }, { status: 400 });
  let jobJson: unknown = null;
  try {
    jobJson = JSON.parse(String(form.get("job") ?? ""));
  } catch {}
  const job = parseJob(jobJson);
  if (!job) return Response.json({ error: "Invalid job or requirements" }, { status: 400 });

  const file = form.get("file");
  let fileName = String(form.get("fileName") ?? "resume.txt").slice(0, 120);
  let raw: string;
  try {
    if (file instanceof File) {
      fileName = file.name;
      if (!ACCEPTED.some((ext) => file.name.toLowerCase().endsWith(ext)))
        return Response.json({ error: "Use PDF, DOCX or TXT" }, { status: 400 });
      if (file.size > MAX_BYTES) return Response.json({ error: "Files must be under 4 MB" }, { status: 400 });
      raw = await extractText(file);
    } else {
      raw = String(form.get("text") ?? "");
    }
  } catch {
    return Response.json({ error: "Could not read this file" }, { status: 422 });
  }
  raw = raw.slice(0, MAX_TEXT);
  if (raw.replace(/\s/g, "").length < 50) {
    return Response.json({ error: "No text found. The file may be a scanned image." }, { status: 422 });
  }

  const displayName = guessName(raw, fileName);
  const redactedText = redact(raw, displayName);
  try {
    const result = await screenResume(job, job.requirements, redactedText, keyFromRequest(req));
    return Response.json({ displayName, fileName, redactedText, ...result });
  } catch (e) {
    const status = e instanceof KeyRejectedError ? 401 : 502;
    return Response.json({ error: e instanceof Error ? e.message : "Screening failed" }, { status });
  }
}
