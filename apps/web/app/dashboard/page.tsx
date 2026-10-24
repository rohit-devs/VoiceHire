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
  DashboardHero,
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
      setError(
        cause instanceof Error ? cause.message : "Unable to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ---------- Loading state ----------
  if (loading) {
    return (
      <AppShell>
        <div className="min-h-screen bg-[#050505] p-4 sm:p-8">
          <div className="animate-pulse space-y-8">
            {/* Hero skeleton */}
            <div className="h-64 rounded-3xl bg-white/[0.04]" />
            {/* Metrics */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-32 rounded-2xl bg-white/[0.04]" />
              ))}
            </div>
            {/* Main grid */}
            <div className="grid gap-6 xl:grid-cols-3">
              <div className="xl:col-span-2 space-y-6">
                <div className="h-80 rounded-2xl bg-white/[0.04]" />
                <div className="h-64 rounded-2xl bg-white/[0.04]" />
              </div>
              <div className="h-96 rounded-2xl bg-white/[0.04]" />
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  // ---------- Error state ----------
  if (error) {
    return (
      <AppShell>
        <section className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p role="alert" className="mt-4 max-w-md text-sm text-rose-300">
            {error}
          </p>
          <button
            onClick={() => void load()}
            className="mt-6 rounded-full bg-[#ff2d2d] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#ff4444] hover:shadow-[0_0_30px_rgba(255,45,45,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff2d2d]"
          >
            Retry
          </button>
        </section>
      </AppShell>
    );
  }

  if (!data) return null;

  // ---------- Metrics ----------
  const metrics = [
    {
      label: "Overall Readiness",
      value: data.overallReadiness,
      icon: Target,
    },
    {
      label: "Technical",
      value: data.technicalKnowledge,
      icon: Activity,
    },
    {
      label: "Communication",
      value: data.communication,
      icon: MessageSquare,
    },
    {
      label: "Clarity",
      value: data.clarity,
      icon: Eye,
    },
    {
      label: "Relevance",
      value: data.answerRelevance,
      icon: CheckCircle,
    },
  ];

  return (
    <AppShell>
      <div className="min-h-screen bg-[#050505]">
        {/* Sticky header */}
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#050505]/80 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">
                {data.greeting}
              </h1>
              <p className="mt-0.5 text-xs text-[#8a8a8a]">{data.subtitle}</p>
            </div>

            <Link
              href="/interview/new"
              className="inline-flex items-center gap-2 rounded-full bg-[#ff2d2d] px-5 py-2.5 text-xs font-semibold text-white shadow-[0_0_25px_rgba(255,45,45,0.35)] transition-all hover:bg-[#ff4444] hover:shadow-[0_0_35px_rgba(255,45,45,0.5)]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              New Interview
            </Link>
          </div>
        </header>

        <div className="space-y-8 p-4 sm:p-8">
          {/* Hero */}
          <DashboardHero />

          {/* Metrics Grid */}
          {metrics.some((m) => m.value !== null) ? (
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {metrics.map((metric) =>
                metric.value === null ? null : (
                  <MetricCard
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    icon={metric.icon}
                  />
                )
              )}
            </section>
          ) : (
            <p
              role="status"
              className="rounded-2xl border border-white/[0.06] bg-[#0c0c0c] p-6 text-sm text-[#8a8a8a]"
            >
              No completed real interview evaluations are available yet. Scores
              are not inferred from incomplete sessions or simulated demos.
            </p>
          )}

          {/* Main content */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            {/* Left – chart + recent */}
            <div className="space-y-6 xl:col-span-2">
              <PerformanceChart data={data.performanceHistory} />
              <RecentInterviews interviews={data.recentInterviews} />
            </div>

            {/* Right – insights + coach link */}
            <div className="space-y-5">
              <AIInsights
                insights={data.insights}
                recommendations={data.recommendations}
                strengths={data.strengths}
              />

              <Link
                href="/coach"
                className="group block rounded-2xl border border-white/[0.06] bg-[#0c0c0c] p-5 transition-all hover:border-[#ff2d2d]/40 hover:bg-[#111]"
              >
                <p className="text-sm font-semibold text-white group-hover:text-[#ff2d2d]">
                  View saved coaching plans
                </p>
                <p className="mt-1 text-xs text-[#8a8a8a]">
                  Personalized practice recommendations based on your last
                  evaluations
                </p>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
