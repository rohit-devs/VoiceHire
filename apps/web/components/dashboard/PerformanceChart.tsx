"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { PerformanceHistory } from "@/types";

interface PerformanceChartProps {
  data: PerformanceHistory[];
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h3 className="text-[15px] font-semibold text-white">Performance Trend</h3>
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          Insufficient verified comparable evaluation history is available.
        </p>
      </div>
    );
  }

  const chartData = data.slice(-14).map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    score: d.overallScore,
    sessionId: d.sessionId,
    role: d.role,
  }));

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="mb-5">
        <h3 className="text-[15px] font-semibold text-white">Performance Trend</h3>
        <p className="text-xs text-muted-foreground mt-0.5">AI rubric score — last 14 days (0–5)</p>
      </div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" stroke="rgba(255,255,255,0.15)" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 5]} stroke="rgba(255,255,255,0.15)" fontSize={10} tickLine={false} axisLine={false} />
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
              dataKey="score"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 2.5 }}
              activeDot={{ r: 4, fill: "#8b5cf6" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="sr-only">Text alternative: {chartData.map((point) => `${point.date}: ${point.score.toFixed(2)} out of 5`).join("; ")}</p>
      <ul aria-label="Evaluation scores by date" className="mt-3 space-y-1 text-xs text-slate-300">
        {chartData.slice(-5).map((point) => (
          <li key={`${point.date}-${point.sessionId}`}>
            {point.date}, {point.role}: AI rubric judgment {point.score.toFixed(2)} out of 5
          </li>
        ))}
      </ul>
    </div>
  );
}
