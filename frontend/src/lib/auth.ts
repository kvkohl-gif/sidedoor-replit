// Auth API client. Every request to /api/auth/* includes credentials so the
// session cookie is sent/received.

export type AuthError = {
  success: false;
  error?: string;
  code?: string;          // backend error code like "email_not_verified"
  message?: string;       // human-readable from backend
  requiresVerification?: boolean;
};
export type AuthOk = { success: true; requiresVerification?: boolean };
export type AuthResult = AuthOk | AuthError;

async function postJson(path: string, body: any): Promise<AuthResult> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data?.success !== false) {
      return { success: true, requiresVerification: !!data?.requiresVerification };
    }
    return {
      success: false,
      error: data?.error || `Request failed (${response.status})`,
      code: data?.error,
      message: data?.message,
    };
  } catch (error) {
    console.error(`[auth] ${path} error:`, error);
    return { success: false, error: "Network error" };
  }
}

export async function registerUser(
  firstName: string,
  lastName: string,
  email: string,
  password: string,
  captchaToken: string,
): Promise<AuthResult> {
  return postJson("/api/auth/register", { firstName, lastName, email, password, captchaToken });
}

export async function loginUser(email: string, password: string): Promise<AuthResult> {
  return postJson("/api/auth/login", { email, password });
}

export async function logoutUser(): Promise<{ success: boolean }> {
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    return { success: response.ok };
  } catch (error) {
    console.error("[auth] logout error:", error);
    return { success: false };
  }
}

export async function verifyEmail(token: string): Promise<AuthResult> {
  return postJson("/api/auth/verify-email", { token });
}

export async function resendVerification(email: string, captchaToken: string): Promise<AuthResult> {
  return postJson("/api/auth/resend-verification", { email, captchaToken });
}
