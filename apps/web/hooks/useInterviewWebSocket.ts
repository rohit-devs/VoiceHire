"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface TranscriptMessage {
  type: "transcript";
  message_id: string;
  sequence_number: number;
  speaker: "candidate" | "interviewer";
  text: string;
  timestamp_ms: number;
  duration_ms: number | null;
  language: "en" | "es" | "fr";
  is_final: true;
  source: "real" | "simulated";
}

export interface VoiceMetricsMessage {
  type: "voice_metrics";
  timestamp_ms: number;
  source: "real" | "simulated";
  metrics: Record<string, unknown>;
}

export interface StateChangeMessage {
  type: "state_change";
  state: string;
  metadata?: Record<string, unknown>;
}

export type WebSocketMessage =
  | TranscriptMessage
  | VoiceMetricsMessage
  | StateChangeMessage;

interface UseInterviewWebSocketOptions {
  sessionId: string;
  apiUrl?: string;
  autoConnect?: boolean;
  authToken?: string | null;
}

interface UseInterviewWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  transcripts: TranscriptMessage[];
  metrics: VoiceMetricsMessage | null;
  currentState: string;
  send: (message: string) => void;
  connect: () => void;
  disconnect: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;

export function useInterviewWebSocket({
  sessionId,
  apiUrl,
  autoConnect = true,
  authToken = null,
}: UseInterviewWebSocketOptions): UseInterviewWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSequenceRef = useRef(0);
  const attemptsRef = useRef(0);
  const explicitlyDisconnectedRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [metrics, setMetrics] = useState<VoiceMetricsMessage | null>(null);
  const [currentState, setCurrentState] = useState("created");

  const connect = useCallback(() => {
    const current = wsRef.current;
    if (current?.readyState === WebSocket.OPEN || current?.readyState === WebSocket.CONNECTING) return;
    explicitlyDisconnectedRef.current = false;
    setIsConnecting(true);
    setError(null);

    const pageUrl = new URL(window.location.href);
    const targetUrl = apiUrl ? new URL(apiUrl, pageUrl) : pageUrl;
    const url = new URL(
      `/api/interviews/sessions/${encodeURIComponent(sessionId)}/ws`,
      targetUrl.origin,
    );
    url.protocol = targetUrl.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("after_sequence", String(lastSequenceRef.current));
    if (authToken) url.searchParams.set("token", authToken);

    const socket = new WebSocket(url.toString());
    wsRef.current = socket;
    socket.onopen = () => {
      attemptsRef.current = 0;
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
    };
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        if (message.type === "transcript") {
          lastSequenceRef.current = Math.max(
            lastSequenceRef.current,
            message.sequence_number,
          );
          setTranscripts((previous) => {
            if (previous.some((entry) => entry.message_id === message.message_id)) return previous;
            return [...previous, message].sort(
              (left, right) => left.sequence_number - right.sequence_number,
            );
          });
        } else if (message.type === "voice_metrics") {
          setMetrics(message);
        } else if (message.type === "state_change") {
          setCurrentState(message.state);
        }
      } catch {
        setError("Received an invalid interview event.");
      }
    };
    socket.onerror = () => {
      setError("Interview event connection failed.");
    };
    socket.onclose = () => {
      if (wsRef.current === socket) wsRef.current = null;
      setIsConnected(false);
      setIsConnecting(false);
      if (
        explicitlyDisconnectedRef.current ||
        attemptsRef.current >= MAX_RECONNECT_ATTEMPTS
      ) return;
      const delayMs = Math.min(1000 * 2 ** attemptsRef.current, 10_000);
      attemptsRef.current += 1;
      reconnectTimerRef.current = setTimeout(connect, delayMs);
    };
  }, [apiUrl, authToken, sessionId]);

  const disconnect = useCallback(() => {
    explicitlyDisconnectedRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    const current = wsRef.current;
    wsRef.current = null;
    if (current) current.close();
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const send = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(message);
  }, []);

  useEffect(() => {
    lastSequenceRef.current = 0;
    attemptsRef.current = 0;
    setTranscripts([]);
    setMetrics(null);
    setCurrentState("created");
    if (autoConnect) connect();
    return disconnect;
  }, [autoConnect, authToken, connect, disconnect, sessionId]);

  return {
    isConnected,
    isConnecting,
    error,
    transcripts,
    metrics,
    currentState,
    send,
    connect,
    disconnect,
  };
}

export default useInterviewWebSocket;
