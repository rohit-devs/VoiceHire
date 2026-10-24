"use client";

import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
}

export function MetricCard({ label, value, icon: Icon }: MetricCardProps) {
  return (
    <div className="group relative border border-neutral-800 bg-[#0d0d0d] p-5 transition-colors duration-200 hover:border-[#e8321e]">
      {/* Red corner tick */}
      <span aria-hidden="true" className="absolute left-0 top-0 h-2 w-2 bg-[#e8321e]" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="vh-label truncate text-[10px] font-bold text-neutral-500">
            {label}
          </p>
          <p className="vh-display mt-3 text-5xl text-white">
            {value.toFixed(2)}
            <span className="ml-1.5 align-baseline text-lg text-[#e8321e]">/5</span>
          </p>
        </div>
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center border border-[#e8321e]/40 bg-[#e8321e]/10 text-[#e8321e] transition-colors group-hover:bg-[#e8321e] group-hover:text-white">
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div
        className="mt-5 h-[3px] w-full overflow-hidden bg-neutral-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={value}
        aria-label={label}
      >
        <div
          className="h-full bg-[#e8321e] transition-all duration-700"
          style={{ width: `${Math.max(0, Math.min(100, value * 20))}%` }}
        />
      </div>
    </div>
  );
}