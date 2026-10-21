import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import ClerkTokenSync from "@/components/ClerkTokenSync";
import DemoModeBanner from "@/components/DemoModeBanner";
import { getAuthMode } from "@/lib/auth-mode";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://voicehire.app"),
  title: {
    default: "VoiceHire — AI Interviewer & Communication Coach",
    template: "%s | VoiceHire",
  },
  description:
    "Practice role-specific interviews with voice or text, get evidence-backed AI feedback, and track measured speaking metrics.",
  keywords: [
    "AI interview coach",
    "mock interview",
    "voice interview practice",
    "behavioral interview",
    "technical interview",
    "communication coach",
  ],
  authors: [{ name: "VoiceHire" }],
  creator: "VoiceHire",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "VoiceHire",
    title: "VoiceHire — AI Interviewer & Communication Coach",
    description:
      "Role-specific interview practice grounded in your resume. Transcripts, measured metrics, and clearly labeled AI guidance.",
    images: [
      {
        url: "/hero-speaker.jpg",
        width: 1200,
        height: 630,
        alt: "VoiceHire — practice interviews that actually prepare you",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VoiceHire — AI Interviewer & Communication Coach",
    description:
      "Practice role-specific interviews. Get evidence-backed feedback and measured speaking metrics.",
    images: ["/hero-speaker.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authMode = getAuthMode();
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  const useClerk = authMode === "clerk" && Boolean(publishableKey);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[#0a0a0a] text-neutral-200 antialiased">
        <DemoModeBanner />
        {useClerk ? (
          <ClerkProvider
            publishableKey={publishableKey!}
            appearance={{
              variables: {
                colorPrimary: "#e8321e",
                colorBackground: "#0a0a0a",
                colorText: "#e5e5e5",
              },
            }}
          >
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
