// QA harness for backend/lib/billingConfig.ts
// Runs the validator under several scenarios with controlled env vars.

import { spawnSync } from "node:child_process";

const SCENARIOS = [
  {
    name: "PROD: missing everything → throws",
    env: { APP_ENV: "production" },
    expect: "throw",
  },
  {
    name: "PROD: test key → throws (must be sk_live_)",
    env: {
      APP_ENV: "production",
      STRIPE_SECRET_KEY: "sk_test_abc",
      STRIPE_WEBHOOK_SECRET: "whsec_xyz",
      STRIPE_STARTER_MONTHLY_PRICE_ID: "price_a",
      STRIPE_STARTER_3MONTH_PRICE_ID: "price_b",
      STRIPE_STARTER_6MONTH_PRICE_ID: "price_c",
      STRIPE_STARTER_ANNUAL_PRICE_ID: "price_d",
      STRIPE_PRO_MONTHLY_PRICE_ID: "price_e",
      STRIPE_PRO_3MONTH_PRICE_ID: "price_f",
      STRIPE_PRO_6MONTH_PRICE_ID: "price_g",
      STRIPE_PRO_ANNUAL_PRICE_ID: "price_h",
      STRIPE_MAX_MONTHLY_PRICE_ID: "price_i",
      STRIPE_MAX_3MONTH_PRICE_ID: "price_j",
      STRIPE_MAX_6MONTH_PRICE_ID: "price_k",
      STRIPE_MAX_ANNUAL_PRICE_ID: "price_l",
    },
    expect: "throw",
  },
  {
    name: "PROD: live key but missing one price → throws",
    env: {
      APP_ENV: "production",
      STRIPE_SECRET_KEY: "sk_live_abc",
      STRIPE_WEBHOOK_SECRET: "whsec_xyz",
      STRIPE_STARTER_MONTHLY_PRICE_ID: "price_a",
      STRIPE_STARTER_3MONTH_PRICE_ID: "price_b",
      STRIPE_STARTER_6MONTH_PRICE_ID: "price_c",
      STRIPE_STARTER_ANNUAL_PRICE_ID: "price_d",
      STRIPE_PRO_MONTHLY_PRICE_ID: "price_e",
      STRIPE_PRO_3MONTH_PRICE_ID: "price_f",
      STRIPE_PRO_6MONTH_PRICE_ID: "price_g",
      STRIPE_PRO_ANNUAL_PRICE_ID: "price_h",
      STRIPE_MAX_MONTHLY_PRICE_ID: "price_i",
      STRIPE_MAX_3MONTH_PRICE_ID: "price_j",
      STRIPE_MAX_6MONTH_PRICE_ID: "price_k",
      // missing STRIPE_MAX_ANNUAL_PRICE_ID
    },
    expect: "throw",
  },
  {
    name: "PROD: malformed price ID → throws",
    env: {
      APP_ENV: "production",
      STRIPE_SECRET_KEY: "sk_live_abc",
      STRIPE_WEBHOOK_SECRET: "whsec_xyz",
      STRIPE_STARTER_MONTHLY_PRICE_ID: "not_a_price",
      STRIPE_STARTER_3MONTH_PRICE_ID: "price_b",
      STRIPE_STARTER_6MONTH_PRICE_ID: "price_c",
      STRIPE_STARTER_ANNUAL_PRICE_ID: "price_d",
      STRIPE_PRO_MONTHLY_PRICE_ID: "price_e",
      STRIPE_PRO_3MONTH_PRICE_ID: "price_f",
      STRIPE_PRO_6MONTH_PRICE_ID: "price_g",
      STRIPE_PRO_ANNUAL_PRICE_ID: "price_h",
      STRIPE_MAX_MONTHLY_PRICE_ID: "price_i",
      STRIPE_MAX_3MONTH_PRICE_ID: "price_j",
      STRIPE_MAX_6MONTH_PRICE_ID: "price_k",
      STRIPE_MAX_ANNUAL_PRICE_ID: "price_l",
    },
    expect: "throw",
  },
  {
    name: "PROD: all valid → ok",
    env: {
      APP_ENV: "production",
      STRIPE_SECRET_KEY: "sk_live_abc",
      STRIPE_WEBHOOK_SECRET: "whsec_xyz",
      STRIPE_STARTER_MONTHLY_PRICE_ID: "price_a",
      STRIPE_STARTER_3MONTH_PRICE_ID: "price_b",
      STRIPE_STARTER_6MONTH_PRICE_ID: "price_c",
      STRIPE_STARTER_ANNUAL_PRICE_ID: "price_d",
      STRIPE_PRO_MONTHLY_PRICE_ID: "price_e",
      STRIPE_PRO_3MONTH_PRICE_ID: "price_f",
      STRIPE_PRO_6MONTH_PRICE_ID: "price_g",
      STRIPE_PRO_ANNUAL_PRICE_ID: "price_h",
      STRIPE_MAX_MONTHLY_PRICE_ID: "price_i",
      STRIPE_MAX_3MONTH_PRICE_ID: "price_j",
      STRIPE_MAX_6MONTH_PRICE_ID: "price_k",
      STRIPE_MAX_ANNUAL_PRICE_ID: "price_l",
    },
    expect: "ok",
  },
  {
    name: "DEV: missing everything → warns, doesn't throw",
    env: { APP_ENV: "development" },
    expect: "warn",
  },
  {
    name: "PROD: BILLING_ENABLED=false → skipped, doesn't throw",
    env: { APP_ENV: "production", BILLING_ENABLED: "false" },
    expect: "disabled",
  },
];

const harness = `
import { assertBillingConfigOnStartup } from "./backend/lib/billingConfig.ts";
try {
  assertBillingConfigOnStartup();
  console.log("__RESULT__:OK");
} catch (e) {
  console.log("__RESULT__:THROW:" + (e instanceof Error ? e.message : String(e)));
}
`;

let pass = 0, fail = 0;
for (const s of SCENARIOS) {
  // Strip any inherited Stripe vars so each scenario is hermetic.
  const cleanEnv = Object.fromEntries(
    Object.entries(process.env).filter(
      ([k]) => !k.startsWith("STRIPE_") && k !== "BILLING_ENABLED" && k !== "APP_ENV" && k !== "NODE_ENV",
    ),
  );
  const env = { ...cleanEnv, ...s.env };
  const result = spawnSync("npx", ["tsx", "-e", harness], { env, encoding: "utf8" });
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  const combined = stdout + stderr;

  let actual;
  if (combined.includes("__RESULT__:THROW")) actual = "throw";
  else if (combined.includes("__RESULT__:OK")) {
    if (combined.includes("[billing] BILLING_ENABLED=false")) actual = "disabled";
    else if (combined.includes("[billing] configuration errors")) actual = "warn";
    else if (combined.includes("[billing] config validated")) actual = "ok";
    else actual = "ok-silent";
  } else {
    actual = "unknown:" + combined.slice(-200);
  }

  const ok = actual === s.expect;
  console.log(`${ok ? "✅" : "❌"} ${s.name}\n   expected=${s.expect} actual=${actual}`);
  ok ? pass++ : fail++;
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
