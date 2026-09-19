import { KeyRejectedError, findEvidence, keyFromRequest } from "@/lib/jev";
import { rateLimit } from "@/lib/limit";

// Which lines of a (already redacted) resume support one requirement.
export async function POST(req: Request) {
  const limited = rateLimit(req, "evidence");
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  const requirement = typeof body?.requirement === "string" ? body.requirement.trim().slice(0, 300) : "";
  const text = typeof body?.text === "string" ? body.text.slice(0, 30_000) : "";
  if (!requirement || !text) return Response.json({ error: "Missing requirement or text" }, { status: 400 });
  const started = Date.now();
  try {
    const result = await findEvidence({ id: "r", text: requirement, kind: "must", weight: 1, position: 0 }, text, keyFromRequest(req));
    return Response.json({ ...result, ms: Date.now() - started });
  } catch (e) {
    const status = e instanceof KeyRejectedError ? 401 : 502;
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status });
  }
}
