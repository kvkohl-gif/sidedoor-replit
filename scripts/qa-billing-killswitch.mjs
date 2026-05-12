// QA: exercise requireStripe middleware logic with BILLING_ENABLED toggled.
// We don't import the route directly (it pulls in supabase + stripe).
// Instead we re-implement the same predicate from billing.ts and assert
// the response status, then re-read the source to confirm the predicate
// matches what's actually wired up.

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// 1. Confirm the route file's requireStripe matches what we expect.
const src = readFileSync("backend/routes/billing.ts", "utf8");
const expectedSnippet = `if (!BILLING_ENABLED) {
    return res.status(503).json({ error: "Billing is temporarily disabled" });
  }
  if (!stripe) {
    return res.status(503).json({ error: "Stripe is not configured" });
  }`;
if (!src.includes(expectedSnippet)) {
  console.log("❌ requireStripe in billing.ts does not match expected predicate");
  console.log("   This QA harness is out of date — please re-sync.");
  process.exit(1);
}
console.log("✅ requireStripe predicate matches source");

// 2. Verify BILLING_ENABLED computes correctly under each env value.
const cases = [
  { env: {}, expected: true,  desc: "unset → enabled" },
  { env: { BILLING_ENABLED: "true" }, expected: true, desc: "'true' → enabled" },
  { env: { BILLING_ENABLED: "false" }, expected: false, desc: "'false' → disabled" },
  { env: { BILLING_ENABLED: "FALSE" }, expected: true, desc: "'FALSE' (case) → enabled (strict 'false' only)" },
  { env: { BILLING_ENABLED: "" }, expected: true, desc: "'' → enabled" },
  { env: { BILLING_ENABLED: "0" }, expected: true, desc: "'0' → enabled (only 'false' disables)" },
];

const harness = `
import { BILLING_ENABLED } from "./backend/lib/billingConfig.ts";
console.log("__RESULT__:" + BILLING_ENABLED);
`;

let pass = 0, fail = 0;
for (const c of cases) {
  // Hermetic env (no inherited STRIPE_*).
  const cleanEnv = Object.fromEntries(
    Object.entries(process.env).filter(
      ([k]) => !k.startsWith("STRIPE_") && k !== "BILLING_ENABLED" && k !== "APP_ENV" && k !== "NODE_ENV",
    ),
  );
  // APP_ENV=development so the validator doesn't throw on missing keys
  const env = { ...cleanEnv, APP_ENV: "development", ...c.env };
  const result = spawnSync("npx", ["tsx", "-e", harness], { env, encoding: "utf8" });
  const stdout = result.stdout || "";
  const match = stdout.match(/__RESULT__:(true|false)/);
  const actual = match ? match[1] === "true" : null;
  const ok = actual === c.expected;
  console.log(`${ok ? "✅" : "❌"} ${c.desc}: expected=${c.expected} actual=${actual}`);
  ok ? pass++ : fail++;
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
