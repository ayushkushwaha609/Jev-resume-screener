import { KeyRejectedError, USER_KEY_HEADER, checkKey } from "@/lib/jev";
import { rateLimit } from "@/lib/limit";

// Validates a visitor's own key with one tiny Jev question, billed to that
// key. Only the header key is checked, never the site owner's.
export async function POST(req: Request) {
  const limited = rateLimit(req, "check");
  if (limited) return limited;
  const key = req.headers.get(USER_KEY_HEADER)?.trim();
  if (!key || !/^[\x21-\x7e]{8,512}$/.test(key)) {
    return Response.json({ ok: false, error: "That doesn't look like an API key." }, { status: 400 });
  }
  try {
    await checkKey(key);
    return Response.json({ ok: true });
  } catch (e) {
    const rejected = e instanceof KeyRejectedError;
    return Response.json(
      { ok: false, error: rejected ? e.message : "Couldn't reach TypeSafe. Try again in a moment." },
      { status: rejected ? 401 : 502 },
    );
  }
}
