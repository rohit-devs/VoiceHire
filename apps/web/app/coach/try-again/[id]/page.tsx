"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { TrendingUp, Mic } from "lucide-react";

export default function TryAgainPage() {
  const [isRecording, setIsRecording] = useState(false);

  const firstAnswer = {
    score: 68,
    clarity: 72,
    conciseness: 60,
    fillerWords: 8,
    confidence: 65,
    transcript: "So, uh, JWT basically stands for JSON Web Token and, you know, it's used for authentication. Basically what happens is, like, the server sends a token to the client and then the client sends it back with every request. It's stateless, which is good. I, uh, I used it in my project because, you know, sessions are hard to scale.",
  };

  const secondAnswer = {
    score: 84,
    clarity: 84,
    conciseness: 78,
    fillerWords: 2,
    confidence: 82,
    transcript: "JWT, or JSON Web Token, is a compact, URL-safe token format used for stateless authentication. The server signs a payload containing claims like user ID and expiry, then sends it to the client. On subsequent requests, the client includes the token in the Authorization header, and the server validates the signature without hitting a session store. I chose JWT for my project because it eliminates server-side session storage, making horizontal scaling straightforward.",
  };

  const improvements = [
    { label: "Clarity", change: "+12%", positive: true },
    { label: "Conciseness", change: "+18%", positive: true },
    { label: "Filler Words", change: "-6", positive: true },
    { label: "Confidence", change: "+17%", positive: true },
  ];

  return (
    <AppShell>
      <div className="min-h-screen bg-[#0a0a0f]">
        <div className="mx-auto max-w-5xl px-8 py-10">
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-white">Try Again</h1>
            <p className="text-muted-foreground mt-2">Compare your answers and see how you improved</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* First Answer */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">First Answer</h3>
                <div className="text-right">
                  <p className="text-3xl font-bold text-amber-400">{firstAnswer.score}</p>
                  <p className="text-xs text-muted-foreground">/100</p>
                </div>
              </div>
              <div className="space-y-3 mb-4">
                <MetricRow label="Clarity" value={firstAnswer.clarity} />
                <MetricRow label="Conciseness" value={firstAnswer.conciseness} />
                <MetricRow label="Filler Words" value={firstAnswer.fillerWords} />
                <MetricRow label="Confidence" value={firstAnswer.confidence} />
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Transcript</p>
                <p className="text-sm text-slate-300 leading-relaxed">{firstAnswer.transcript}</p>
              </div>
            </div>

            {/* Second Answer */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">Second Answer</h3>
                  <span className="text-[10px] font-medium uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Improved
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-emerald-400">{secondAnswer.score}</p>
                  <p className="text-xs text-muted-foreground">/100</p>
                </div>
              </div>
              <div className="space-y-3 mb-4">
                <MetricRow label="Clarity" value={secondAnswer.clarity} />
                <MetricRow label="Conciseness" value={secondAnswer.conciseness} />
                <MetricRow label="Filler Words" value={secondAnswer.fillerWords} />
                <MetricRow label="Confidence" value={secondAnswer.confidence} />
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.02] p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Transcript</p>
                <p className="text-sm text-slate-300 leading-relaxed">{secondAnswer.transcript}</p>
              </div>
            </div>
          </div>

          {/* Improvements */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              Improvements
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {improvements.map((item) => (
                <div key={item.label} className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] p-4 text-center">
                  <p className="text-xs font-medium text-muted-foreground mb-1">{item.label}</p>
                  <p className="text-xl font-bold text-emerald-400">{item.change}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Practice Again */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-violet-500/10 border border-violet-500/20 mb-4">
              <Mic className="h-6 w-6 text-violet-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Practice Another Question</h3>
            <p className="text-sm text-muted-foreground mb-6">Keep practicing to improve your interview skills</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setIsRecording(!isRecording)}
                className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all ${
                  isRecording
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    : "bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg shadow-violet-500/25"
                }`}
              >
                {isRecording ? "Stop Recording" : "Start Recording"}
              </button>
              <Link
                href="/coach"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-all"
              >
                Back to Coach
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs font-bold text-white">{value}{label === "Filler Words" ? "" : "%"}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500" style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}
