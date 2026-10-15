"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { apiInterviewService as interviewService } from "@/lib/services/apiInterviewService";
import { useInterviewStore } from "@/stores/interviewStore";
import { ArrowRight, FileText, Target, Sparkles, Loader2, Activity, BarChart3 } from "lucide-react";

export default function PrepareInterviewPage() {
  const router = useRouter();
  const params = useParams();
  const interviewId = params.id as string;
  const { currentInterview, setInterviewPhase } = useInterviewStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentInterview || currentInterview.id !== interviewId) {
      interviewService.getInterview(interviewId).then((interview) => {
        if (interview) {
          useInterviewStore.getState().setCurrentInterview(interview);
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [interviewId, currentInterview]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
        </div>
      </AppShell>
    );
  }

  const interview = currentInterview;

  if (!interview) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground">Interview not found</p>
        </div>
      </AppShell>
    );
  }

  const steps = [
    { icon: Sparkles, text: "AI asks questions naturally" },
    { icon: FileText, text: "You answer in your own words" },
    { icon: Target, text: "AI adapts follow-up questions" },
    { icon: Activity, text: "Your communication is analyzed" },
    { icon: BarChart3, text: "You receive a personalized report" },
  ];

  return (
    <AppShell>
      <div className="min-h-screen bg-[#0a0a0f]">
        <div className="mx-auto max-w-2xl px-8 py-16">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 border border-violet-500/20 px-4 py-1.5 text-xs font-medium text-violet-300 mb-6">
              <Sparkles className="h-3 w-3" />
              Ready to Begin
            </div>
            <h1 className="text-3xl font-bold text-white mb-3">
              {interview.role} Interview
            </h1>
            <p className="text-muted-foreground">
              {interview.interviewType.replace("_", " ")} • {interview.difficulty} • {interview.duration} min
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8 mb-8">
            <h2 className="text-lg font-semibold text-white mb-6">Interview Details</h2>
            <div className="space-y-4">
              <DetailRow label="Role" value={interview.role} />
              {interview.experienceLevel && <DetailRow label="Experience" value={interview.experienceLevel} />}
              <DetailRow label="Type" value={interview.interviewType.replace("_", " ")} />
              <DetailRow label="Persona" value={interview.persona?.replace("_", " ")} />
              <DetailRow label="Difficulty" value={interview.difficulty} />
              <DetailRow label="Duration" value={`${interview.duration} minutes`} />
              {interview.isDemo && <DetailRow label="Session type" value="Simulated demo" />}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8 mb-8">
            <h2 className="text-lg font-semibold text-white mb-6">How VoiceHire Works</h2>
            <div className="space-y-4">
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20 flex-shrink-0">
                    <span className="text-xs font-bold text-violet-400">{i + 1}</span>
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm text-slate-300">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              setInterviewPhase("live");
              router.push(`/interview/live/${interviewId}`);
            }}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all"
          >
            Enter Interview
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-white capitalize">{value}</span>
    </div>
  );
}
