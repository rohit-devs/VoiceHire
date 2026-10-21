"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  IAgoraRTCClient,
  ILocalAudioTrack,
  IAgoraRTCRemoteUser,
  UID,
} from "agora-rtc-sdk-ng";

export type AgoraVoiceState =
  | "idle"
  | "requesting-permission"
  | "permission-denied"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed"
  | "ended";

interface AgoraTokenResponse {
  token: string;
  channel_name: string;
  uid: number;
  app_id: string;
  expires_in_seconds: number;
}

interface UseAgoraVoiceOptions {
  sessionId: string;
  apiUrl?: string;
  authToken?: string | null;
  reconnectLimit?: number;
}

interface UseAgoraVoiceReturn {
  client: IAgoraRTCClient | null;
  localAudioTrack: ILocalAudioTrack | null;
  remoteUsers: IAgoraRTCRemoteUser[];
  state: AgoraVoiceState;
  isMuted: boolean;
  audioLevel: number;
  networkQuality: { uplink: number; downlink: number } | null;
  error: string | null;
  join: () => Promise<void>;
  leave: () => Promise<void>;
  mute: () => Promise<void>;
  unmute: () => Promise<void>;
}

type ListenerCleanup = () => void;

export function useAgoraVoice({
  sessionId,
  apiUrl = process.env.NEXT_PUBLIC_API_URL || "",
  authToken = null,
  reconnectLimit = 3,
}: UseAgoraVoiceOptions): UseAgoraVoiceReturn {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const trackRef = useRef<ILocalAudioTrack | null>(null);
  const listenersRef = useRef<ListenerCleanup | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectResolveRef = useRef<(() => void) | null>(null);
  const endedRef = useRef(false);
  const connectedOnceRef = useRef(false);
  const reconnectingRef = useRef(false);
  const reconnectCountRef = useRef(0);
  const stateRef = useRef<AgoraVoiceState>("idle");
  const mountedRef = useRef(true);
  const [client, setClient] = useState<IAgoraRTCClient | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<ILocalAudioTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [state, setState] = useState<AgoraVoiceState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [networkQuality, setNetworkQuality] = useState<{ uplink: number; downlink: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateState = useCallback((next: AgoraVoiceState) => {
    stateRef.current = next;
    if (mountedRef.current) setState(next);
  }, []);

  const requestToken = useCallback(async (): Promise<AgoraTokenResponse> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const response = await fetch(`${apiUrl}/api/agora/token`, {
      method: "POST",
      headers,
      body: JSON.stringify({ session_id: sessionId }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { detail?: unknown } | null;
      const detail = typeof body?.detail === "string" ? body.detail : "Agora RTC is unavailable.";
      throw new Error(detail);
    }
    return (await response.json()) as AgoraTokenResponse;
  }, [apiUrl, authToken, sessionId]);

  const removeListeners = useCallback(() => {
    listenersRef.current?.();
    listenersRef.current = null;
  }, []);

  const cleanupTransport = useCallback(async () => {
    const cleanupErrors: string[] = [];
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
      reconnectResolveRef.current?.();
      reconnectResolveRef.current = null;
    }
    removeListeners();

    const track = trackRef.current;
    trackRef.current = null;
    if (track) {
      try {
        track.stop();
      } catch (cause) {
        cleanupErrors.push(cause instanceof Error ? cause.message : "Microphone stop failed.");
      }
      try {
        track.close();
      } catch (cause) {
        cleanupErrors.push(cause instanceof Error ? cause.message : "Microphone close failed.");
      }
    }
    if (mountedRef.current) setLocalAudioTrack(null);

    const currentClient = clientRef.current;
    clientRef.current = null;
    if (currentClient) {
      try {
        await currentClient.leave();
      } catch (cause) {
        cleanupErrors.push(cause instanceof Error ? cause.message : "Agora channel leave failed.");
      }
    }
    if (mountedRef.current) {
      setClient(null);
      setRemoteUsers([]);
      setAudioLevel(0);
      setNetworkQuality(null);
      setIsMuted(false);
      if (cleanupErrors.length) setError(`Voice cleanup issue: ${cleanupErrors.join("; ")}`);
    }
  }, [removeListeners]);

  const reconnect = useCallback(async () => {
    const currentClient = clientRef.current;
    const track = trackRef.current;
    if (!currentClient || !track || endedRef.current || reconnectingRef.current) return;
    reconnectingRef.current = true;
    updateState("reconnecting");

    for (let attempt = 0; attempt < reconnectLimit && !endedRef.current; attempt += 1) {
      reconnectCountRef.current = attempt + 1;
      await new Promise<void>((resolve) => {
        reconnectResolveRef.current = resolve;
        reconnectTimerRef.current = setTimeout(resolve, 500 * 2 ** attempt);
      });
      reconnectTimerRef.current = null;
      reconnectResolveRef.current = null;
      if (endedRef.current) break;
      try {
        const credentials = await requestToken();
        if (endedRef.current) break;
        await currentClient.join(
          credentials.app_id,
          credentials.channel_name,
          credentials.token,
          credentials.uid,
        );
        if (!currentClient.localTracks.includes(track)) await currentClient.publish(track);
        reconnectCountRef.current = 0;
        reconnectingRef.current = false;
        updateState("connected");
        return;
      } catch (cause) {
        if (mountedRef.current) {
          setError(cause instanceof Error ? cause.message : "Agora reconnection failed.");
        }
      }
    }

    reconnectingRef.current = false;
    if (!endedRef.current) {
      updateState("failed");
      if (mountedRef.current) setError(`Agora could not reconnect after ${reconnectLimit} attempts.`);
    }
  }, [reconnectLimit, requestToken, updateState]);

  const join = useCallback(async () => {
    if (stateRef.current === "connecting" || stateRef.current === "connected") return;
    endedRef.current = false;
    connectedOnceRef.current = false;
    reconnectingRef.current = false;
    reconnectCountRef.current = 0;
    if (mountedRef.current) setError(null);
    updateState("connecting");

    try {
      const credentials = await requestToken();
      if (endedRef.current) return;
      updateState("requesting-permission");
      const { default: AgoraRTC } = await import("agora-rtc-sdk-ng");
      const track = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true,
        AGC: true,
        ANS: true,
      });
      if (endedRef.current) {
        track.stop();
        track.close();
        return;
      }
      trackRef.current = track;
      if (mountedRef.current) setLocalAudioTrack(track);
      updateState("connecting");

      const rtcClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = rtcClient;
      if (mountedRef.current) setClient(rtcClient);

      const onConnectionState = (current: string) => {
        if (current === "RECONNECTING") updateState("reconnecting");
        if (current === "CONNECTED") {
          connectedOnceRef.current = true;
          reconnectCountRef.current = 0;
          reconnectingRef.current = false;
          updateState("connected");
        }
        if (current === "DISCONNECTED" && connectedOnceRef.current && !endedRef.current) {
          void reconnect();
        }
      };
      const onUserPublished = async (
        user: IAgoraRTCRemoteUser,
        mediaType: "audio" | "video",
      ) => {
        try {
          await rtcClient.subscribe(user, mediaType);
          if (mediaType === "audio") user.audioTrack?.play();
          if (mountedRef.current) setRemoteUsers([...rtcClient.remoteUsers]);
        } catch (cause) {
          if (mountedRef.current) {
            setError(cause instanceof Error ? cause.message : "Could not subscribe to remote audio.");
          }
        }
      };
      const onUserUnpublished = () => {
        if (mountedRef.current) setRemoteUsers([...rtcClient.remoteUsers]);
      };
      const onUserLeft = () => {
        if (mountedRef.current) setRemoteUsers([...rtcClient.remoteUsers]);
      };
      const onVolume = (volumes: Array<{ uid: UID; level: number }>) => {
        const localVolume = volumes.find((volume) => String(volume.uid) === String(credentials.uid));
        if (mountedRef.current) setAudioLevel(localVolume?.level ?? 0);
      };
      const onNetworkQuality = (quality: { uplinkNetworkQuality: number; downlinkNetworkQuality: number }) => {
        if (mountedRef.current) {
          setNetworkQuality({
            uplink: quality.uplinkNetworkQuality,
            downlink: quality.downlinkNetworkQuality,
          });
        }
      };

      rtcClient.on("connection-state-change", onConnectionState);
      rtcClient.on("user-published", onUserPublished);
      rtcClient.on("user-unpublished", onUserUnpublished);
      rtcClient.on("user-left", onUserLeft);
      rtcClient.on("volume-indicator", onVolume);
      rtcClient.on("network-quality", onNetworkQuality);
      listenersRef.current = () => {
        rtcClient.off("connection-state-change", onConnectionState);
        rtcClient.off("user-published", onUserPublished);
        rtcClient.off("user-unpublished", onUserUnpublished);
        rtcClient.off("user-left", onUserLeft);
        rtcClient.off("volume-indicator", onVolume);
        rtcClient.off("network-quality", onNetworkQuality);
      };

      await rtcClient.join(
        credentials.app_id,
        credentials.channel_name,
        credentials.token,
        credentials.uid,
      );
      await rtcClient.publish(track);
      rtcClient.enableAudioVolumeIndicator();
      connectedOnceRef.current = true;
      updateState("connected");
    } catch (cause) {
      const errorCause = cause instanceof Error ? cause : new Error("Agora connection failed.");
      const permissionDenied =
        errorCause.name === "NotAllowedError" ||
        errorCause.name === "PermissionDeniedError" ||
        /permission denied|not allowed/i.test(errorCause.message);
      if (mountedRef.current) setError(errorCause.message);
      await cleanupTransport();
      updateState(permissionDenied ? "permission-denied" : "failed");
    }
  }, [cleanupTransport, reconnect, requestToken, updateState]);

  const leave = useCallback(async () => {
    endedRef.current = true;
    updateState("ended");
    await cleanupTransport();
  }, [cleanupTransport, updateState]);

  const mute = useCallback(async () => {
    const track = trackRef.current;
    if (!track) return;
    await track.setMuted(true);
    if (mountedRef.current) setIsMuted(true);
  }, []);

  const unmute = useCallback(async () => {
    const track = trackRef.current;
    if (!track) return;
    await track.setMuted(false);
    if (mountedRef.current) setIsMuted(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      endedRef.current = true;
      void cleanupTransport();
    };
  }, [cleanupTransport]);

  return {
    client,
    localAudioTrack,
    remoteUsers,
    state,
    isMuted,
    audioLevel,
    networkQuality,
    error,
    join,
    leave,
    mute,
    unmute,
  };
}

export default useAgoraVoice;
