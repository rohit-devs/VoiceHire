/**
 * Cryptographically random UUID v4 generator.
 *
 * Uses `crypto.randomUUID()` when available (secure contexts: HTTPS / localhost).
 * Falls back to `crypto.getRandomValues()` which works in insecure contexts
 * (plain HTTP on a LAN address). The fallback is a valid RFC 4122 v4 UUID.
 */
export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; // set version to 4
  b[8] = (b[8] & 0x3f) | 0x80; // set variant to 10xx
  const h = [...b].map((x) => x.toString(16).padStart(2, "0"));
  return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h.slice(6, 8).join("")}-${h.slice(8, 10).join("")}-${h.slice(10).join("")}`;
}
