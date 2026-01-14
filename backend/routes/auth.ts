import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { pool } from "../lib/neonClient";

const router = Router();

router.post("/register", async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check if user exists using direct SQL
    const existingUsersResult = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUsersResult.rows.length > 0) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = nanoid();

    // Create user with direct SQL
    await pool.query(
      "INSERT INTO users (id, first_name, last_name, email, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())",
      [userId, firstName, lastName, email, passwordHash]
    );

    // Create session with direct SQL
    const sessionId = nanoid();
    await pool.query(
      "INSERT INTO sessions (sid, user_id, created_at) VALUES ($1, $2, NOW())",
      [sessionId, userId]
    );

    res.cookie("session_id", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Fetch user with direct SQL
    const usersResult = await pool.query(
      "SELECT id, password_hash FROM users WHERE email = $1",
      [email]
    );

    if (usersResult.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = usersResult.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Create session with direct SQL
    const sessionId = nanoid();
    await pool.query(
      "INSERT INTO sessions (sid, user_id, created_at) VALUES ($1, $2, NOW())",
      [sessionId, user.id]
    );

    res.cookie("session_id", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", async (req: Request, res: Response) => {
  try {
    const sessionId = req.cookies.session_id;

    if (sessionId) {
      // Delete session with direct SQL
      await pool.query(
        "DELETE FROM sessions WHERE sid = $1",
        [sessionId]
      );
    }

    res.clearCookie("session_id");

    return res.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
