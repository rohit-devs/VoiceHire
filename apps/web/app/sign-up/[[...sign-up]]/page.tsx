import { SignUp } from "@clerk/nextjs";
import AuthFallback from "@/components/AuthFallback";
import { getAuthMode } from "@/lib/auth-mode";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  const authMode = getAuthMode();
  if (authMode !== "clerk") return <AuthFallback mode={authMode} action="sign-up" />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4 py-10">
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" afterSignUpUrl="/onboarding" />
    </main>
  );
}
