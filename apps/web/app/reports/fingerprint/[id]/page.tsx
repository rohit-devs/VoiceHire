"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";

export default function FingerprintPage() {
  const params = useParams();
  const interviewId = params.id as string;

  return (
    <AppShell>
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-6">
        <section className="max-w-lg space-y-5 text-center">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            Communication metrics unavailable
          </h1>
          <p role="status" className="text-sm leading-relaxed text-neutral-400">
            Insufficient verified voice data is available to calculate a communication
            profile. Text is not used to infer confidence, emotion, or vocal tone.
          </p>
          <Link
            href={`/interview/complete/${interviewId}`}
            className="inline-flex rounded-lg border border-neutral-700 bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:border-[#e8321e] hover:bg-[#111] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8321e]"
          >
            Return to interview summary
          </Link>
        </section>
      </main>
    </AppShell>
  );
}