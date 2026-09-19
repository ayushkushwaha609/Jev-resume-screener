# Sift — resume screening with Jev

Sift ranks applicants against a job's own requirements. It asks [Jev](https://docs.typesafe.ai), TypeSafe's System One model, one small question per requirement and gets back typed answers (probabilities and scored levels), not prose. Plain code turns those answers into a ranking.

- **Must-haves** are Noul questions: the probability the resume shows it.
- **Skills** are Score questions on five described levels, from "not mentioned" to "led architecture with it".
- **Relevance** and **"is this a resume?"** are asked for every resume.
- **Weights** re-rank the list instantly in the browser, with no new model calls.
- **Uncertain answers** (for example a must-have near 0.5) are flagged for human review.
- **Evidence** checks each resume line against one requirement and highlights the lines that support it.
- **Keyword #** shows where a keyword filter would have ranked each resume, for comparison.

Nothing is stored: there are no accounts and no database. Names, emails, phone numbers and links are removed in code before a resume reaches Jev. Results live in the browser tab and can be exported as CSV.

## API keys

Visitors bring their own TypeSafe API key, so screening is billed to them, not to the site owner.

- **Add API key** in the header (or the notice on each page) opens a dialog. The key is checked with one tiny Jev question before it is saved.
- The key stays in the visitor's browser: session storage by default, local storage only if they tick "Remember on this device".
- It is sent with each request in the `x-typesafe-key` header. The server uses it for that one TypeSafe call and never stores, logs or echoes it.
- If a visitor has no key, the server falls back to `TYPESAFE_API_KEY` when the owner sets one; with neither, the app runs in heuristic mode.

## Pages

- `/` — paste or upload a job description, extract its requirements, add resumes, screen.
- `/sample` — a fixed run over one fictional role and eight fictional applicants. It runs only on click.

## Run locally

```bash
npm install
npm run dev
```

Then add your key with **Add API key** in the header. To give every visitor a key instead, put `TYPESAFE_API_KEY=your-key` in `.env.local`.

With no key at all, the app runs in heuristic mode: a keyword matcher answers the questions so the UI still works, and every page says so.

## Deploy

Deploy to Vercel. Leave `TYPESAFE_API_KEY` unset so visitors use their own keys, or set it to pay for everyone's usage. Each resume is sent in its own request and files are capped at 4 MB, to stay under Vercel's request size limit.

Optional per-visitor hourly limits (defaults in brackets): `DEMO_SCREENS_PER_HOUR` (40), `DEMO_SUGGESTS_PER_HOUR` (15), `DEMO_EVIDENCE_PER_HOUR` (40), `DEMO_EXTRACTS_PER_HOUR` (30). They are kept in server memory, so each serverless instance counts separately.

## Code map

- `src/lib/jev.ts` — TypeSafe client and the three Jev workflows: screening, requirement extraction, evidence.
- `src/lib/ranking.ts` — the ranking policy: fit score, must-have states, review flags.
- `src/lib/extract.ts` — PDF/DOCX/TXT text extraction and redaction.
- `src/app/api/*` — stateless routes: `screen`, `suggest`, `evidence`, `extract`, `check-key`.
- `src/lib/userKey.ts` and `src/components/ApiKey.tsx` — the visitor's own key: storage, request header, dialog.
- `src/components/` — the home and sample flows, results workspace and candidate panel.
