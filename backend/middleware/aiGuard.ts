import { Request, Response, NextFunction } from "express";

// ─── Per-user AI rate limit ──────────────────────────────────────────
// Prevents a single account from looping AI endpoints to drain our LLM budget.
// Token bucket per userId, in-memory (fine: single Railway replica today, and
// the worst case if we scale horizontally is N× the limit per user, which is
// still bounded). Resets every WINDOW_MS.
const WINDOW_MS = 60_000;             // 1 minute
const MAX_PER_WINDOW = 20;            // 20 AI calls / minute / user
const buckets = new Map<string, { count: number; resetAt: number }>();

export function aiRateLimit(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).user?.id as string | undefined;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const now = Date.now();
  let b = buckets.get(userId);
  if (!b || b.resetAt < now) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(userId, b);
  }
  b.count += 1;

  if (b.count > MAX_PER_WINDOW) {
    const retryAfter = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    return res.status(429).json({
      error: "Too many AI requests. Please slow down and try again shortly.",
      retryAfterSeconds: retryAfter,
    });
  }

  // Opportunistic GC so the map can't grow unbounded.
  if (buckets.size > 10_000) {
    for (const [uid, bucket] of buckets) {
      if (bucket.resetAt < now) buckets.delete(uid);
    }
  }

  next();
}

// ─── Input size caps ─────────────────────────────────────────────────
// LLM input cost is per-token. Without a cap, an attacker can pad
// resume/message fields and burn $$ per request. Reject anything over
// the limit with 413.
export const INPUT_LIMITS = {
  resumeText: 30_000,        // ~6K tokens — generous for long resumes
  message: 10_000,           // ~2K tokens — tone-rewrite input
  bio: 4_000,
  freeText: 2_000,           // misc (jobTitle, recentNews, etc.)
} as const;

export type InputLimitKey = keyof typeof INPUT_LIMITS;

export function assertInputLength(
  res: Response,
  value: unknown,
  limitKey: InputLimitKey,
  fieldName: string,
): boolean {
  if (value == null) return true;
  if (typeof value !== "string") {
    res.status(400).json({ error: `${fieldName} must be a string` });
    return false;
  }
  if (value.length > INPUT_LIMITS[limitKey]) {
    res.status(413).json({
      error: `${fieldName} exceeds the ${INPUT_LIMITS[limitKey]}-character limit`,
    });
    return false;
  }
  return true;
}
