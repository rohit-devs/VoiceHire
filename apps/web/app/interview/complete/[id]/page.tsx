"use client";

import { useCallback, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { apiInterviewService } from "@/lib/services/apiInterviewService";
import { ArrowRight, Loader2, RotateCw } from "lucide-react";

type PageStatus = "loading" | "success" | "error";

export default function InterviewCompletePage() {
  const router = useRouter();
  const params = useParams();
  const interviewId = params.id as string;
  const [status, setStatus] = useState<PageStatus>("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const interview = await apiInterviewService.getInterview(interviewId);
      if (!interview) throw new Error("Interview session was not found.");
      const report = await apiInterviewService.generateEvaluation(interviewId);
      if (report.status === "completed" || report.status === "insufficient_data") {
        setStatus("success");
        return;
      }
      setStatus("error");
      setError(report.error || "Evaluation could not be completed.");
    } catch (cause: unknown) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Evaluation is unavailable.");
    }
  }, [interviewId]);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = useCallback(() => {
    void load();
  }, [load]);

  return (
    <AppShell>
      <main className="flex min-h-screen items-center justify-center px-6">
        <section className="max-w-md space-y-6 text-center">
          {status === "loading" ? (
            <>
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-violet-400" />
              <h1 className="text-xl font-semibold text-white">Finalizing your interview</h1>
            </>
          ) : status === "success" ? (
            <>
              <h1 className="text-2xl font-bold text-white">Interview saved</h1>
              <p className="text-muted-foreground">
                Your evaluation is ready. Open the report to review your scores and coaching plan.
              </p>
              <button
                onClick={() => router.push(`/reports/${interviewId}`)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#e8321e] px-6 py-3 text-base font-semibold text-white hover:bg-[#ff3b2d]"
              >
                View report
                <ArrowRight className="h-5 w-5" />
              </button>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white">We could not complete your evaluation</h1>
              <p role="alert" className="max-w-md text-muted-foreground">
                {error || "Something went wrong. Please try again."}
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={retry}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#262626] px-6 py-3 text-base font-semibold text-white hover:bg-white/10"
                >
                  <RotateCw className="h-5 w-5" />
                  Try again
                </button>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-6 py-3 text-base font-semibold text-white hover:bg-white/15"
                >
                  Return to dashboard
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </>
          )}
        </section>
      </main>
    </AppShell>
  );
}
