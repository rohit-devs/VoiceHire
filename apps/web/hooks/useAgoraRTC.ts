"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type {
  IAgoraRTCClient,
  ILocalAudioTrack,
  ICameraVideoTrack,
  UID,
} from "agora-rtc-sdk-ng";

interface UseAgoraRTCOptions {
  token: string;
  channelName: string;
  uid: UID;
  autoConnect?: boolean;
  onError?: (error: Error) => void;
}

interface UseAgoraRTCReturn {
  client: IAgoraRTCClient | null;
  localAudioTrack: ILocalAudioTrack | null;
  localVideoTrack: ICameraVideoTrack | null;
  isConnected: boolean;
  isConnecting: boolean;
  audioLevel: number; // 0-100
  error: string | null;
  join: () => Promise<void>;
  leave: () => Promise<void>;
  muteAudio: () => Promise<void>;
  unmuteAudio: () => Promise<void>;
  getStats: () => Promise<any>;
}

/**
 * Hook for managing Agora RTC client lifecycle.
 *
 * Handles:
 * - Channel joining/leaving
 * - Local audio track management
 * - Real-time audio level monitoring
 * - Connection state management
 *
 * Usage:
 * ```tsx
 * const {
 *   isConnected,
 *   audioLevel,
 *   localAudioTrack,
 *   join,
 *   leave,
 * } = useAgoraRTC({
 *   token: agoraToken,
 *   channelName: "vh-session-123",
 *   uid: 1,
 *   autoConnect: true,
 * });
 * ```
 */
export const useAgoraRTC = ({
  token,
  channelName,
  uid,
  autoConnect = true,
  onError,
}: UseAgoraRTCOptions): UseAgoraRTCReturn => {
  const agoraRef = useRef<typeof import("agora-rtc-sdk-ng").default | null>(null);
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const audioTrackRef = useRef<ILocalAudioTrack | null>(null);
  const videoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Initialize Agora client
  const initializeClient = useCallback(async () => {
    try {
      if (!agoraRef.current) {
        const agoraModule = await import("agora-rtc-sdk-ng");
        agoraRef.current = agoraModule.default;
      }

      if (!clientRef.current) {
        // Create client with high-quality audio codec
        const client = agoraRef.current.createClient({
          mode: "rtc",
          codec: "vp8", // or "h264" for better compatibility
        });

        // Event listeners
        client.on("connection-state-change", (curState, revState, reason) => {
          console.log(
            `🔗 Connection state changed: ${revState} -> ${curState}`,
            reason
          );
        });

        client.on("volume-indicator", (result) => {
          // Update audio level based on volume
          if (result.length > 0) {
            const level = result[0].level; // 0-100
            setAudioLevel(level);
          }
        });

        client.on("user-published", async (user, mediaType) => {
          console.log(`📱 User published ${mediaType}:`, user);
          await client.subscribe(user, mediaType);
        });

        client.on("user-unpublished", async (user, mediaType) => {
          console.log(`📱 User unpublished ${mediaType}:`, user);
          await client.unsubscribe(user, mediaType);
        });

        client.on("user-left", (user) => {
          console.log("👋 User left:", user);
        });

        clientRef.current = client;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Failed to initialize Agora client:", errorMsg);
      setError(errorMsg);
      if (onError) onError(new Error(errorMsg));
    }
  }, [onError]);

  // Join channel
  const join = useCallback(async () => {
    if (isConnected || isConnecting) return;

    setIsConnecting(true);
    setError(null);

    try {
      await initializeClient();

      if (!clientRef.current) {
        throw new Error("Client not initialized");
      }

      // Join channel
      console.log(
        `🎙️ Joining channel: ${channelName} as UID: ${uid}`
      );
      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
      if (!appId) {
        throw new Error("NEXT_PUBLIC_AGORA_APP_ID is not configured");
      }
      await clientRef.current.join(appId, channelName, token, uid);

      // Create and publish local audio track
      const audioTrack = await agoraRef.current!.createMicrophoneAudioTrack({
        AEC: true,
        AGC: true,
        ANS: true,
      });

      audioTrackRef.current = audioTrack;

      // Publish audio track
      await clientRef.current.publish(audioTrack);
      console.log("✅ Audio track published");

      // Enable volume indicator for real-time audio level
      clientRef.current.enableAudioVolumeIndicator();

      setIsConnected(true);
      setIsConnecting(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Failed to join channel:", errorMsg);
      setError(errorMsg);
      setIsConnecting(false);
      if (onError) onError(new Error(errorMsg));
    }
  }, [isConnected, isConnecting, token, channelName, uid, initializeClient, onError]);

  // Leave channel
  const leave = useCallback(async () => {
    try {
      if (audioTrackRef.current) {
        await audioTrackRef.current.close();
        audioTrackRef.current = null;
      }

      if (clientRef.current) {
        await clientRef.current.leave();
      }

      setIsConnected(false);
      setAudioLevel(0);
      console.log("✅ Left channel");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Failed to leave channel:", errorMsg);
      setError(errorMsg);
    }
  }, []);

  // Mute audio
  const muteAudio = useCallback(async () => {
    if (audioTrackRef.current) {
      await audioTrackRef.current.setMuted(true);
      console.log("🔇 Audio muted");
    }
  }, []);

  // Unmute audio
  const unmuteAudio = useCallback(async () => {
    if (audioTrackRef.current) {
      await audioTrackRef.current.setMuted(false);
      console.log("🔊 Audio unmuted");
    }
  }, []);

  // Get RTC stats (for debugging/monitoring)
  const getStats = useCallback(async () => {
    if (clientRef.current) {
      const stats = await clientRef.current.getRTCStats();
      console.log("📊 RTC Stats:", stats);
      return stats;
    }
    return null;
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      join();
    }

    return () => {
      leave();
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
      }
    };
  }, [autoConnect, join, leave]);

  return {
    client: clientRef.current,
    localAudioTrack: audioTrackRef.current,
    localVideoTrack: videoTrackRef.current,
    isConnected,
    isConnecting,
    audioLevel,
    error,
    join,
    leave,
    muteAudio,
    unmuteAudio,
    getStats,
  };
};

export default useAgoraRTC;
