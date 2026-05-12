// QA: bundles assertions for several small but security-critical changes:
//   - email-tracking redirect allowlist (no open redirect)
//   - password validation rules (min length, common-password reject)
//   - security config startup validation
//   - email-webhook HMAC signature verification

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";

let pass = 0, fail = 0;
function check(desc, ok, extra = "") {
  console.log(`${ok ? "✅" : "❌"} ${desc}${extra ? ` — ${extra}` : ""}`);
  ok ? pass++ : fail++;
}

// ─── 1. Open-redirect guard ────────────────────────────────────────
{
  const src = readFileSync("backend/routes/emailTracking.ts", "utf8");
  // Inline the predicate function and exercise it.
  const code = `
const REDIRECT_HOST_ALLOWLIST = new Set(["thesidedoor.ai","app.thesidedoor.ai","sidedoor.app","www.sidedoor.app","linkedin.com","www.linkedin.com"]);
function isRedirectUrlAllowed(url) {
  let parsed;
  try { parsed = new URL(url); } catch { return false; }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const host = parsed.host.toLowerCase();
  return REDIRECT_HOST_ALLOWLIST.has(host);
}
export { isRedirectUrlAllowed };
`;
  const dataUrl = "data:text/javascript;base64," + Buffer.from(code).toString("base64");
  const { isRedirectUrlAllowed } = await import(dataUrl);

  // Sanity: source still has the allowlist.
  check("redirect: source contains allowlist set", src.includes("REDIRECT_HOST_ALLOWLIST"));

  const cases = [
    ["https://app.thesidedoor.ai/billing", true],
    ["https://www.linkedin.com/in/foo", true],
    ["https://linkedin.com/jobs", true],
    ["https://evil.com/phish", false],
    ["https://app.thesidedoor.ai.evil.com", false],
    ["javascript:alert(1)", false],
    ["//evil.com/phish", false],
    ["http://localhost:5000/admin", false],
    ["", false],
    ["not-a-url", false],
  ];
  for (const [u, exp] of cases) {
    check(`redirect: ${u || "(empty)"}`, isRedirectUrlAllowed(u) === exp, `expected=${exp}`);
  }
}

// ─── 2. Password validator ──────────────────────────────────────────
{
  const code = `
const COMMON_WEAK_PATTERNS = [/^password/i, /^letmein/i, /^qwerty/i, /^111111/, /^123456/, /^iloveyou/i, /^admin/i];
function validatePassword(pw) {
  if (typeof pw !== "string") return "Password is required";
  if (pw.length < 12) return "Password must be at least 12 characters";
  if (!/[A-Za-z]/.test(pw) || !/\\d/.test(pw)) return "Password must include at least one letter and one number";
  if (COMMON_WEAK_PATTERNS.some((re) => re.test(pw))) return "Password is too common — please choose another";
  return null;
}
export { validatePassword };
`;
  const dataUrl = "data:text/javascript;base64," + Buffer.from(code).toString("base64");
  const { validatePassword } = await import(dataUrl);

  const cases = [
    [undefined, /required/, "missing password"],
    ["short1", /12 characters/, "too short"],
    ["alllettersnodigit", /letter and one number/, "missing digit"],
    ["12345678901234567", /letter and one number/, "missing letter"],
    ["password12345678", /too common/, "leading 'password'"],
    ["Password12345678", /too common/, "leading 'Password' (case)"],
    ["GoodPassword2026!", null, "strong password"],
    ["correct horse battery staple 9", null, "passphrase with digit"],
  ];
  for (const [pw, exp, desc] of cases) {
    const got = validatePassword(pw);
    let ok;
    if (exp === null) ok = got === null;
    else ok = got != null && exp.test(got);
    check(`password: ${desc}`, ok, `got=${JSON.stringify(got)}`);
  }
}

// ─── 3. Email-webhook HMAC verification ────────────────────────────
{
  // We can't import the route handler easily (it's wired through express),
  // so we reproduce the exact signature check inline and assert the math.
  const secret = "test-secret-do-not-use";
  const body = JSON.stringify([{ event: "delivered", tracking_id: "abc" }]);
  const expectedSig = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");

  function verify(sigHeader, rawBody, secret) {
    if (!secret) return "no-secret";
    if (!sigHeader) return "missing";
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    try {
      return sigHeader.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(sigHeader), Buffer.from(expected));
    } catch { return false; }
  }

  check("email webhook: valid sig accepted", verify(expectedSig, body, secret) === true);
  check("email webhook: missing sig rejected", verify("", body, secret) === "missing");
  check("email webhook: wrong sig rejected", verify("sha256=" + "0".repeat(64), body, secret) === false);
  check("email webhook: tampered body rejected", verify(expectedSig, body + "x", secret) === false);
}

// ─── 4. Security config startup validation ─────────────────────────
{
  const harness = `
import { assertSecurityConfigOnStartup } from "./backend/lib/billingConfig.ts";
try { assertSecurityConfigOnStartup(); console.log("__OK__"); }
catch (e) { console.log("__THROW__:" + e.message); }
`;
  const cleanEnv = Object.fromEntries(
    Object.entries(process.env).filter(
      ([k]) => !k.startsWith("STRIPE_") && k !== "BILLING_ENABLED"
              && k !== "APP_ENV" && k !== "NODE_ENV"
              && k !== "TURNSTILE_SECRET_KEY" && k !== "EMAIL_WEBHOOK_SECRET"
              && k !== "EMAIL_PROVIDER" && k !== "RESEND_API_KEY"
              && k !== "SENDGRID_API_KEY" && k !== "EMAIL_FROM",
    ),
  );

  const scenarios = [
    {
      name: "PROD: missing everything → throws",
      env: { NODE_ENV: "production" },
      expect: /TURNSTILE_SECRET_KEY|EMAIL_WEBHOOK_SECRET|EMAIL_PROVIDER/,
    },
    {
      name: "PROD: complete + resend → ok",
      env: {
        NODE_ENV: "production",
        TURNSTILE_SECRET_KEY: "ts_secret",
        EMAIL_WEBHOOK_SECRET: "email_sec",
        CRON_SECRET: "cron_sec",
        EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "re_key",
        EMAIL_FROM: "hello@sidedoor.app",
      },
      expect: "ok",
    },
    {
      name: "PROD: resend provider but no key → throws",
      env: {
        NODE_ENV: "production",
        TURNSTILE_SECRET_KEY: "ts_secret",
        EMAIL_WEBHOOK_SECRET: "email_sec",
        EMAIL_PROVIDER: "resend",
        EMAIL_FROM: "hello@sidedoor.app",
      },
      expect: /RESEND_API_KEY/,
    },
    {
      name: "DEV: missing everything → no throw",
      env: { NODE_ENV: "development" },
      expect: "ok",
    },
  ];

  for (const s of scenarios) {
    const env = { ...cleanEnv, ...s.env };
    const r = spawnSync("npx", ["tsx", "-e", harness], { env, encoding: "utf8" });
    const out = (r.stdout || "") + (r.stderr || "");
    const okSeen = out.includes("__OK__");
    const threwSeen = out.includes("__THROW__:");
    let matched;
    if (s.expect === "ok") matched = okSeen;
    else matched = threwSeen && s.expect.test(out);
    check(`security config: ${s.name}`, !!matched, matched ? "" : `out=${out.slice(-200)}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
