import { GroqUnavailableError, extractWithGroq, hasGroqKey } from "@/lib/groq";
import { KeyRejectedError, keyFromRequest, suggestRequirements } from "@/lib/jev";
import { rateLimit } from "@/lib/limit";

// Job description → requirement suggestions.
// 1. gpt-oss-120b on Groq, when GROQ_API_KEY is set: rewrites the JD into
//    distinct requirements, each tied to a verified quote from the JD.
// 2. Otherwise, or if Groq is rate limited or down: Jev sorts each JD line.
export async function POST(req: Request) {
  const limited = rateLimit(req, "suggest");
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  const description = typeof body?.description === "string" ? body.description.slice(0, 20_000) : "";
  if (!description.trim()) return Response.json({ error: "Paste a job description first" }, { status: 400 });
  const title = String(body.title ?? "").slice(0, 120);

  let fallback: string | undefined;
  if (hasGroqKey()) {
    try {
      const { requirements: found, unquoted } = await extractWithGroq(title, description);
      if (found.length > 0) {
        return Response.json({
          mode: "groq",
          suggestions: found.map((r) => ({ ...r, confidence: 1 })),
          unquoted,
        });
      }
      fallback = "The extractor found no requirements it could quote from the description.";
    } catch (e) {
      if (!(e instanceof GroqUnavailableError)) throw e;
      fallback = "The requirement extractor is busy right now, so Jev sorted the description line by line instead.";
    }
  }

  try {
    const result = await suggestRequirements(title, description, keyFromRequest(req));
    return Response.json({ ...result, fallback });
  } catch (e) {
    const status = e instanceof KeyRejectedError ? 401 : 502;
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status });
  }
}
