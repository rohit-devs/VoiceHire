import Link from "next/link";
import type { AuthMode } from "@/lib/auth-mode";
import { ROUTES, safeRedirectTarget } from "@/lib/auth-mode";
import { ButtonLink, Card } from "@/components/ui/primitives";

type AuthFallbackProps = {
  mode: AuthMode;
  action: "sign-in" | "sign-up";
  redirectUrl?: string;
};

export default function AuthFallback({ mode, action, redirectUrl }: AuthFallbackProps) {
  const localDemo = mode === "local-demo";
  const betterAuthMode = mode === "better-auth";
  const isSignUp = action === "sign-up";
  const continueTarget = safeRedirectTarget(redirectUrl, ROUTES.onboarding);

  // Better Auth mode: redirect to the native BA form pages
  if (betterAuthMode) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4 py-10 text-white">
        <Card className="w-full max-w-md space-y-5 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#e8321e]">
            VoiceHire accounts
          </p>
          <h1 className="text-2xl font-bold">
            {isSignUp ? "Create your account" : "Sign in to VoiceHire"}
          </h1>
          <p className="text-sm text-slate-300">
            {isSignUp
              ? "Sign up with your email address to start practising interviews."
              : "Sign in with your email address to continue practising."}
          </p>
          <ButtonLink
            href={isSignUp ? `/auth/sign-up${redirectUrl ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : ""}` : `/auth/sign-in${redirectUrl ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : ""}`}
            className="w-full"
          >
            {isSignUp ? "Create account" : "Sign in"}
          </ButtonLink>
          {isSignUp ? (
            <Link href="/sign-in" className="block text-center text-sm text-violet-200 underline">
              Already have an account? Sign in
            </Link>
          ) : (
            <Link href="/sign-up" className="block text-center text-sm text-violet-200 underline">
              Create an account
            </Link>
          )}
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4 py-10 text-white">
      <Card className="w-full max-w-md space-y-5 p-6 sm:p-8">
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
          <ButtonLink
            href={continueTarget}
            className="w-full"
          >
            Continue as local demo user
          </ButtonLink>
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
      </Card>
    </main>
  );
}

