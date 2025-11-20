import { Request, Response, NextFunction } from "express";
import { sql } from "../lib/neonClient";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
      } | null;
    }
  }
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

    // Validate session with direct SQL
    const sessions = await sql`
      SELECT user_id FROM sessions WHERE id = ${sessionId}
    `;

    if (sessions.length === 0) {
      req.user = null;
      return next();
    }

    req.user = { id: sessions[0].user_id };
    return next();
  } catch (error) {
    console.error("Session auth error:", error);
    req.user = null;
    return next();
  }
}
