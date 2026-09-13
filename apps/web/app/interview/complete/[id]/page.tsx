"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { interviewService } from "@/lib/services";
import { Loader2, BarChart3, ArrowRight } from "lucide-react";

export default function InterviewCompletePage() {
  const router = useRouter();
  const params = useParams();
  const interviewId = params.id as string;
  const [stage, setStage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [evaluation, setEvaluation] = useState<any>(null);

  const stages = [
    "Analyzing transcript...",
    "Evaluating technical answers...",
    "Analyzing communication patterns...",
    "Calculating performance metrics...",
    "Generating coaching plan...",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStage((s) => {
        if (s >= stages.length - 1) {
          clearInterval(interval);
          return s;
        }
        return s + 1;
      });
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (stage >= stages.length - 1 && !evaluation) {
      const timer = setTimeout(async () => {
        const evalResult = await interviewService.generateEvaluation(interviewId);
        setEvaluation(evalResult);
        setLoading(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [stage, evaluation, interviewId]);

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
              <h2 className="text-xl font-semibold text-white mb-2">Analyzing Your Performance</h2>
              <p className="text-sm text-muted-foreground">{stages[stage]}</p>
            </div>
            <div className="flex justify-center gap-1.5">
              {stages.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-8 rounded-full transition-all duration-500 ${
                    i <= stage ? "bg-violet-500" : "bg-white/10"
                  }`}
                />
              ))}
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
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-500/20 border border-emerald-500/30">
            <BarChart3 className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Analysis Complete!</h2>
          <p className="text-muted-foreground">Your interview report is ready. View your detailed performance analysis and personalized coaching plan.</p>
          <button
            onClick={() => router.push(`/reports/${interviewId}`)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all"
          >
            View Report
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </AppShell>
  );
}
