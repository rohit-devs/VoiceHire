"use client";

import { Lightbulb, ArrowRight } from "lucide-react";

interface AIInsightsProps {
  insights: string[];
  recommendations: string[];
  strengths: string[];
}

export function AIInsights({ insights, recommendations, strengths }: AIInsightsProps) {
  const isEmpty = !strengths.length && !insights.length && !recommendations.length;

  return (
    <div className="relative border border-neutral-800 bg-[#0d0d0d] p-6">
      {/* Red top rule */}
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-[#e8321e]" />

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center border border-[#e8321e]/40 bg-[#e8321e]/10 text-[#e8321e]">
          <Lightbulb className="h-4 w-4" />
        </div>
        <div>
          <p className="vh-label text-[10px] font-bold text-[#e8321e]">Findings</p>
          <h3 className="vh-display mt-0.5 text-3xl text-white">AI insights</h3>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <p className="vh-label mb-3 text-[10px] font-bold text-neutral-500">Key findings</p>
          <div className="space-y-2.5">
            {strengths.map((strength, i) => (
              <div key={`strength-${i}`} className="flex gap-3 text-sm text-neutral-300">
                <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rotate-45 bg-emerald-400" />
                <p className="leading-relaxed">{strength}</p>
              </div>
            ))}
            {insights.map((insight, i) => (
              <div key={i} className="flex gap-3 text-sm text-neutral-300">
                <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rotate-45 bg-[#e8321e]" />
                <p className="leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="h-px bg-neutral-800" />

        <div>
          <p className="vh-label mb-3 text-[10px] font-bold text-neutral-500">Recommendations</p>
          <div className="space-y-2.5">
            {recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-3 text-sm text-neutral-300">
                <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#e8321e]" />
                <p className="leading-relaxed">{rec}</p>
              </div>
            ))}
          </div>
        </div>

        {isEmpty && (
          <p role="status" className="text-sm text-neutral-500">
            Saved AI findings and practice recommendations will appear after a completed real interview evaluation.
          </p>
        )}
      </div>
    </div>
  );
}
