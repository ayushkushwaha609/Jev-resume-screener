import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Groq (gpt-oss-120b) only drafts requirements from a job description. It
  // must never touch screening, ranking or anything Jev judges, so only the
  // suggest route may import it.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/app/api/suggest/route.ts", "src/lib/groq.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/groq", "**/lib/groq", "./groq"],
              message: "Groq may only be used by src/app/api/suggest/route.ts. Screening and ranking are Jev-only.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
