"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { interviewService } from "@/lib/services";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { CoachingPlan } from "@/types";

export default function CoachPage() {
  const [plan, setPlan] = useState<CoachingPlan | null>(null);
  const [activeTab, setActiveTab] = useState("plan");

  useEffect(() => {
    interviewService.getCoachingPlan("int-001").then(setPlan);
  }, []);

  if (!plan) {
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
        <div className="mx-auto max-w-5xl px-8 py-10">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Your AI Coach</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Based on your performance, we created a personalized 7-day improvement plan.
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-white/5 border border-white/10 p-1 rounded-lg">
              <TabsTrigger value="plan" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-300">
                Improvement Plan
              </TabsTrigger>
              <TabsTrigger value="practice" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-300">
                Practice Mode
              </TabsTrigger>
            </TabsList>

            <TabsContent value="plan" className="space-y-6">
              {/* Progress */}
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Weekly Progress</p>
                    <p className="text-2xl font-bold text-white mt-1">Day 2 of 7</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Completion</p>
                    <p className="text-2xl font-bold text-violet-400 mt-1">28%</p>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-500" style={{ width: "28%" }} />
                </div>
              </div>

              {/* Days */}
              <div className="space-y-3">
                {plan.days.map((day) => (
                  <div
                    key={day.day}
                    className={`rounded-xl border p-5 transition-all ${
                      day.completed
                        ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                        : "border-white/[0.08] bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                          day.completed ? "bg-emerald-500/20" : "bg-violet-500/10"
                        }`}>
                          {day.completed ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                          ) : (
                            <span className="text-sm font-bold text-violet-400">{day.day}</span>
                          )}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${day.completed ? "text-emerald-300" : "text-white"}`}>
                            Day {day.day} — {day.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{day.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {day.duration}
                        </span>
                        {!day.completed && (
                          <button className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 px-3 py-1.5 text-xs font-medium text-violet-300 hover:bg-violet-500/20 transition-colors">
                            <Play className="h-3 w-3" />
                            Start
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="practice" className="space-y-6">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8">
                <h3 className="text-lg font-semibold text-white mb-2">Practice Mode</h3>
                <p className="text-sm text-muted-foreground mb-6">Answer interview questions and get instant AI feedback.</p>
                
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6 mb-6">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Question</p>
                  <p className="text-base text-white leading-relaxed">
                    &quot;Explain how JWT authentication works and when you would use it over session-based auth.&quot;
                  </p>
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">01:00</span>
                  </div>
                  <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden max-w-xs">
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 w-0 animate-shimmer" />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all">
                    <Play className="h-4 w-4" />
                    Start Recording
                  </button>
                  <Link
                    href="/coach/try-again/1"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-all"
                  >
                    View Try Again Comparison
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppShell>
  );
}
