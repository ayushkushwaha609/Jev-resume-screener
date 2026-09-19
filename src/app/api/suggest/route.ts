import { suggestRequirements } from "@/lib/jev";
import { rateLimit } from "@/lib/limit";

export async function POST(req: Request) {
  const limited = rateLimit(req, "suggest");
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  const description = typeof body?.description === "string" ? body.description.slice(0, 20_000) : "";
  if (!description.trim()) return Response.json({ error: "Paste a job description first" }, { status: 400 });
  try {
    return Response.json(await suggestRequirements(String(body.title ?? ""), description));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 502 });
  }
}
