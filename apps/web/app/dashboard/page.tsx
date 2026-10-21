"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { interviewService } from "@/lib/services";
import type { DashboardData } from "@/types";
import {
  MetricCard,
  PerformanceChart,
  RecentInterviews,
  AIInsights,
} from "@/components/dashboard";
import {
  Target,
  MessageSquare,
  Eye,
  CheckCircle,
  Sparkles,
  Activity,
} from "lucide-react";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await interviewService.getDashboardData());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <AppShell>
        <div className="p-4 sm:p-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-64 rounded-lg bg-white/5" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 rounded-xl bg-white/5" />
              ))}
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <section className="p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>
          <button onClick={() => void load()} className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">Retry</button>
        </section>
      </AppShell>
    );
  }
  if (!data) return null;

  const metrics = [
    { label: "Average AI rubric judgment", value: data.overallReadiness, icon: Target, color: "from-violet-500 to-purple-600" },
    { label: "Technical correctness", value: data.technicalKnowledge, icon: Activity, color: "from-blue-500 to-cyan-600" },
    { label: "Communication", value: data.communication, icon: MessageSquare, color: "from-emerald-500 to-green-600" },
    { label: "Structure & clarity", value: data.clarity, icon: Eye, color: "from-pink-500 to-rose-600" },
    { label: "Relevance", value: data.answerRelevance, icon: CheckCircle, color: "from-indigo-500 to-violet-600" },
  ];

  return (
    <AppShell>
      <div className="min-h-screen bg-[#0a0a0f]">
        {/* Header */}
        <header className="border-b border-white/[0.08] bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-30">
          <div className="px-4 py-5 sm:px-8 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-white">{data.greeting}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{data.subtitle}</p>
            </div>
            <Link
              href="/interview/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all"
            >
              <Sparkles className="h-3.5 w-3.5" />
              + New Interview
            </Link>
          </div>
        </header>

        <div className="p-4 sm:p-8 space-y-6">
          {/* Metrics Grid */}
          {metrics.some((metric) => metric.value !== null) ? (
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {metrics.map((metric) => (
                metric.value === null ? null : (
                  <MetricCard
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    icon={metric.icon}
                    color={metric.color}
                  />
                )
              ))}
            </section>
          ) : (
            <p role="status" className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 text-sm text-muted-foreground">
              No completed real interview evaluations are available yet. Scores are not inferred from incomplete sessions or simulated demos.
            </p>
          )}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* Left Column */}
            <div className="xl:col-span-2 space-y-6">
              <PerformanceChart data={data.performanceHistory} />
              <RecentInterviews interviews={data.recentInterviews} />
            </div>

            {/* Right Column */}
            <div className="space-y-5">
              <AIInsights insights={data.insights} recommendations={data.recommendations} strengths={data.strengths} />
              <Link href="/coach" className="block rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm font-medium text-violet-200 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300">
                View saved coaching plans
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
