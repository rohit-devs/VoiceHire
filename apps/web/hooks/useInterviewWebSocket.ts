"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface TranscriptMessage {
  type: "transcript";
  speaker: "candidate" | "interviewer";
  text: string;
  timestamp_ms: number;
  metrics?: {
    wpm: number;
    pause_ms: number;
    filler_words: string[];
  };
}

export interface MetricsMessage {
  type: "metrics";
  clarity_score: number;
  confidence_score: number;
  relevance_score: number;
  filler_words_count: number;
  avg_wpm: number;
  timestamp_ms: number;
}

export interface StateChangeMessage {
  type: "state_change";
  state: "intro" | "warmup" | "technical" | "behavioral" | "pressure" | "closing";
  metadata?: Record<string, any>;
}

export interface AIThinkingMessage {
  type: "ai_thinking";
  text: string;
}

export interface EvaluationCompleteMessage {
  type: "evaluation_complete";
  report: Record<string, any>;
}

export type WebSocketMessage =
  | TranscriptMessage
  | MetricsMessage
  | StateChangeMessage
  | AIThinkingMessage
  | EvaluationCompleteMessage;

interface UseInterviewWebSocketOptions {
  sessionId: string;
  apiUrl?: string;
  autoConnect?: boolean;
}

interface UseInterviewWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  transcripts: TranscriptMessage[];
  metrics: MetricsMessage | null;
  currentState: string;
  aiThinking: boolean;
  send: (message: string) => void;
  connect: () => void;
  disconnect: () => void;
}

/**
 * Hook for managing WebSocket connection to interview session.
 *
 * Usage:
 * ```tsx
 * const {
 *   isConnected,
 *   transcripts,
 *   metrics,
 *   currentState,
 *   aiThinking,
 * } = useInterviewWebSocket({
 *   sessionId: "session-123",
 *   autoConnect: true,
 * });
 * ```
 */
export const useInterviewWebSocket = ({
  sessionId,
  apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  autoConnect = true,
}: UseInterviewWebSocketOptions): UseInterviewWebSocketReturn => {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [metrics, setMetrics] = useState<MetricsMessage | null>(null);
  const [currentState, setCurrentState] = useState("intro");
  const [aiThinking, setAiThinking] = useState(false);

  const connect = useCallback(() => {
    if (isConnected || isConnecting) return;

    setIsConnecting(true);
    setError(null);

    const protocol = apiUrl.startsWith("https") ? "wss" : "ws";
    const baseUrl = apiUrl.replace(/^https?:\/\//, "");
    const wsUrl = `${protocol}://${baseUrl}/api/interviews/sessions/${sessionId}/ws`;

    console.log(`🔗 Connecting to WebSocket: ${wsUrl}`);

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("✅ WebSocket connected");
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          console.log("📩 Received message:", message);

          switch (message.type) {
            case "transcript":
              setTranscripts((prev) => [...prev, message]);
              break;

            case "metrics":
              setMetrics(message);
              break;

            case "state_change":
              setCurrentState(message.state);
              break;

            case "ai_thinking":
              setAiThinking(true);
              setTimeout(() => setAiThinking(false), 1000);
              break;

            case "evaluation_complete":
              console.log("📊 Evaluation complete:", message.report);
              break;

            default:
              console.warn("Unknown message type:", message);
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onerror = (event) => {
        console.error("❌ WebSocket error:", event);
        setError("Connection error. Please refresh and try again.");
        setIsConnecting(false);
      };

      ws.onclose = () => {
        console.log("🔌 WebSocket closed");
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;
      };

      wsRef.current = ws;
    } catch (err) {
      console.error("Failed to create WebSocket:", err);
      setError(String(err));
      setIsConnecting(false);
    }
  }, [sessionId, apiUrl, isConnected, isConnecting]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const send = useCallback((message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
    } else {
      console.warn("WebSocket not connected");
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect, sessionId]);

  return {
    isConnected,
    isConnecting,
    error,
    transcripts,
    metrics,
    currentState,
    aiThinking,
    send,
    connect,
    disconnect,
  };
};

export default useInterviewWebSocket;
