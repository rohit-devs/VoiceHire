"use client";

interface TelemetryBarProps {
  metrics?: {
    clarity: number;
    confidence: number;
    relevance: number;
    fillerWordsCount: number;
    avgWpm: number;
    longPauses: number;
    avgResponseTime: number;
    answerStructure: number;
  };
}

export function TelemetryBar({ metrics }: TelemetryBarProps) {
  if (!metrics) return null;

  const items = [
    { label: "Clarity", value: metrics.clarity, unit: "%" },
    { label: "Confidence", value: metrics.confidence, unit: "%" },
    { label: "Relevance", value: metrics.relevance, unit: "%" },
    { label: "Filler Words", value: metrics.fillerWordsCount, unit: "" },
    { label: "WPM", value: metrics.avgWpm, unit: "" },
    { label: "Pauses", value: metrics.longPauses, unit: "" },
    { label: "Avg Response", value: metrics.avgResponseTime, unit: "s" },
    { label: "Structure", value: metrics.answerStructure, unit: "%" },
  ];

  return (
    <div className="flex items-center gap-6 overflow-x-auto pb-1">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {item.label}
            </p>
            <p className="text-sm font-bold text-white">
              {item.value}
              <span className="text-xs text-muted-foreground ml-0.5">{item.unit}</span>
            </p>
          </div>
          <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-500"
              style={{ width: `${Math.min(item.value, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
