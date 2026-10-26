"use client";

type OrbState =
  | "idle"
  | "requesting-permission"
  | "permission-denied"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed"
  | "ended"
  | "thinking"
  | "speaking"
  | "listening"
  | "user-speaking";

interface VoiceOrbProps {
  state: OrbState;
  audioLevel?: number;
  connected?: boolean;
  size?: number;
  className?: string;
}

export function VoiceOrb({
  state,
  audioLevel = 0,
  connected = false,
  size = 120,
  className = "",
}: VoiceOrbProps) {
  const isError = state === "permission-denied" || state === "failed";
  const candidateSpeaking = connected && audioLevel > 8;
  const isListening = candidateSpeaking || state === "listening" || state === "user-speaking";
  const isSpeaking = state === "speaking" || state === "thinking";
  const isConnecting = state === "connecting" || state === "reconnecting" || state === "requesting-permission";

  const color = isError
    ? { core: "var(--error)", glow: "var(--error)" }
    : isSpeaking
      ? { core: "var(--success)", glow: "var(--success)" }
      : isListening
        ? { core: "var(--accent)", glow: "var(--accent)" }
        : isConnecting
          ? { core: "#3b82f6", glow: "#60a5fa" }
          : { core: "var(--text-muted)", glow: "var(--text-muted)" };

  const radius = size / 2;
  const scale = 1 + (connected ? Math.max(0, Math.min(audioLevel, 100)) / 1000 : 0);
  const status = isError
    ? state === "permission-denied" ? "Microphone permission denied" : "Voice connection failed"
    : state === "connected" || connected
      ? candidateSpeaking ? "Candidate speaking" : "Microphone connected"
      : state.replace(/-/g, " ");

  const animationClass = isListening ? "animate-pulse-glow" : isSpeaking ? "animate-float" : "";

  return (
    <div
      className={`relative flex items-center justify-center ${animationClass} ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={status}
      data-state={state}
    >
      <div
        className="absolute inset-0 rounded-full opacity-30 blur-2xl transition-colors duration-300"
        style={{ backgroundColor: color.glow, transform: `scale(${1 + scale * 0.25})` }}
      />
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative z-10">
        <defs>
          <radialGradient id="voice-orb-gradient">
            <stop offset="0%" stopColor={color.glow} />
            <stop offset="100%" stopColor={color.core} />
          </radialGradient>
        </defs>
        <circle
          cx={radius}
          cy={radius}
          r={radius * 0.7}
          fill="url(#voice-orb-gradient)"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: `${radius}px ${radius}px`,
            transition: "transform 100ms linear, fill 200ms ease",
          }}
        />
        <circle
          cx={radius * 0.7}
          cy={radius * 0.65}
          r={radius * 0.15}
          fill="white"
          opacity="0.3"
        />
      </svg>
    </div>
  );
}
