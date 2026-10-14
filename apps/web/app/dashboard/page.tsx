"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { getDashboardData } from "@/lib/mock/mockDashboardService";
import type { DashboardData } from "@/types";
import {
  MetricCard,
  PerformanceChart,
  RecentInterviews,
  AIInsights,
  CoachingProgress,
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

  useEffect(() => {
    getDashboardData().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div className="p-8">
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

  if (!data) return null;

  const metrics = [
    { label: "Overall Readiness", value: data.overallReadiness, icon: Target, color: "from-violet-500 to-purple-600" },
    { label: "Technical Knowledge", value: data.technicalKnowledge, icon: Activity, color: "from-blue-500 to-cyan-600" },
    { label: "Communication", value: data.communication, icon: MessageSquare, color: "from-emerald-500 to-green-600" },
    { label: "Clarity", value: data.clarity, icon: Eye, color: "from-pink-500 to-rose-600" },
    { label: "Answer Relevance", value: data.answerRelevance, icon: CheckCircle, color: "from-indigo-500 to-violet-600" },
  ];

  return (
    <AppShell>
      <div className="min-h-screen bg-[#0a0a0f]">
        {/* Header */}
        <header className="border-b border-white/[0.08] bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-30">
          <div className="px-8 py-5 flex items-center justify-between">
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

        <div className="p-8 space-y-6">
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
              Insufficient verified interview data is available to calculate performance scores.
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
              <AIInsights insights={data.insights} recommendations={data.recommendations} />
              <CoachingProgress />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
