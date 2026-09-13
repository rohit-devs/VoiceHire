"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";
import type { PerformanceHistory } from "@/types";

interface PerformanceChartProps {
  data: PerformanceHistory[];
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  const chartData = data.slice(-14).map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    score: d.overallScore,
  }));

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-[15px] font-semibold text-white">Performance Trend</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Overall score — last 14 days</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
          <TrendingUp className="h-3.5 w-3.5" />
          <span className="font-semibold">+19%</span>
        </div>
      </div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" stroke="rgba(255,255,255,0.15)" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis domain={[50, 100]} stroke="rgba(255,255,255,0.15)" fontSize={10} tickLine={false} axisLine={false} />
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
    </div>
  );
}
