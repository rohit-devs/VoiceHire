"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { apiInterviewService as interviewService } from "@/lib/services/apiInterviewService";
import { Loader2, BarChart3, ArrowRight } from "lucide-react";
import type { EvaluationReport } from "@/types";

export default function InterviewCompletePage() {
  const router = useRouter();
  const params = useParams();
  const interviewId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [evaluation, setEvaluation] = useState<EvaluationReport | null>(null);
  const [reportError, setReportError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const evalResult = await interviewService.generateEvaluation(interviewId);
        if (!active) return;
        setEvaluation(evalResult);
      } catch (cause) {
        if (!active) return;
        setReportError(cause instanceof Error ? cause.message : "Evaluation is unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [interviewId]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-6">
            <div className="relative inline-flex">
              <div className="absolute inset-0 rounded-full bg-violet-500/20 blur-xl animate-pulse" />
              <Loader2 className="h-12 w-12 animate-spin text-violet-400 relative z-10" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">Checking interview results</h2>
              <p className="text-sm text-muted-foreground">Looking for analyzed responses before presenting any scores.</p>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-6 max-w-md mx-auto px-6">
          {evaluation ? (
            <>
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                <BarChart3 className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Analysis Complete</h2>
              <p className="text-muted-foreground">Your analyzed interview report is ready.</p>
              <button
                onClick={() => router.push(`/reports/${interviewId}`)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all"
              >
                View Report
                <ArrowRight className="h-5 w-5" />
              </button>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white">Interview saved</h2>
              <p role="status" className="text-muted-foreground">
                {reportError || "insufficient data: no evaluation report is available."}
              </p>
              <button
                onClick={() => router.push("/dashboard")}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-6 py-3 text-base font-semibold text-white hover:bg-white/15 transition-all"
              >
                Return to dashboard
                <ArrowRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
