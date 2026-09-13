"use client";

import { CheckCircle2, Circle } from "lucide-react";

export function CoachingProgress() {
  const days = [
    { day: 1, title: "Answer Structure", completed: true },
    { day: 2, title: "Filler Words", completed: true },
    { day: 3, title: "Conciseness", completed: false },
    { day: 4, title: "System Design", completed: false },
    { day: 5, title: "Problem Solving", completed: false },
    { day: 6, title: "Mock Interview", completed: false },
    { day: 7, title: "Review & Improve", completed: false },
  ];

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold text-white">7-Day Coaching Plan</h3>
        <span className="text-xs text-muted-foreground">Day 2 of 7</span>
      </div>

      <div className="flex items-center gap-2 mb-5">
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500" style={{ width: "28%" }} />
        </div>
        <span className="text-xs text-muted-foreground">28%</span>
      </div>

      <div className="space-y-2">
        {days.map((day) => (
          <div
            key={day.day}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
              day.completed
                ? "bg-emerald-500/10 border border-emerald-500/20"
                : "bg-white/[0.02] border border-transparent"
            }`}
          >
            {day.completed ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${day.completed ? "text-emerald-300" : "text-slate-300"}`}>
                Day {day.day} — {day.title}
              </p>
            </div>
            {day.completed && (
              <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-400">Done</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
