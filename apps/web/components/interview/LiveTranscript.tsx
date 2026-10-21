"use client";

import type { TranscriptMessage } from "@/hooks/useInterviewWebSocket";

interface LiveTranscriptProps {
  messages: TranscriptMessage[];
}

export function LiveTranscript({ messages }: LiveTranscriptProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-3 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white">Live Transcript</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Transcript will appear here...
          </p>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`rounded-lg p-3 text-sm ${
                msg.speaker === "candidate"
                  ? "bg-blue-500/10 border border-blue-500/20 ml-4"
                  : "bg-violet-500/10 border border-violet-500/20 mr-4"
              }`}
            >
              <p className={`text-xs font-medium mb-1 ${msg.speaker === "candidate" ? "text-blue-400" : "text-violet-400"}`}>
                {msg.speaker === "candidate" ? "You" : "AI Interviewer"}
              </p>
              <p className="text-slate-200">{msg.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
