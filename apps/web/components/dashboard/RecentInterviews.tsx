"use client";

import Link from "next/link";
import { ChevronRight, Clock, Star } from "lucide-react";
import type { InterviewConfig } from "@/types";

interface RecentInterviewsProps {
  interviews: InterviewConfig[];
}

export function RecentInterviews({ interviews }: RecentInterviewsProps) {
  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      technical: "border-blue-500/40 text-blue-300",
      behavioral: "border-emerald-500/40 text-emerald-300",
      hr: "border-violet-500/40 text-violet-300",
      mixed: "border-amber-500/40 text-amber-300",
      system_design: "border-rose-500/40 text-rose-300",
    };
    return colors[type] || "border-neutral-600 text-neutral-300";
  };

  return (
    <div className="relative border border-neutral-800 bg-[#0d0d0d] p-6">
      <span aria-hidden="true" className="absolute left-0 top-0 h-2 w-2 bg-[#e8321e]" />

      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="vh-label text-[10px] font-bold text-[#e8321e]">Sessions</p>
          <h3 className="vh-display mt-1.5 text-3xl text-white">Recent interviews</h3>
        </div>
        <Link
          href="/interviews"
          className="vh-label border-b border-[#e8321e] pb-0.5 text-[10px] font-bold text-[#e8321e] transition-colors hover:text-white hover:border-white"
        >
          View all
        </Link>
      </div>

      <div className="space-y-2">
        {interviews.length === 0 && (
          <p role="status" className="text-sm text-neutral-500">
            Your saved interview sessions will appear here.
          </p>
        )}
        {interviews.map((interview, index) => (
          <Link
            key={interview.id}
            href={interview.currentState === "completed" ? `/reports/${interview.id}` : `/interview/live/${interview.id}`}
            className="group flex items-center justify-between gap-3 border border-neutral-800 bg-[#0a0a0a] p-4 transition-colors duration-200 hover:border-[#e8321e]"
          >
            <div className="flex min-w-0 items-center gap-4">
              {/* Sequence number — the MK-style index */}
              <span aria-hidden="true" className="vh-display w-8 flex-shrink-0 text-2xl text-neutral-700 transition-colors group-hover:text-[#e8321e]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center border border-[#e8321e]/40 bg-[#e8321e]/10 text-[#e8321e] transition-colors group-hover:bg-[#e8321e] group-hover:text-white">
                <Star className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white transition-colors group-hover:text-[#e8321e]">
                  {interview.role}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className={`vh-label border px-2 py-0.5 text-[9px] font-bold ${getTypeColor(interview.interviewType)}`}>
                    {interview.interviewType.replace("_", " ")}
                  </span>
                  {interview.isDemo && (
                    <span className="vh-label bg-[#e8321e] px-2 py-0.5 text-[9px] font-bold text-white">
                      Simulated demo
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-neutral-500">
                    <Clock className="h-3 w-3" />
                    {interview.duration}m
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-3">
              <span className="vh-label hidden text-[9px] text-neutral-500 sm:block">
                {interview.currentState ?? "Status unavailable"}
              </span>
              <ChevronRight className="h-4 w-4 text-neutral-600 transition-all group-hover:translate-x-0.5 group-hover:text-[#e8321e]" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
