import { Request, Response, NextFunction } from "express";
import { pool } from "../lib/neonClient";

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
    const sessionsResult = await pool.query(
      "SELECT user_id FROM sessions WHERE id = $1",
      [sessionId]
    );

    if (sessionsResult.rows.length === 0) {
      req.user = null;
      return next();
    }

    req.user = { id: sessionsResult.rows[0].user_id };
    return next();
  } catch (error) {
    console.error("Session auth error:", error);
    req.user = null;
    return next();
  }
}
