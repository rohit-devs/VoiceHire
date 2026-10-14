"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { interviewService } from "@/lib/services";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { TrendingUp } from "lucide-react";
import type { PerformanceHistory } from "@/types";

type MetricKey = "overallScore" | "technical" | "communication" | "clarity" | "conciseness" | "fillerWords" | "speakingPace";

const METRICS: { key: MetricKey; label: string; color: string }[] = [
  { key: "overallScore", label: "Overall Score", color: "#8b5cf6" },
  { key: "technical", label: "Technical", color: "#3b82f6" },
  { key: "communication", label: "Communication", color: "#10b981" },
  { key: "clarity", label: "Clarity", color: "#ec4899" },
  { key: "conciseness", label: "Conciseness", color: "#06b6d4" },
  { key: "fillerWords", label: "Filler Words", color: "#ef4444" },
  { key: "speakingPace", label: "Speaking Pace", color: "#84cc16" },
];

export default function ProgressPage() {
  const [history, setHistory] = useState<PerformanceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState<MetricKey>("overallScore");
  const [timeRange, setTimeRange] = useState("30");

  useEffect(() => {
    interviewService.getPerformanceHistory(30).then((h) => {
      setHistory(h);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin h-8 w-8 border-2 border-violet-500 border-t-transparent rounded-full" />
        </div>
      </AppShell>
    );
  }

  if (history.length === 0) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center px-6">
          <p role="status" className="max-w-lg text-center text-muted-foreground">
            Insufficient verified interview data is available to show progress metrics.
          </p>
        </div>
      </AppShell>
    );
  }

  const metric = METRICS.find((m) => m.key === activeMetric);
  const currentValue = history[history.length - 1]?.[activeMetric];
  const previousValue = history[history.length - 7]?.[activeMetric] || history[0]?.[activeMetric];
  const improvement = previousValue ? ((currentValue - previousValue) / previousValue * 100).toFixed(1) : 0;

  return (
    <AppShell>
      <div className="min-h-screen bg-[#0a0a0f]">
        <div className="mx-auto max-w-6xl px-8 py-10">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Progress Analytics</h1>
            <p className="text-sm text-muted-foreground mt-1">Track your improvement over time</p>
          </div>

          {/* Time Range */}
          <div className="mb-6">
            <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
              {["7", "30", "90", "all"].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
                    timeRange === range
                      ? "bg-violet-500/20 text-violet-300"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {range === "all" ? "All Time" : `${range} Days`}
                </button>
              ))}
            </div>
          </div>

          {/* Improvement Card */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Performance Improvement</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-emerald-400">+{improvement}%</span>
                  <span className="text-xs text-muted-foreground">vs last period</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Your communication score improved by {improvement}% across your recent interviews.</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
          </div>

          {/* Metric Tabs */}
          <div className="mb-5">
            <div className="flex flex-wrap gap-1.5">
              {METRICS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setActiveMetric(m.key)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                    activeMetric === m.key
                      ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                      : "bg-white/5 text-muted-foreground border border-white/10 hover:text-foreground"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">{metric?.label}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Current: {currentValue}{metric?.key === "fillerWords" ? "" : metric?.key === "speakingPace" ? " WPM" : "%"}</p>
              </div>
            </div>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.15)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.15)" fontSize={10} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 15, 20, 0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "10px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey={activeMetric}
                    stroke={metric?.color || "#8b5cf6"}
                    strokeWidth={2}
                    dot={{ fill: metric?.color || "#8b5cf6", strokeWidth: 2, r: 2.5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
