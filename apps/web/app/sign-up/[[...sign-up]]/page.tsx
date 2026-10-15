import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    const localDemoEnabled =
      process.env.APP_ENV === "development" &&
      process.env.DEMO_MODE === "true" &&
      !process.env.CLERK_SECRET_KEY;
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4 py-10 text-white">
        <section className="w-full max-w-md space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
            {localDemoEnabled ? "Local development demo" : "Authentication unavailable"}
          </p>
          <h1 className="text-2xl font-bold">
            {localDemoEnabled ? "Create an account" : "Sign-up is not configured"}
          </h1>
          <p className="text-sm text-slate-300">
            {localDemoEnabled
              ? "Clerk is not configured. Use the shared local demo user with simulated data only."
              : "Configure Clerk publishable and secret keys to enable account creation."}
          </p>
          {localDemoEnabled && (
            <Link href="/onboarding" className="block rounded-xl bg-violet-600 px-5 py-3 text-center font-semibold text-white hover:bg-violet-500">
              Continue as local demo user
            </Link>
          )}
          <Link href="/sign-in" className="block text-center text-sm text-violet-200 underline">
            Back to sign in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4 py-10">
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" afterSignUpUrl="/onboarding" />
    </main>
  );
}
