"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { interviewService } from "@/lib/services";
import type { PerformanceHistory } from "@/types";

const RANGES = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

export default function ProgressPage() {
  const [history, setHistory] = useState<PerformanceHistory[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setHistory(await interviewService.getPerformanceHistory(days));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load evaluation history.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  return (
    <AppShell>
      <main className="min-h-screen bg-[#0a0a0f] px-4 py-8 text-white sm:px-8 sm:py-10">
        <section className="mx-auto max-w-6xl space-y-6">
          <header>
            <h1 className="text-2xl font-bold">Progress</h1>
            <p className="mt-1 text-sm text-slate-300">
              Saved AI rubric judgments from completed real sessions only. Scores are guidance, not proof of competence.
            </p>
          </header>
          <div className="flex flex-wrap gap-2" aria-label="Progress date range">
            {RANGES.map((range) => (
              <button
                key={range.value}
                aria-pressed={days === range.value}
                onClick={() => setDays(range.value)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300 aria-pressed:border-violet-400 aria-pressed:bg-violet-500/20"
              >
                {range.label}
              </button>
            ))}
          </div>
          {loading ? (
            <div role="status" className="h-72 animate-pulse rounded-xl bg-white/5" aria-label="Loading progress" />
          ) : error ? (
            <div><p role="alert" className="text-sm text-rose-300">{error}</p><button onClick={() => void load()} className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">Retry</button></div>
          ) : history.length === 0 ? (
            <p role="status" className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-300">
              No completed real evaluations are available in this period. Incomplete and simulated sessions are not included.
            </p>
          ) : (
            <>
              <PerformanceChart data={history} />
              <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <h2 className="text-lg font-semibold">Saved completed evaluations</h2>
                <ul className="mt-4 divide-y divide-white/10">
                  {history.map((entry) => (
                    <li key={entry.sessionId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-medium">{entry.role}</p>
                        <time className="text-xs text-slate-300" dateTime={entry.date}>{new Date(entry.date).toLocaleDateString()}</time>
                      </div>
                      <span className="text-sm text-violet-200">AI rubric judgment {entry.overallScore.toFixed(2)} / 5</span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </section>
      </main>
    </AppShell>
  );
}
