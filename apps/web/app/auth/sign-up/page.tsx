"use client";

/**
 * Better Auth native sign-up page.
 * Only reachable when authMode === "better-auth" (BETTER_AUTH_SECRET is set, Clerk is not).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mic, Loader2 } from "lucide-react";
import { betterAuthSignUp } from "@/lib/auth-client";
import { ROUTES } from "@/lib/auth-mode";
import { Button, Card, Input } from "@/components/ui/primitives";

export default function BetterAuthSignUpPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const err = await betterAuthSignUp(email, password, name);
      if (err) {
        setError(err);
      } else {
        router.replace(ROUTES.onboarding);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8321e]"
        >
          <span
            className="flex h-9 w-9 items-center justify-center bg-[#e8321e]"
            aria-hidden
          >
            <Mic className="h-4 w-4 text-white" />
          </span>
          <span className="text-xl font-bold tracking-wide text-white">
            Voice<span className="text-[#e8321e]">Hire</span>
          </span>
        </Link>
        <p className="text-sm text-neutral-400">Create your account to start practising</p>
      </div>

      <Card className="w-full max-w-md p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <h1 className="text-xl font-bold text-white">Create account</h1>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-red-800 bg-red-900/30 px-4 py-2 text-sm text-red-300"
            >
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="ba-signup-name"
              className="block text-xs font-semibold uppercase tracking-widest text-neutral-400"
            >
              Display name
            </label>
            <Input
              id="ba-signup-name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="ba-signup-email"
              className="block text-xs font-semibold uppercase tracking-widest text-neutral-400"
            >
              Email
            </label>
            <Input
              id="ba-signup-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="ba-signup-password"
              className="block text-xs font-semibold uppercase tracking-widest text-neutral-400"
            >
              Password
            </label>
            <Input
              id="ba-signup-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-neutral-400">
          Already have an account?{" "}
          <Link
            href="/auth/sign-in"
            className="text-[#e8321e] underline underline-offset-4 hover:text-[#ff3b2d]"
          >
            Sign in
          </Link>
        </p>
      </Card>
    </main>
  );
}
