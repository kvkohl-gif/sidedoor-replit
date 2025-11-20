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

    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { data: newUser, error: userError } = await supabaseAdmin
      .from("users")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        password_hash: passwordHash,
      })
      .select("id")
      .single();

    if (userError || !newUser) {
      console.error("User creation error:", userError);
      return res.status(500).json({ error: "Failed to create user" });
    }

    const sessionId = nanoid();
    const { error: sessionError } = await supabaseAdmin
      .from("sessions")
      .insert({
        id: sessionId,
        user_id: newUser.id,
      });

    if (sessionError) {
      console.error("Session creation error:", sessionError);
      return res.status(500).json({ error: "Failed to create session" });
    }

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

    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, password_hash")
      .eq("email", email)
      .single();

    if (userError || !user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const sessionId = nanoid();
    const { error: sessionError } = await supabaseAdmin
      .from("sessions")
      .insert({
        id: sessionId,
        user_id: user.id,
      });

    if (sessionError) {
      console.error("Session creation error:", sessionError);
      return res.status(500).json({ error: "Failed to create session" });
    }

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
      await supabaseAdmin
        .from("sessions")
        .delete()
        .eq("id", sessionId);
    }

    res.clearCookie("session_id");

    return res.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
