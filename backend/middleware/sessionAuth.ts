import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabaseClient";

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
      .select("user_id, expire")
      .eq("sid", sessionId);

    if (error || !sessions || sessions.length === 0) {
      req.user = null;
      return next();
    }

    // Check if session has expired
    const session = sessions[0];
    if (session.expire && new Date(session.expire) < new Date()) {
      // Clean up expired session
      await supabaseAdmin.from("sessions").delete().eq("sid", sessionId);
      req.user = null;
      return next();
    }

    req.user = { id: session.user_id };
    return next();
  } catch (error) {
    console.error("Session auth error:", error);
    req.user = null;
    return next();
  }
}
