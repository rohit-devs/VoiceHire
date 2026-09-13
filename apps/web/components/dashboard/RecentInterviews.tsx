"use client";

import Link from "next/link";
import { ChevronRight, Clock, Star } from "lucide-react";
import type { InterviewConfig } from "@/types";

interface RecentInterviewsProps {
  interviews: InterviewConfig[];
}

export function RecentInterviews({ interviews }: RecentInterviewsProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-amber-400";
    return "text-rose-400";
  };

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

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Recent Interviews</h3>
        <Link href="/interviews" className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
          View all
        </Link>
      </div>
      <div className="space-y-3">
        {interviews.map((interview) => (
          <Link
            key={interview.id}
            href={`/reports/${interview.id}`}
            className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 transition-all duration-200 hover:border-white/15 hover:bg-white/[0.04] group"
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
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {interview.duration}m
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-lg font-bold ${getScoreColor(82)}`}>82</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
