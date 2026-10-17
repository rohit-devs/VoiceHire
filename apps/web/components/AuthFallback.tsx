import Link from "next/link";
import type { AuthMode } from "@/lib/auth-mode";

type AuthFallbackProps = {
  mode: AuthMode;
  action: "sign-in" | "sign-up";
};

export default function AuthFallback({ mode, action }: AuthFallbackProps) {
  const localDemo = mode === "local-demo";
  const isSignUp = action === "sign-up";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4 py-10 text-white">
      <section className="w-full max-w-md space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
          {localDemo ? "Local development demo" : "Authentication unavailable"}
        </p>
        <h1 className="text-2xl font-bold">
          {localDemo
            ? isSignUp
              ? "Create an account"
              : "Sign in to VoiceHire"
            : isSignUp
              ? "Sign-up is not configured"
              : "Sign-in is not configured"}
        </h1>
        <p className="text-sm text-slate-300">
          {localDemo
            ? "Clerk is not configured. Continue with the shared local demo user and simulated data only. Do not enter real candidate data."
            : "Configure both Clerk publishable and secret keys to enable account authentication."}
        </p>
        {localDemo && (
          <Link
            href="/onboarding"
            className="block rounded-xl bg-violet-600 px-5 py-3 text-center font-semibold text-white hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
          >
            Continue as local demo user
          </Link>
        )}
        {isSignUp ? (
          <Link
            href="/sign-in"
            className="block text-center text-sm text-violet-200 underline"
          >
            Back to sign in
          </Link>
        ) : (
          <Link
            href="/sign-up"
            className="block text-center text-sm text-violet-200 underline"
          >
            Create an account
          </Link>
        )}
      </section>
    </main>
  );
}
