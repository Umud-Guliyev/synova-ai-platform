/**
 * Pure auth helpers (no provider imports) so guards, redirects and messages are testable.
 */

/** Only same-origin relative paths are allowed as post-login destinations. */
export function safeRedirect(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.startsWith("/auth") || value.startsWith("/register")) return fallback;
  return value;
}

export type GuardUser = { id: string; is_anonymous?: boolean | undefined } | null;

/** Decides whether a protected page may render. */
export function guardDecision(user: GuardUser, href: string): { allow: true } | { allow: false; redirectTo: string } {
  if (user) return { allow: true };
  return { allow: false, redirectTo: safeRedirect(href) };
}

export function isDemoUser(user: GuardUser): boolean {
  return !!user?.is_anonymous;
}

type AuthErrorLike = { message?: string; status?: number; code?: string; name?: string } | null | undefined;

/** Maps provider errors to clear, user-facing messages. */
export function authErrorMessage(err: AuthErrorLike, mode: "login" | "register" | "demo"): string {
  const msg = (err?.message ?? "").toLowerCase();
  const code = err?.code ?? "";
  const status = err?.status ?? 0;
  if (err?.name === "TypeError" || msg.includes("failed to fetch") || msg.includes("network") || status >= 500 || status === 0 && !msg)
    return "The sign-in service is unavailable right now. Please try again in a moment.";
  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) return "Incorrect email or password.";
  if (code === "user_already_exists" || msg.includes("already registered")) return "An account with this email already exists. Try logging in instead.";
  if (code === "weak_password" || msg.includes("password") && (msg.includes("weak") || msg.includes("pwned") || msg.includes("at least")))
    return "This password is too weak or has appeared in a data breach. Choose a longer, unique password.";
  if (code === "email_address_invalid" || msg.includes("invalid email") || msg.includes("unable to validate email")) return "Enter a valid email address.";
  if (status === 429 || code === "over_request_rate_limit") return "Too many attempts. Please wait a minute and try again.";
  if (code === "anonymous_provider_disabled")
    return "Demo access is disabled in Supabase. Enable Anonymous Sign-Ins in Authentication settings, or log in or register instead.";
  return mode === "register" ? "Registration failed. Please try again." : mode === "demo" ? "Could not start the demo. Please try again." : "Login failed. Please try again.";
}

/** Ordered sign-out: stop queries, clear cache, end the session, then leave with history replace. */
export async function performSignOut(deps: {
  cancelQueries: () => Promise<void>;
  clearCache: () => void;
  signOut: () => Promise<unknown>;
  navigateToAuth: () => void;
}) {
  await deps.cancelQueries();
  deps.clearCache();
  try {
    await deps.signOut();
  } finally {
    deps.navigateToAuth();
  }
}

/** App-level form validation (replaces browser pop-ups). Returns a message or null. */
export function validateCredentials(email: string, password: string, mode: "login" | "register"): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email address.";
  if (!password) return "Enter your password.";
  if (mode === "register" && password.length < 8) return "Use at least 8 characters for your password.";
  return null;
}
