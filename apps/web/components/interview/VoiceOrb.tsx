"use client";

import React from "react";

type OrbState = "idle" | "listening" | "thinking" | "speaking" | "user_speaking" | "interrupted";

interface VoiceOrbProps {
  state: OrbState;
  size?: number;
  className?: string;
}

export function VoiceOrb({ state, size = 200, className = "" }: VoiceOrbProps) {
  const getColors = () => {
    switch (state) {
      case "speaking":
      case "thinking":
        return { core: "#6366f1", glow: "#818cf8", label: "AI" };
      case "user_speaking":
        return { core: "#10b981", glow: "#34d399", label: "YOU" };
      case "listening":
        return { core: "#3b82f6", glow: "#60a5fa", label: "..." };
      case "interrupted":
        return { core: "#ef4444", glow: "#f87171", label: "!" };
      default:
        return { core: "#6b7280", glow: "#9ca3af", label: "..." };
    }
  };

  const colors = getColors();
  const radius = size / 2;

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-full opacity-30 blur-2xl transition-colors duration-500"
        style={{ backgroundColor: colors.glow, transform: "scale(1.3)" }}
      />

      {/* Pulsing rings */}
      {state !== "idle" && (
        <>
          <div
            className="absolute inset-0 rounded-full border-2 opacity-40 animate-ping"
            style={{ borderColor: colors.glow, animationDuration: "2s" }}
          />
          <div
            className="absolute inset-0 rounded-full border opacity-20 animate-ping"
            style={{ borderColor: colors.glow, animationDuration: "2.5s", animationDelay: "0.5s" }}
          />
        </>
      )}

      {/* Main orb */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative z-10">
        <defs>
          <radialGradient id={`gradient-${state}`}>
            <stop offset="0%" stopColor={colors.glow} />
            <stop offset="100%" stopColor={colors.core} />
          </radialGradient>
          <filter id={`glow-${state}`}>
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Core circle */}
        <circle
          cx={radius}
          cy={radius}
          r={radius * 0.7}
          fill={`url(#gradient-${state})`}
          filter={`url(#glow-${state})`}
          className="transition-all duration-500"
          style={{
            transform: state === "thinking" ? "scale(0.9)" : state === "speaking" ? "scale(1.05)" : "scale(1)",
            transformOrigin: `${radius}px ${radius}px`,
            transition: "transform 0.5s ease-in-out",
          }}
        />

        {/* Inner highlight */}
        <circle
          cx={radius * 0.7}
          cy={radius * 0.65}
          r={radius * 0.15}
          fill="white"
          opacity="0.3"
        />

        {/* Label */}
        <text
          x={radius}
          y={radius + radius * 0.55}
          textAnchor="middle"
          fontSize={size * 0.08}
          fill={colors.core}
          opacity="0.8"
          fontWeight="600"
        >
          {colors.label}
        </text>
      </svg>
    </div>
  );
}
