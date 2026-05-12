// Cloudflare Turnstile CAPTCHA verifier.
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
//
// Free, no account approval, drop-in widget on the frontend.
// Operator setup:
//   1. Sign up at https://dash.cloudflare.com/?to=/:account/turnstile (free).
//   2. Add a site, get a sitekey + secret.
//   3. Set TURNSTILE_SECRET_KEY in Railway env. Set VITE_TURNSTILE_SITE_KEY
//      so the frontend can render the widget.
//   4. The frontend includes the rendered token in `req.body.captchaToken`.
//
// Behavior in this code:
//   - In production: TURNSTILE_SECRET_KEY required. Missing → 503.
//   - In dev: missing secret logs a warning and accepts the request.

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileVerdict =
  | { ok: true }
  | { ok: false; status: 503 | 400 | 401; error: string };

export async function verifyTurnstile(token: unknown, remoteip?: string): Promise<TurnstileVerdict> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const isProd = process.env.NODE_ENV === "production";

  if (!secret) {
    if (isProd) {
      return { ok: false, status: 503, error: "captcha_not_configured" };
    }
    console.warn("[turnstile] TURNSTILE_SECRET_KEY not set — bypassing CAPTCHA (dev only)");
    return { ok: true };
  }

  if (typeof token !== "string" || token.length === 0 || token.length > 4096) {
    return { ok: false, status: 400, error: "captcha_token_missing" };
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (remoteip) body.set("remoteip", remoteip);

    const r = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      // Cloudflare Turnstile is tolerant; cap our wait so a flaky upstream
      // can't hang signup forever.
      signal: AbortSignal.timeout(8000),
    });
    const json = (await r.json()) as { success?: boolean; "error-codes"?: string[] };
    if (json.success) return { ok: true };
    return { ok: false, status: 401, error: `captcha_failed: ${(json["error-codes"] ?? []).join(",") || "unknown"}` };
  } catch (err: any) {
    // Network blip / timeout. Fail closed in prod (better to block one signup
    // than wave through a bot wave); fail open in dev for ergonomics.
    if (isProd) return { ok: false, status: 401, error: "captcha_check_failed" };
    console.warn("[turnstile] verify network error (dev) — allowing:", err?.message);
    return { ok: true };
  }
}
