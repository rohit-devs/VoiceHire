"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { interviewService } from "@/lib/services";
import { Search, ChevronRight, Clock, Star } from "lucide-react";
import type { InterviewConfig } from "@/types";

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<InterviewConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void interviewService.getHistory().then((items) => {
      if (active) setInterviews(items);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load interviews.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const filtered = interviews.filter((i) =>
    i.role.toLowerCase().includes(search.toLowerCase())
  );

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      technical: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      behavioral: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      hr: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      mixed: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      system_design: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    };
    return colors[type] || "bg-slate-500/20 text-slate-300 border-slate-500/30";
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin h-8 w-8 border-2 border-violet-500 border-t-transparent rounded-full" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-[#0a0a0f]">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Interview History</h1>
            <p className="text-sm text-muted-foreground mt-1">View and manage your past interviews</p>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                aria-label="Search interviews by role"
                placeholder="Search interviews..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              />
            </div>
          </div>

          {error ? (
            <div>
              <p role="alert" className="text-sm text-rose-300">{error}</p>
              <button onClick={() => window.location.reload()} className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <p role="status" className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-300">
              {interviews.length === 0 ? "You have no saved interviews yet." : "No interviews match your search."}
            </p>
          ) : null}

          {/* Interviews List */}
          <div className="space-y-2">
            {filtered.map((interview) => (
              <Link
                key={interview.id}
                href={interview.currentState === "completed" ? `/reports/${interview.id}` : `/interview/live/${interview.id}`}
                className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.04] group"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/20">
                    <Star className="h-4 w-4 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white group-hover:text-violet-300 transition-colors">
                      {interview.role}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full border ${getTypeColor(interview.interviewType)}`}>
                        {interview.interviewType.replace("_", " ")}
                      </span>
                      {interview.isDemo && <span className="text-[10px] text-amber-200">Simulated demo</span>}
                      <span className="text-xs text-muted-foreground">{interview.currentState ?? "Status unavailable"}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {interview.duration}m
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Score shown in saved report</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
