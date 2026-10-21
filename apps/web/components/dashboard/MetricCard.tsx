"use client";

import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
}

export function MetricCard({ label, value, icon: Icon, color }: MetricCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.04]">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate">
            {label}
          </p>
          <p className="text-2xl font-bold text-white tracking-tight">
            {value.toFixed(2)}
            <span className="text-sm text-muted-foreground font-normal">/5</span>
          </p>
        </div>
        <div className={`rounded-lg bg-gradient-to-br ${color} p-2 shadow-sm flex-shrink-0`}>
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
      </div>
      <div className="mt-3 h-1 rounded-full bg-white/[0.08] overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
          style={{ width: `${Math.max(0, Math.min(100, value * 20))}%` }}
        />
      </div>
    </div>
  );
}
