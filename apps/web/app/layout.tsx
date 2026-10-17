import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import ClerkTokenSync from "@/components/ClerkTokenSync";
import DemoModeBanner from "@/components/DemoModeBanner";
import { getAuthMode } from "@/lib/auth-mode";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoiceHire - AI Interview Performance Engine",
  description: "Real-time AI voice interviewer evaluating interview performance",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authMode = getAuthMode();
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <DemoModeBanner />
        {authMode === "clerk" && publishableKey ? (
          <ClerkProvider publishableKey={publishableKey}>
            <ClerkTokenSync />
            {children}
          </ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
