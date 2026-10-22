import { SignUp } from "@clerk/nextjs";
import AuthFallback from "@/components/AuthFallback";
import { getAuthMode } from "@/lib/auth-mode";
import Link from "next/link";
import { Mic } from "lucide-react";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  const authMode = getAuthMode();
  if (authMode !== "clerk") {
    return <AuthFallback mode={authMode} action="sign-up" redirectUrl="/onboarding" />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-3">
        <Link href="/" className="flex items-center gap-2.5 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8321e]">
          <span className="flex h-9 w-9 items-center justify-center bg-[#e8321e]" aria-hidden>
            <Mic className="h-4 w-4 text-white" />
          </span>
          <span className="text-xl font-bold tracking-wide text-white">
            Voice<span className="text-[#e8321e]">Hire</span>
          </span>
        </Link>
        <p className="text-sm text-neutral-400">Create your account to start practicing</p>
      </div>

      <div className="w-full max-w-md">
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          fallbackRedirectUrl="/onboarding"
          forceRedirectUrl="/onboarding"
          appearance={{
            variables: {
              colorPrimary: "#e8321e",
              colorBackground: "#0a0a0a",
              colorText: "#e5e5e5",
              colorTextSecondary: "#a3a3a3",
              colorInputBackground: "#141414",
              colorInputText: "#e5e5e5",
              borderRadius: "0.5rem",
            },
            elements: {
              card: "bg-[#0d0d0d] border border-neutral-800 shadow-none",
              headerTitle: "text-white",
              headerSubtitle: "text-neutral-400",
              socialButtonsBlockButton: "border-neutral-700 bg-neutral-900 text-white hover:bg-neutral-800",
              formButtonPrimary: "bg-[#e8321e] hover:bg-[#ff3b2d] text-white",
              footerActionLink: "text-[#e8321e] hover:text-[#ff3b2d]",
            },
          }}
        />
        <div className="mt-4 text-center">
          <Link
            href="/sign-in"
            className="text-xs text-neutral-400 hover:text-white underline underline-offset-4"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}