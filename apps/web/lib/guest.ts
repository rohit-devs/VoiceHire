/**
 * Anonymous guest identity for VoiceHire.
 *
 * Every visitor is treated as a guest. The guest identity is a cryptographically
 * random UUID v4 generated on the client, persisted in localStorage, and sent to
 * the backend as an `X-Guest-Id` header on every API request.
 *
 * Threat model (X-Guest-Id via localStorage):
 *   - Visible to JavaScript running on the page (XSS can read it).
 *   - Not HttpOnly — cannot protect against XSS theft via cookie mechanisms.
 *   - Easily forged by the client — the backend treats it as a bearer credential
 *     but validates it strictly as UUID v4 and never trusts user IDs in request
 *     bodies. Ownership is enforced server-side by matching the guest ID against
 *     the session's owner row.
 *
 * For stronger protection, the backend also issues a Secure, HttpOnly, SameSite=Strict
 * cookie (`vh_guest_id`) that takes precedence over X-Guest-Id. The cookie path is
 * preferred for browser clients; X-Guest-Id is the documented fallback for
 * non-cookie clients (e.g. mobile, curl).
 */

const GUEST_STORAGE_KEY = "vh_guest_id";

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidGuestId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_V4_RE.test(value);
}

export function generateGuestId(): string {
  return crypto.randomUUID();
}

/** Read the guest ID from localStorage, validating it strictly. */
export function getStoredGuestId(): string | null {
  if (typeof localStorage === "undefined") return null;
  const stored = localStorage.getItem(GUEST_STORAGE_KEY);
  return stored && isValidGuestId(stored) ? stored : null;
}

/** Persist a guest ID to localStorage. Creates one if missing or invalid. */
export function getOrCreateGuestId(): string {
  const existing = getStoredGuestId();
  if (existing) return existing;

  const fresh = generateGuestId();
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, fresh);
  } catch {
    // localStorage may be disabled in private browsing; still return the ID.
  }
  return fresh;
}

/** Alias for getOrCreateGuestId — used by API service and hooks. */
export const getGuestId = getOrCreateGuestId;

/** Clear the guest ID from localStorage (sign-out equivalent). */
export function clearGuestId(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(GUEST_STORAGE_KEY);
}

/** Header name used to send the guest ID to the backend. */
export const GUEST_ID_HEADER = "x-guest-id";
