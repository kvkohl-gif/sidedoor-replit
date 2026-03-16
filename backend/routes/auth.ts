import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { supabaseAdmin } from "../lib/supabaseClient";

const router = Router();

router.post("/register", async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check if user exists
    const { data: existingUsers } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email);

    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = nanoid();

    // Create user
    const { error: insertError } = await supabaseAdmin
      .from("users")
      .insert({
        id: userId,
        first_name: firstName,
        last_name: lastName,
        email,
        password_hash: passwordHash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("User insert error:", insertError);
      return res.status(500).json({ error: "Failed to create account" });
    }

    // Create session
    const sessionId = nanoid();
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + 30);

    const { error: sessionError } = await supabaseAdmin
      .from("sessions")
      .insert({
        sid: sessionId,
        sess: {},
        expire: expireDate.toISOString(),
        user_id: userId,
        created_at: new Date().toISOString(),
      });

    if (sessionError) {
      console.error("Session insert error:", sessionError);
      return res.status(500).json({ error: "Failed to create session" });
    }

    res.cookie("session_id", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
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

    // Fetch user
    const { data: users, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("id, password_hash")
      .eq("email", email);

    if (fetchError) {
      console.error("Login DB error:", fetchError);
      return res.status(500).json({ error: "Service temporarily unavailable. Please try again." });
    }

    if (!users || users.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = users[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Create session
    const sessionId = nanoid();
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + 30);

    const { error: sessionError } = await supabaseAdmin
      .from("sessions")
      .insert({
        sid: sessionId,
        sess: {},
        expire: expireDate.toISOString(),
        user_id: user.id,
        created_at: new Date().toISOString(),
      });

    if (sessionError) {
      console.error("Session insert error:", sessionError);
      return res.status(500).json({ error: "Failed to create session" });
    }

    res.cookie("session_id", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
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
      await supabaseAdmin
        .from("sessions")
        .delete()
        .eq("sid", sessionId);
    }

    res.clearCookie("session_id");

    return res.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
