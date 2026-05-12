import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { supabaseAdmin } from "../lib/supabaseClient";
import { createFreeSubscription } from "../services/creditService";
import { initializeOnboarding } from "../services/onboardingService";
import { verifyTurnstile } from "../lib/turnstile";
import { sendTransactionalEmail } from "../services/emailService";
import { sendPasswordResetEmail, sendWelcomeEmail } from "../services/platformEmails";

const router = Router();

// Bcrypt cost: 12 rounds (~250ms on modern hardware) per OWASP 2024+ guidance.
const BCRYPT_ROUNDS = 12;

// Password requirements: ≥12 chars, must contain at least one letter and one number.
// Matches the registration form's hint text. Reject the most common weak passwords
// outright (defense-in-depth; HIBP k-anon check belongs in the next iteration).
const MIN_PASSWORD_LEN = 12;
const COMMON_WEAK_PATTERNS = [
  /^password/i, /^letmein/i, /^qwerty/i, /^111111/, /^123456/, /^iloveyou/i, /^admin/i,
];
function validatePassword(pw: unknown): string | null {
  if (typeof pw !== "string") return "Password is required";
  if (pw.length < MIN_PASSWORD_LEN) return `Password must be at least ${MIN_PASSWORD_LEN} characters`;
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Password must include at least one letter and one number";
  if (COMMON_WEAK_PATTERNS.some((re) => re.test(pw))) return "Password is too common — please choose another";
  return null;
}

// ─── Email verification helpers ──────────────────────────────────────
// Verification tokens live in the password_reset_tokens-style schema:
// table `email_verification_tokens` (user_id, token, expires_at).
// Token TTL: 48h (so signups overnight don't auto-expire).
const VERIFICATION_TTL_HOURS = 48;

function buildVerifyUrl(token: string): string {
  const base = process.env.APP_URL || "";
  // /verify-email is the SPA route the frontend will mount
  return `${base.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
}

async function issueAndSendVerificationEmail(userId: string, email: string): Promise<void> {
  // Invalidate any prior unused tokens for this user
  await supabaseAdmin.from("email_verification_tokens").delete().eq("user_id", userId);

  const token = nanoid(48);
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_HOURS * 60 * 60 * 1000);
  const { error } = await supabaseAdmin.from("email_verification_tokens").insert({
    id: nanoid(),
    user_id: userId,
    token,
    expires_at: expiresAt.toISOString(),
  });
  if (error) {
    console.error("[auth] failed to insert verification token:", error);
    return;
  }

  const link = buildVerifyUrl(token);
  const send = await sendTransactionalEmail({
    to: email,
    subject: "Verify your SideDoor email",
    html: `<p>Welcome to SideDoor! Confirm your email to activate your account and unlock your free trial credits:</p>
<p><a href="${link}">Verify my email</a></p>
<p>This link expires in ${VERIFICATION_TTL_HOURS} hours. If you didn't sign up, you can ignore this email.</p>`,
    text: `Welcome to SideDoor!\n\nConfirm your email to activate your account: ${link}\n\nThis link expires in ${VERIFICATION_TTL_HOURS} hours.`,
  });
  if (!send.success) {
    console.error(`[auth] failed to send verification email to ${email}: ${send.error}`);
  }
}

// Consistent cookie options for Railway + custom domains
function getSessionCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  };
}

router.post("/register", async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password, captchaToken } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Basic email shape — full RFC validation is overkill, just reject obvious junk
    if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: "Please enter a valid email address" });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ error: pwError });

    // SECURITY (audit C6): CAPTCHA before any DB writes. Bots farming free-tier
    // credits is the #1 launch threat — Turnstile is the cheapest blocker.
    const captcha = await verifyTurnstile(captchaToken, req.ip);
    if (!captcha.ok) {
      return res.status(captcha.status).json({ error: captcha.error });
    }

    // Check if user exists. To prevent email enumeration we DO NOT distinguish
    // "already registered" from "fresh signup" in the response. If the account
    // exists and is unverified, re-send the verification email so a legitimate
    // user who lost the first one can still get in.
    const { data: existingUsers } = await supabaseAdmin
      .from("users")
      .select("id, email_verified")
      .eq("email", normalizedEmail);

    if (existingUsers && existingUsers.length > 0) {
      const existing = existingUsers[0];
      if (!existing.email_verified) {
        // Best-effort resend — don't block the response on it.
        void issueAndSendVerificationEmail(existing.id, normalizedEmail);
      }
      return res.json({ success: true, requiresVerification: true });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const userId = nanoid();

    // Create user — start UNVERIFIED. Trial credits are NOT granted until
    // the user clicks the verification link (see /verify-email below). This
    // makes credit-farming attacks require a working inbox per account.
    const { error: insertError } = await supabaseAdmin
      .from("users")
      .insert({
        id: userId,
        first_name: firstName,
        last_name: lastName,
        email: normalizedEmail,
        password_hash: passwordHash,
        email_verified: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("User insert error:", insertError);
      return res.status(500).json({ error: "Failed to create account" });
    }

    // Send verification email (best-effort; we don't block signup response).
    void issueAndSendVerificationEmail(userId, normalizedEmail);

    // Note: no session cookie issued, no credits granted. The user must click
    // the verification link before they can sign in to a useful account.
    return res.json({ success: true, requiresVerification: true });
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

    const normalizedEmail = String(email).trim().toLowerCase();

    // Fetch user
    const { data: users, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("id, password_hash, email_verified")
      .eq("email", normalizedEmail);

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

    // Reject login until email is verified. We DON'T leak this distinction to
    // unauthenticated probers — but the legitimate-user signal is helpful so
    // we return a specific error code only when the password matched.
    if (user.email_verified === false) {
      // Best-effort resend so the user can recover.
      void issueAndSendVerificationEmail(user.id, normalizedEmail);
      return res.status(403).json({
        error: "email_not_verified",
        message: "Please verify your email — we just re-sent the link.",
      });
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

    res.cookie("session_id", sessionId, getSessionCookieOptions());

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

    // Look up user (normalize email to match register/login)
    const normalizedEmail = String(email).trim().toLowerCase();
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", normalizedEmail);

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

    // Fire-and-forget: send the actual reset email. We don't block the response
    // on it (success path is the same regardless), but we log failures.
    void sendPasswordResetEmail(normalizedEmail, token);
    console.log(`[Password Reset] Token generated for ${normalizedEmail}`);

    if (process.env.NODE_ENV !== "production") {
      // Dev convenience: also echo the link so local development works without
      // a configured email provider.
      return res.json({
        ...successResponse,
        resetLink: `/reset-password?token=${token}`,
      });
    }
    return res.json(successResponse);
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

    const pwError = validatePassword(newPassword);
    if (pwError) return res.status(400).json({ error: pwError });

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
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

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

    // SECURITY: revoke all existing sessions for this user. Otherwise a stolen
    // cookie survives the password reset and the attacker keeps access.
    await supabaseAdmin
      .from("sessions")
      .delete()
      .eq("user_id", resetToken.user_id);

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

    res.clearCookie("session_id", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /verify-email — consume verification token, activate account ───
router.post("/verify-email", async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Token is required" });
    }

    const { data: rows } = await supabaseAdmin
      .from("email_verification_tokens")
      .select("id, user_id, expires_at")
      .eq("token", token);

    const row = rows?.[0];
    if (!row) return res.status(400).json({ error: "Invalid or expired link" });

    if (new Date(row.expires_at) < new Date()) {
      await supabaseAdmin.from("email_verification_tokens").delete().eq("id", row.id);
      return res.status(400).json({ error: "Verification link has expired. Please request a new one." });
    }

    // Activate the user
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ email_verified: true, updated_at: new Date().toISOString() })
      .eq("id", row.user_id);
    if (updateError) {
      console.error("verify-email update error:", updateError);
      return res.status(500).json({ error: "Failed to verify email" });
    }

    // Grant the trial credits + onboarding now (they were withheld at signup
    // to deny credit-farming attacks). Idempotent — if a free subscription
    // already exists this is a no-op, and we treat this as a re-verification
    // (e.g. user clicked the link twice) so we don't re-send the welcome email.
    const { data: existingSub } = await supabaseAdmin
      .from("user_subscriptions")
      .select("id")
      .eq("user_id", row.user_id)
      .single();
    const isFirstVerification = !existingSub;
    if (isFirstVerification) {
      await createFreeSubscription(row.user_id);
      await initializeOnboarding(row.user_id);
    }

    // Send the welcome email on first verification only. Fire-and-forget; we
    // never want a flaky send to block the activation flow.
    if (isFirstVerification) {
      const { data: userRow } = await supabaseAdmin
        .from("users")
        .select("email, first_name")
        .eq("id", row.user_id)
        .single();
      if (userRow?.email) {
        void sendWelcomeEmail(userRow.email, userRow.first_name || undefined);
      }
    }

    // Burn the token + any siblings.
    await supabaseAdmin.from("email_verification_tokens").delete().eq("user_id", row.user_id);

    // Issue a session so the user lands logged in.
    const sessionId = nanoid();
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + 30);
    await supabaseAdmin.from("sessions").insert({
      sid: sessionId,
      sess: {},
      expire: expireDate.toISOString(),
      user_id: row.user_id,
      created_at: new Date().toISOString(),
    });
    res.cookie("session_id", sessionId, getSessionCookieOptions());

    return res.json({ success: true });
  } catch (error) {
    console.error("verify-email error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /resend-verification — for users who lost the original email ───
router.post("/resend-verification", async (req: Request, res: Response) => {
  try {
    const { email, captchaToken } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const captcha = await verifyTurnstile(captchaToken, req.ip);
    if (!captcha.ok) return res.status(captcha.status).json({ error: captcha.error });

    const normalizedEmail = String(email).trim().toLowerCase();
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id, email_verified")
      .eq("email", normalizedEmail);

    // Always respond success — never disclose account existence.
    if (users && users.length > 0 && users[0].email_verified === false) {
      void issueAndSendVerificationEmail(users[0].id, normalizedEmail);
    }
    return res.json({ success: true });
  } catch (error) {
    console.error("resend-verification error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
