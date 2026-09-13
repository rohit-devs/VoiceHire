"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { interviewService } from "@/lib/services";
import { ArrowRight, Share2, Download } from "lucide-react";
import type { InterviewReport } from "@/types";

export default function ReportPage() {
  const params = useParams();
  const interviewId = params.id as string;
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    interviewService.getReport(interviewId).then((r) => {
      setReport(r);
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

  if (!report) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground">Report not found</p>
        </div>
      </AppShell>
    );
  }

  const scores = [
    { name: "Technical Knowledge", score: report.technicalScore },
    { name: "Communication", score: report.communicationScore },
    { name: "Confidence", score: report.confidenceScore },
    { name: "Clarity", score: report.clarityScore },
    { name: "Problem Solving", score: report.problemSolvingScore },
    { name: "Answer Relevance", score: report.answerRelevanceScore },
  ];

  return (
    <AppShell>
      <div className="min-h-screen bg-[#0a0a0f]">
        <div className="mx-auto max-w-5xl px-8 py-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Interview Report</h1>
              <p className="text-sm text-muted-foreground mt-1">Session {interviewId}</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5">
                <Share2 className="h-3.5 w-3.5" />
                Share
              </button>
              <button className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
            </div>
          </div>

          {/* Hero Score */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 mb-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Overall Score</p>
                <p className="text-5xl font-bold text-white">
                  {report.overallScore}
                  <span className="text-xl text-muted-foreground font-normal">/100</span>
                </p>
                <p className="text-emerald-400 text-sm font-medium mt-1">Good Performance</p>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed max-w-lg">{report.summary}</p>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 mb-6">
            <h2 className="text-base font-semibold text-white mb-5">Score Breakdown</h2>
            <div className="space-y-4">
              {scores.map((item) => (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">{item.name}</span>
                    <span className="text-sm font-semibold text-white">{item.score}/100</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        item.score >= 80 ? "bg-emerald-500" : item.score >= 60 ? "bg-amber-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${item.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Strengths & Improvements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5">
              <h3 className="text-sm font-semibold text-emerald-300 mb-3">Strengths</h3>
              <ul className="space-y-2">
                {report.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-emerald-100">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-5">
              <h3 className="text-sm font-semibold text-amber-300 mb-3">Areas to Improve</h3>
              <ul className="space-y-2">
                {report.improvements.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-100">
                    <span className="text-amber-400 mt-0.5">⚠</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Question Analysis */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 mb-6">
            <h2 className="text-base font-semibold text-white mb-4">Question Analysis</h2>
            <div className="space-y-3">
              {[
                {
                  q: "Why did you choose JWT over session-based authentication?",
                  reason: "We asked this because JWT was mentioned in your resume and the interview was evaluating your understanding of modern authentication patterns.",
                  connection: "Resume: 'Implemented JWT authentication for REST APIs'",
                  skill: "Security & Authentication",
                  criteria: "Strong answer should cover statelessness, scalability, trade-offs vs sessions, and real-world usage.",
                },
                {
                  q: "How does the virtual DOM work in React?",
                  reason: "Core React knowledge question to assess foundational frontend understanding.",
                  connection: "Job requirement: React expertise",
                  skill: "React Fundamentals",
                  criteria: "Should explain reconciliation, diffing algorithm, and performance implications.",
                },
              ].map((item, i) => (
                <QuestionAnalysis key={i} {...item} />
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Link href="/interviews" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Back to Interviews
            </Link>
            <Link
              href={`/reports/fingerprint/${interviewId}`}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all"
            >
              View Communication Fingerprint
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function QuestionAnalysis({ q, reason, connection, skill, criteria }: { q: string; reason: string; connection: string; skill: string; criteria: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{q}</p>
          <p className="text-xs text-muted-foreground mt-1">Evaluated: {skill}</p>
        </div>
        <span className="text-xs text-violet-400 ml-4 flex-shrink-0">
          {expanded ? "Hide" : "Why did you ask that?"}
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-white/5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Reason</p>
            <p className="text-sm text-slate-300">{reason}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Connection</p>
            <p className="text-sm text-slate-300">{connection}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Skill Evaluated</p>
            <p className="text-sm text-slate-300">{skill}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Strong Answer Criteria</p>
            <p className="text-sm text-slate-300">{criteria}</p>
          </div>
        </div>
      )}
    </div>
  );
}
