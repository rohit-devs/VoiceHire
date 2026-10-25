"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { interviewService } from "@/lib/services";
import type { CoachingPlan } from "@/types";
import type { EvaluationReport } from "@/lib/services/interviewService";

export default function CoachPage() {
  const [plan, setPlan] = useState<CoachingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingDay, setSavingDay] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const reports = await interviewService.getUserReports();
      const candidates = reports
        .filter(
          (report: EvaluationReport) =>
            report.status === "completed" && report.ai_assessments && report.provider !== "demo"
        )
        .sort((left, right) => (right.created_at ?? "").localeCompare(left.created_at ?? ""));
      let latestPlan: CoachingPlan | null = null;
      for (const report of candidates) {
        try {
          latestPlan = await interviewService.getCoachingPlan(report.session_id);
          break;
        } catch (cause) {
          if (!(cause instanceof Error) || !cause.message.toLowerCase().includes("not found")) throw cause;
        }
      }
      setPlan(latestPlan);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load your saved coaching plans.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function updateDay(day: number, checked: boolean) {
    if (!plan) return;
    setSavingDay(day);
    setError("");
    try {
      await interviewService.updateCoachingProgress(plan.interviewId, day, checked);
      setPlan({
        ...plan,
        days: plan.days.map((item) => item.day === day ? { ...item, completed: checked } : item),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save coaching progress.");
    } finally {
      setSavingDay(null);
    }
  }

  const completed = plan?.days.filter((day) => day.completed).length ?? 0;
  const total = plan?.totalDays ?? 0;
  const percent = total ? Math.round(completed / total * 100) : 0;

  return (
    <AppShell>
      <main className="min-h-screen bg-[#0a0a0f] px-4 py-8 text-white sm:px-8 sm:py-10">
        <section className="mx-auto max-w-5xl space-y-7">
          <header>
            <h1 className="text-2xl font-bold">Coaching plan</h1>
            <p className="mt-1 text-sm text-slate-300">Plans and progress saved from your completed real evaluations.</p>
          </header>
          {loading ? (
            <div role="status" className="h-40 animate-pulse rounded-xl bg-white/5" aria-label="Loading coaching plan" />
          ) : error ? (
            <div><p role="alert" className="text-sm text-rose-300">{error}</p><button onClick={() => void load()} className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">Retry</button></div>
          ) : !plan ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
              <p role="status" className="text-sm text-slate-300">A personalized coaching plan appears after a real interview has a completed evaluation.</p>
              <Link href="/interview/new" className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">Prepare an interview</Link>
            </div>
          ) : (
            <>
              <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5" aria-label="Coaching progress">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium">Completed {completed} of {total} activities</p>
                  <p className="text-sm text-violet-200">{percent}%</p>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-violet-500" style={{ width: `${percent}%` }} />
                </div>
              </section>
              <ul className="space-y-3">
                {plan.days.map((day) => (
                  <li key={day.day} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={day.completed}
                        disabled={savingDay === day.day}
                        onChange={(event) => void updateDay(day.day, event.target.checked)}
                        aria-label={`Mark day ${day.day}: ${day.title} complete`}
                        className="mt-1 h-4 w-4 accent-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
                      />
                      <span className="min-w-0">
                        <span className="block font-medium">Day {day.day} — {day.title}</span>
                        <span className="mt-1 block text-sm text-slate-300">{day.description}</span>
                        <span className="mt-2 block text-xs text-slate-400">Estimated time: {day.duration}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </main>
    </AppShell>
  );
}
