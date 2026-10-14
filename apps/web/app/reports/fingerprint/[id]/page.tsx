"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { interviewService } from "@/lib/services";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { ArrowRight, Lightbulb } from "lucide-react";
import type { CommunicationFingerprint } from "@/types";

export default function FingerprintPage() {
  const params = useParams();
  const interviewId = params.id as string;
  const [fingerprint, setFingerprint] = useState<CommunicationFingerprint | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    interviewService.getFingerprint(interviewId).then((f) => {
      setFingerprint(f);
      setLoading(false);
    });
  }, [interviewId]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin h-8 w-8 border-2 border-violet-500 border-t-transparent rounded-full" />
        </div>
      </AppShell>
    );
  }

  if (!fingerprint) return null;

  const fingerprintMetrics = [
    { key: "clarity", label: "Clarity", value: fingerprint.clarity, fullMark: 100 },
    { key: "conciseness", label: "Conciseness", value: fingerprint.conciseness, fullMark: 100 },
    { key: "speakingPace", label: "Speaking Pace", value: fingerprint.speakingPace, fullMark: 180 },
    { key: "confidence", label: "Confidence", value: fingerprint.confidence, fullMark: 100 },
    { key: "fillerControl", label: "Filler Control", value: fingerprint.fillerControl, fullMark: 100 },
    { key: "answerStructure", label: "Answer Structure", value: fingerprint.answerStructure, fullMark: 100 },
  ];
  const radarData = fingerprintMetrics.map(({ label, value, fullMark }) => ({
    metric: label,
    value,
    fullMark,
  }));

  return (
    <AppShell>
      <div className="min-h-screen bg-[#0a0a0f]">
        <div className="mx-auto max-w-5xl px-8 py-10">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Communication Fingerprint</h1>
            <p className="text-sm text-muted-foreground mt-1">Your communication patterns across interviews</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Radar Chart */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Metrics Overview</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                    <Radar
                      name="Score"
                      dataKey="value"
                      stroke="#8b5cf6"
                      fill="#8b5cf6"
                      fillOpacity={0.25}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Insights */}
            <div className="space-y-4">
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.03] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="h-4 w-4 text-violet-400" />
                  <h3 className="text-sm font-semibold text-white">Top Observation</h3>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  You have strong technical knowledge but tend to take long pauses before answering. Try to structure your answers using the PREP method.
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Metric Details</h3>
                <div className="space-y-3">
                  {fingerprintMetrics.map(({ key, value }) => (
                    <div key={key} className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-300 capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                        <span className="text-xs font-bold text-white">{value}{key === "speakingPace" ? " WPM" : "%"}</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/[0.08] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-700"
                          style={{ width: `${Math.min(value, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Link href={`/reports/${interviewId}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Back to Report
            </Link>
            <Link
              href="/coach"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all"
            >
              View AI Coach Plan
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
