import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabaseClient";

// Sessions expire after 14 days of inactivity (sliding window) regardless of
// the absolute 30-day expiry. This limits the blast radius of a stolen cookie.
const IDLE_TIMEOUT_MS = 14 * 24 * 60 * 60 * 1000;

// Throttle the "touch last_activity" write so we don't slam Supabase on every
// request. We only update when the previous activity is more than this old.
const ACTIVITY_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
      } | null;
    }
  }
}

/**
 * Requires the user to be authenticated; returns 401 if not.
 * Must be used AFTER sessionAuth middleware has populated req.user.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export async function sessionAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const sessionId = req.cookies.session_id;

    if (!sessionId) {
      req.user = null;
      return next();
    }

    // Validate session via Supabase — check expiration
    const { data: sessions, error } = await supabaseAdmin
      .from("sessions")
      .select("user_id, expire, last_activity_at")
      .eq("sid", sessionId);

    if (error || !sessions || sessions.length === 0) {
      req.user = null;
      return next();
    }

    // Check if session has expired (absolute)
    const session = sessions[0];
    const now = new Date();
    if (session.expire && new Date(session.expire) < now) {
      await supabaseAdmin.from("sessions").delete().eq("sid", sessionId);
      req.user = null;
      return next();
    }

    // SECURITY (audit M4): idle timeout. If the session hasn't been used in
    // IDLE_TIMEOUT_MS, treat it as expired. last_activity_at may be null on
    // sessions created before this column existed — fall back to expire-30d
    // (i.e., creation time) for that case.
    const lastActivity = session.last_activity_at
      ? new Date(session.last_activity_at)
      : (session.expire ? new Date(new Date(session.expire).getTime() - 30 * 24 * 60 * 60 * 1000) : now);
    if (now.getTime() - lastActivity.getTime() > IDLE_TIMEOUT_MS) {
      await supabaseAdmin.from("sessions").delete().eq("sid", sessionId);
      req.user = null;
      return next();
    }

    req.user = { id: session.user_id };

    // Throttled touch — update last_activity_at at most once per 5 min per session.
    if (now.getTime() - lastActivity.getTime() > ACTIVITY_TOUCH_INTERVAL_MS) {
      // Fire-and-forget; don't block the request on this write.
      supabaseAdmin
        .from("sessions")
        .update({ last_activity_at: now.toISOString() })
        .eq("sid", sessionId)
        .then(({ error }) => { if (error) console.error("[sessionAuth] touch failed:", error.message); });
    }

    return next();
  } catch (error) {
    console.error("Session auth error:", error);
    req.user = null;
    return next();
  }
}
