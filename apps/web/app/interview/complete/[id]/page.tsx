"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { apiInterviewService } from "@/lib/services/apiInterviewService";
import { ArrowRight, Loader2 } from "lucide-react";

export default function InterviewCompletePage() {
  const router = useRouter();
  const params = useParams();
  const interviewId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [reportError, setReportError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const interview = await apiInterviewService.getInterview(interviewId);
        if (interview?.isDemo) {
          setReportError("Simulated demo — real evaluations are not generated from simulated sessions.");
          return;
        }
        const report = await apiInterviewService.generateEvaluation(interviewId);
        if (!active) return;
        if (report.status === "completed" || report.status === "insufficient_data") {
          router.replace(`/reports/${interviewId}`);
          return;
        }
        setReportError(report.error || "Evaluation could not be completed.");
        router.replace(`/reports/${interviewId}`);
      } catch (cause: unknown) {
        if (!active) return;
        setReportError(cause instanceof Error ? cause.message : "Verified evaluation is unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [interviewId, router]);

  return (
    <AppShell>
      <main className="flex min-h-screen items-center justify-center px-6">
        <section className="max-w-md space-y-6 text-center">
          {loading ? (
            <>
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-violet-400" />
              <h1 className="text-xl font-semibold text-white">Saving interview</h1>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white">Interview saved</h1>
              <p role="status" className="text-muted-foreground">
                {reportError || "Insufficient verified analysis is available; no evaluation was generated."}
              </p>
              <button
                onClick={() => router.push("/dashboard")}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-6 py-3 text-base font-semibold text-white hover:bg-white/15"
              >
                Return to dashboard
                <ArrowRight className="h-5 w-5" />
              </button>
            </>
          )}
        </section>
      </main>
    </AppShell>
  );
}
