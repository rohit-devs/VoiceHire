"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";

export default function ReportPage() {
  const params = useParams();
  const interviewId = params.id as string;

  return (
    <AppShell>
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-6">
        <section className="max-w-lg space-y-4 text-center">
          <h1 className="text-2xl font-bold text-white">Interview report unavailable</h1>
          <p role="status" className="text-muted-foreground">
            Insufficient verified analysis is available for this interview. No scores or communication
            traits are being shown.
          </p>
          <Link
            href={`/interview/complete/${interviewId}`}
            className="inline-flex rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15"
          >
            Return to interview summary
          </Link>
        </section>
      </main>
    </AppShell>
  );
}
