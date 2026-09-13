"use client";

import { Mic, MicOff, Square, Settings2, Pause } from "lucide-react";

interface ControlsProps {
  isMuted: boolean;
  onToggleMute: () => void;
  onEndInterview: () => void;
}

export function Controls({ isMuted, onToggleMute, onEndInterview }: ControlsProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0a0a0f]/90 backdrop-blur-xl p-2 shadow-2xl">
        <button
          onClick={onToggleMute}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
            isMuted
              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
              : "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10"
          }`}
        >
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {isMuted ? "Unmute" : "Mute"}
        </button>

        <button
          className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 border border-white/10 hover:bg-white/10 transition-all"
        >
          <Pause className="h-4 w-4" />
          Pause
        </button>

        <button
          className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 border border-white/10 hover:bg-white/10 transition-all"
        >
          <Settings2 className="h-4 w-4" />
        </button>

        <button
          onClick={onEndInterview}
          className="flex items-center gap-2 rounded-xl bg-rose-500/20 px-4 py-2.5 text-sm font-medium text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition-all"
        >
          <Square className="h-4 w-4" />
          End Interview
        </button>
      </div>
    </div>
  );
}
