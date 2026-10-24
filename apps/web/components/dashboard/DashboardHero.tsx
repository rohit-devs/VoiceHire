"use client";

interface DashboardHeroProps {
  greeting: string;
  subtitle: string;
}

export function DashboardHero({ greeting, subtitle }: DashboardHeroProps) {
  return (
    <div className="relative border border-neutral-800 bg-[#0d0d0d] p-6 sm:p-8">
      <span aria-hidden="true" className="absolute left-0 top-0 h-2 w-2 bg-[#e8321e]" />
      <div className="space-y-3">
        <p className="vh-label text-[10px] font-bold text-[#e8321e]">{greeting}</p>
        <h2 className="vh-display text-4xl sm:text-5xl text-white">{subtitle}</h2>
        <p className="mt-3 text-sm text-neutral-400">
          Your verified interview metrics and AI rubric judgments appear here
          after completed real sessions.
        </p>
      </div>
    </div>
  );
}
