import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { supabaseAdmin } from "../lib/supabaseClient";
import { createFreeSubscription } from "../services/creditService";

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

    // Create free-tier subscription with 50 credits (21-day trial)
    await createFreeSubscription(userId);

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

router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Always return success to prevent email enumeration
    const successResponse = {
      success: true,
      message: "If an account with that email exists, a reset link has been generated.",
    };

    // Look up user
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email);

    if (!users || users.length === 0) {
      return res.json(successResponse);
    }

    const user = users[0];

    // Delete any existing tokens for this user
    await supabaseAdmin
      .from("password_reset_tokens")
      .delete()
      .eq("user_id", user.id);

    // Generate token and expiry (1 hour)
    const token = nanoid(48);
    const tokenId = nanoid();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const { error: tokenError } = await supabaseAdmin
      .from("password_reset_tokens")
      .insert({
        id: tokenId,
        user_id: user.id,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenError) {
      console.error("Token insert error:", tokenError);
      return res.status(500).json({ error: "Internal server error" });
    }

    // TODO: Wire up email sending here. For now, return the link directly.
    console.log(`[Password Reset] Token generated for ${email}: ${token}`);

    return res.json({
      ...successResponse,
      // DEV ONLY: remove resetLink once email sending is wired up
      resetLink: `/reset-password?token=${token}`,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    // Look up token
    const { data: tokens } = await supabaseAdmin
      .from("password_reset_tokens")
      .select("id, user_id, expires_at")
      .eq("token", token);

    if (!tokens || tokens.length === 0) {
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }

    const resetToken = tokens[0];

    // Check expiry
    if (new Date(resetToken.expires_at) < new Date()) {
      await supabaseAdmin
        .from("password_reset_tokens")
        .delete()
        .eq("id", resetToken.id);
      return res.status(400).json({ error: "Reset link has expired. Please request a new one." });
    }

    // Hash new password and update user
    const passwordHash = await bcrypt.hash(newPassword, 10);

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq("id", resetToken.user_id);

    if (updateError) {
      console.error("Password update error:", updateError);
      return res.status(500).json({ error: "Failed to update password" });
    }

    // Delete the used token
    await supabaseAdmin
      .from("password_reset_tokens")
      .delete()
      .eq("id", resetToken.id);

    return res.json({ success: true, message: "Password has been reset successfully." });
  } catch (error) {
    console.error("Reset password error:", error);
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
