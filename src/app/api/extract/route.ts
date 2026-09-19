import { ACCEPTED, extractText } from "@/lib/extract";
import { rateLimit } from "@/lib/limit";

const MAX_BYTES = 4 * 1024 * 1024;

// Turns an uploaded job description file into text. Stateless; no model call.
export async function POST(req: Request) {
  const limited = rateLimit(req, "extract");
  if (limited) return limited;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });
  if (!ACCEPTED.some((ext) => file.name.toLowerCase().endsWith(ext)))
    return Response.json({ error: "Use PDF, DOCX or TXT" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Files must be under 4 MB" }, { status: 400 });
  try {
    const text = await extractText(file);
    if (text.replace(/\s/g, "").length < 20)
      return Response.json({ error: "No text found. The file may be a scanned image." }, { status: 422 });
    return Response.json({ text: text.slice(0, 20_000) });
  } catch {
    return Response.json({ error: "Could not read this file" }, { status: 422 });
  }
}
