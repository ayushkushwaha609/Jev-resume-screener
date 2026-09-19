// Best-effort protection for a public demo's API credits. State lives in
// memory, so each serverless instance counts separately and a cold start
// resets it. Good enough to stop casual abuse, not a determined attacker.

const WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

const LIMITS = {
  screen: Number(process.env.DEMO_SCREENS_PER_HOUR ?? 40),
  suggest: Number(process.env.DEMO_SUGGESTS_PER_HOUR ?? 15),
  evidence: Number(process.env.DEMO_EVIDENCE_PER_HOUR ?? 40),
  extract: Number(process.env.DEMO_EXTRACTS_PER_HOUR ?? 30),
  check: 20,
};

export type Bucket = keyof typeof LIMITS;

function clientIp(req: Request): string {
  return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
}

// Returns a 429 Response when over the limit, otherwise null.
export function rateLimit(req: Request, bucket: Bucket): Response | null {
  const key = `${bucket}:${clientIp(req)}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMITS[bucket]) {
    const retry = Math.ceil((WINDOW_MS - (now - recent[0])) / 60_000);
    return Response.json(
      { error: `Demo limit reached. Try again in about ${retry} minute${retry === 1 ? "" : "s"}.` },
      { status: 429 },
    );
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5_000) hits.clear();
  return null;
}
