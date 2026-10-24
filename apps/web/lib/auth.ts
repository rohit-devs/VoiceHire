/**
 * Better Auth server-side instance for VoiceHire.
 *
 * Adapter strategy:
 *   - Local dev (no DATABASE_URL / SQLite only): memory-adapter (zero native deps)
 *   - Production: swap to drizzle-adapter or prisma-adapter against the real DB
 *
 * JWT plugin:
 *   - alg: RS256  — explicit, matches FastAPI's existing RS256 verification
 *   - expirationTime: "15m" — explicit (same as BA default; documents intent)
 *   - Subject: session.user.id → ends up in JWT "sub" claim → FastAPI reads payload["sub"]
 *
 * Token fetch (client side):
 *   const resp = await fetch("/api/auth/token", { credentials: "include" });
 *   const { token } = await resp.json();
 *   // use as:  Authorization: Bearer <token>
 */

import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { memoryAdapter } from "better-auth/adapters/memory";

export const auth = betterAuth({
  // ── Base URL ─────────────────────────────────────────────────────────────
  // Required for OAuth redirects and cookie domain binding.
  // Falls back to localhost for local dev.
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",

  // ── Secret ───────────────────────────────────────────────────────────────
  secret: process.env.BETTER_AUTH_SECRET,

  // ── Database adapter ─────────────────────────────────────────────────────
  // Memory adapter: works with zero native dependencies.
  // ⚠ State is lost on server restart — only suitable for local dev.
  // For production: replace with drizzleAdapter(db, { provider: "pg" })
  database: memoryAdapter({}),

  // ── Email/password provider ───────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    // Require email verification before sign-in (disable for local dev simplicity)
    requireEmailVerification: false,
  },

  // ── Trusted origins ───────────────────────────────────────────────────────
  // Static array + filter(Boolean) matches exactly the verified API from findings.
  trustedOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    process.env.BETTER_AUTH_URL ?? "",
    process.env.DEV_ALLOWED_ORIGINS ?? "",
  ].filter(Boolean),

  // ── User / session table names ────────────────────────────────────────────
  // Using modelName (CONFIRMED correct API from Phase -1 research).
  // Only matters when the memory-adapter is replaced by a real DB adapter.
  user: {
    modelName: "ba_users",
  },
  session: {
    modelName: "ba_sessions",
  },

  // ── Plugins ───────────────────────────────────────────────────────────────
  plugins: [
    jwt({
      jwks: {
        // EXPLICIT RS256 — matches FastAPI's existing algorithms=["RS256"] verification.
        // BA defaults to EdDSA; we override to avoid updating the Python side.
        keyPairConfig: { alg: "RS256" },
      },
      jwt: {
        // Explicit 15m (same as BA default) — documents intent in code.
        expirationTime: "15m",
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
