/**
 * Better Auth browser-side client for VoiceHire.
 *
 * JWT fetch:
 *   The jwtClient() plugin only exposes authClient.jwks() on the client.
 *   To get a JWT for API calls, fetch /api/auth/token directly with session cookies.
 *
 *   Usage:
 *     const token = await getBetterAuthJwt();
 *     // Set Authorization: Bearer <token> on API requests
 */

import { createAuthClient } from "better-auth/client";
import { jwtClient } from "better-auth/client/plugins";

// The client always calls /api/auth/* relative to the current origin.
// No NEXT_PUBLIC_BETTER_AUTH_URL is needed for same-origin usage.
export const authClient = createAuthClient({
  plugins: [jwtClient()],
});

/**
 * Fetch a short-lived RS256 JWT from the BA /token endpoint.
 * Requires an active BA session cookie (set by signIn / signUp).
 * Returns null when there is no active session.
 *
 * The token contains:
 *   sub  — BA user ID  (FastAPI reads payload["sub"])
 *   aud  — audience
 *   exp  — 15 minutes from issue time
 */
export async function getBetterAuthJwt(): Promise<string | null> {
  try {
    const resp = await fetch("/api/auth/token", {
      credentials: "include", // send session cookie
      cache: "no-store",
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { token?: string };
    return data.token ?? null;
  } catch {
    return null;
  }
}

/** Sign in with email + password. Returns error string or null on success. */
export async function betterAuthSignIn(
  email: string,
  password: string,
): Promise<string | null> {
  const { error } = await authClient.signIn.email({ email, password });
  return error?.message ?? null;
}

/** Sign up with email + password + display name. Returns error string or null on success. */
export async function betterAuthSignUp(
  email: string,
  password: string,
  name: string,
): Promise<string | null> {
  const { error } = await authClient.signUp.email({ email, password, name });
  return error?.message ?? null;
}

/** Sign out the current BA session. */
export async function betterAuthSignOut(): Promise<void> {
  await authClient.signOut();
}

/** Get the current BA session (null if not signed in). */
export async function getBetterAuthSession() {
  const { data } = await authClient.getSession();
  return data;
}
