"use client";

import React, { useState, useEffect, useRef } from "react";

interface VoiceOrbProps {
  isListening?: boolean;
  isAISpeaking?: boolean;
  hasError?: boolean;
  audioLevel?: number; // 0-100
  size?: number; // diameter in pixels
  className?: string;
}

/**
 * VoiceOrb Component
 *
 * An animated SVG orb that visualizes real-time audio activity.
 * - Blue glow: AI is speaking
 * - Green glow: Candidate is speaking
 * - Gray/inactive: Idle/listening
 *
 * The orb pulses based on audio level (0-100).
 */
export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  isListening = true,
  isAISpeaking = false,
  hasError = false,
  audioLevel = 0,
  size = 120,
  className = "",
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pulseScale, setPulseScale] = useState(1);

  // Animate pulse based on audio level
  useEffect(() => {
    // Scale pulse between 1.0 and 1.2 based on audio level
    const scale = 1 + (audioLevel / 100) * 0.2;
    setPulseScale(scale);
  }, [audioLevel]);

  // Determine colors based on state
  const getCoreColor = () => {
    if (hasError) return "#E11D48";
    if (isAISpeaking) return "#3B82F6"; // Blue for AI
    if (isListening && audioLevel > 10) return "#10B981"; // Green for candidate speaking
    return "#9CA3AF"; // Gray for idle
  };

  const getGlowColor = () => {
    if (hasError) return "#FDA4AF";
    if (isAISpeaking) return "#93C5FD"; // Light blue glow
    if (isListening && audioLevel > 10) return "#86EFAC"; // Light green glow
    return "#D1D5DB"; // Light gray glow
  };

  const coreColor = getCoreColor();
  const glowColor = getGlowColor();
  const radius = size / 2;

  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="drop-shadow-lg"
        aria-label={
          isAISpeaking
            ? "AI is speaking"
            : hasError
            ? "Voice connection error"
            : isListening && audioLevel > 10
            ? "Candidate is speaking"
            : "Listening"
        }
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <radialGradient id="orbGradient">
            <stop offset="0%" stopColor={glowColor} />
            <stop offset="100%" stopColor={coreColor} />
          </radialGradient>

          <style>
            {`
              @keyframes pulse-glow {
                0%, 100% { opacity: 0.6; }
                50% { opacity: 1; }
              }
              .glow-ring {
                animation: pulse-glow 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
              }
            `}
          </style>
        </defs>

        {/* Outer glow ring */}
        <circle
          cx={radius}
          cy={radius}
          r={radius * 0.95}
          fill="none"
          stroke={glowColor}
          strokeWidth="2"
          opacity="0.3"
          className="glow-ring"
        />

        {/* Middle ring (for depth) */}
        <circle
          cx={radius}
          cy={radius}
          r={radius * 0.85}
          fill="none"
          stroke={coreColor}
          strokeWidth="1"
          opacity="0.2"
        />

        {/* Core orb with pulse effect */}
        <circle
          cx={radius}
          cy={radius}
          r={radius * 0.7}
          fill="url(#orbGradient)"
          filter="url(#glow)"
          style={{
            transform: `scale(${pulseScale})`,
            transformOrigin: `${radius}px ${radius}px`,
            transition: "transform 0.1s ease-out",
          }}
        />

        {/* Inner highlight for depth */}
        <circle
          cx={radius * 0.7}
          cy={radius * 0.7}
          r={radius * 0.2}
          fill="white"
          opacity="0.3"
        />

        {/* Status indicator text (optional) */}
        <text
          x={radius}
          y={radius + radius * 0.5 + 10}
          textAnchor="middle"
          fontSize="10"
          fill={coreColor}
          opacity="0.6"
        >
          {hasError ? "!" : isAISpeaking ? "AI" : isListening && audioLevel > 10 ? "YOU" : "..."}
        </text>
      </svg>
    </div>
  );
};

export default VoiceOrb;
