"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { PerformanceHistory } from "@/types";

interface PerformanceChartProps {
  data: PerformanceHistory[];
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  if (data.length === 0) {
    return (
      <div className="relative border border-neutral-800 bg-[#0d0d0d] p-5">
        <span aria-hidden="true" className="absolute left-0 top-0 h-2 w-2 bg-[#e8321e]" />
        <h3 className="vh-display text-2xl text-white">Performance trend</h3>
        <p role="status" className="mt-2 text-xs text-neutral-500">
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
    <div className="relative border border-neutral-800 bg-[#0d0d0d] p-5">
      <span aria-hidden="true" className="absolute left-0 top-0 h-2 w-2 bg-[#e8321e]" />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="vh-label text-[10px] font-bold text-[#e8321e]">Score trend</p>
          <h3 className="vh-display mt-1.5 text-3xl text-white">Performance</h3>
        </div>
        <p className="text-xs text-neutral-500">AI rubric score — last 14 days (0–5)</p>
      </div>

      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 5]} stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0a0a0a",
                border: "1px solid #e8321e",
                borderRadius: "0px",
                color: "#fff",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#e8321e", fontWeight: 700 }}
              itemStyle={{ color: "#fff" }}
              cursor={{ stroke: "rgba(232,50,30,0.4)", strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#e8321e"
              strokeWidth={2.5}
              dot={{ fill: "#0a0a0a", stroke: "#e8321e", strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, fill: "#e8321e", stroke: "#0a0a0a", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="sr-only">Text alternative: {chartData.map((point) => `${point.date}: ${point.score.toFixed(2)} out of 5`).join("; ")}</p>
      <ul aria-label="Evaluation scores by date" className="mt-4 space-y-1.5 border-t border-neutral-800 pt-3 text-xs text-neutral-400">
        {chartData.slice(-5).map((point) => (
          <li key={`${point.date}-${point.sessionId}`} className="flex items-center gap-2">
            <span aria-hidden="true" className="h-1 w-1 rotate-45 bg-[#e8321e]" />
            {point.date}, {point.role}: AI rubric judgment <span className="text-white">{point.score.toFixed(2)}</span> out of 5
          </li>
        ))}
      </ul>
    </div>
  );
}