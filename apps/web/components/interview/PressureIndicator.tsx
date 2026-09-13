"use client";

interface PressureIndicatorProps {
  event: string;
}

export function PressureIndicator({ event }: PressureIndicatorProps) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-float">
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 backdrop-blur-xl px-6 py-3 shadow-lg shadow-rose-500/10">
        <p className="text-sm font-medium text-rose-300">{event}</p>
      </div>
    </div>
  );
}
