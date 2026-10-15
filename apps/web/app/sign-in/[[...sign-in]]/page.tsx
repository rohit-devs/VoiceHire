import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  const localDemoEnabled =
    process.env.APP_ENV === "development" &&
    process.env.DEMO_MODE === "true" &&
    !process.env.CLERK_SECRET_KEY &&
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (localDemoEnabled) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4 py-10 text-white">
        <section className="w-full max-w-md space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Local development demo</p>
          <h1 className="text-2xl font-bold">Sign in to VoiceHire</h1>
          <p className="text-sm text-slate-300">
            Clerk is not configured. Continue as the shared local demo user; this mode is not suitable for production or real candidate data.
          </p>
          <Link
            href="/onboarding"
            className="block rounded-xl bg-violet-600 px-5 py-3 text-center font-semibold text-white hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
          >
            Continue as local demo user
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4 py-10">
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" afterSignInUrl="/dashboard" />
    </main>
  );
}
