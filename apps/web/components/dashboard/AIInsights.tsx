"use client";

import { Lightbulb, ArrowRight } from "lucide-react";

interface AIInsightsProps {
  insights: string[];
  recommendations: string[];
  strengths: string[];
}

export function AIInsights({ insights, recommendations, strengths }: AIInsightsProps) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="rounded-lg bg-gradient-to-br from-violet-500/20 to-blue-500/20 p-2 border border-violet-500/20">
          <Lightbulb className="h-4 w-4 text-violet-400" />
        </div>
        <h3 className="text-lg font-semibold text-white">AI Insights</h3>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Key Findings</p>
          <div className="space-y-2.5">
            {strengths.map((strength, i) => (
              <div key={`strength-${i}`} className="flex gap-2.5 text-sm text-slate-300">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <p>{strength}</p>
              </div>
            ))}
            {insights.map((insight, i) => (
              <div key={i} className="flex gap-2.5 text-sm text-slate-300">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                <p>{insight}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="h-px bg-white/10" />

        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Recommendations</p>
          <div className="space-y-2.5">
            {recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                <ArrowRight className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <p>{rec}</p>
              </div>
            ))}
          </div>
        </div>
        {!strengths.length && !insights.length && !recommendations.length && (
          <p role="status" className="text-sm text-slate-300">Saved AI findings and practice recommendations will appear after a completed real interview evaluation.</p>
        )}
      </div>
    </div>
  );
}
