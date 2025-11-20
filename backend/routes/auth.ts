import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { sql } from "../lib/neonClient";

const router = Router();

router.post("/register", async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check if user exists using direct SQL
    const existingUsers = await sql`
      SELECT id FROM users WHERE email = ${email}
    `;

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = nanoid();

    // Create user with direct SQL
    await sql`
      INSERT INTO users (id, first_name, last_name, email, password_hash, created_at, updated_at)
      VALUES (${userId}, ${firstName}, ${lastName}, ${email}, ${passwordHash}, NOW(), NOW())
    `;

    // Create session with direct SQL
    const sessionId = nanoid();
    await sql`
      INSERT INTO sessions (id, user_id, created_at)
      VALUES (${sessionId}, ${userId}, NOW())
    `;

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
    const users = await sql`
      SELECT id, password_hash FROM users WHERE email = ${email}
    `;

    if (users.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = users[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Create session with direct SQL
    const sessionId = nanoid();
    await sql`
      INSERT INTO sessions (id, user_id, created_at)
      VALUES (${sessionId}, ${user.id}, NOW())
    `;

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
      await sql`
        DELETE FROM sessions WHERE id = ${sessionId}
      `;
    }

    res.clearCookie("session_id");

    return res.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
