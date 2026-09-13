"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AgoraRTC, { IAgoraRTCClient, ILocalAudioTrack, IAgoraRTCRemoteUser, UID } from "agora-rtc-sdk-ng";
import useFetchAgoraToken from "./useFetchAgoraToken";

export type AgoraJoinState = "idle" | "fetching-token" | "joining" | "joined" | "leaving" | "error";

interface UseAgoraVoiceOptions {
  sessionId: string;
  uid?: UID;
  apiUrl?: string;
}

interface UseAgoraVoiceReturn {
  client: IAgoraRTCClient | null;
  localAudioTrack: ILocalAudioTrack | null;
  remoteUsers: IAgoraRTCRemoteUser[];
  joinState: AgoraJoinState;
  error: string | null;
  audioLevel: number;
  join: () => Promise<void>;
  leave: () => Promise<void>;
}

/** Owns the candidate voice lifecycle and keeps Agora credentials server-side. */
export default function useAgoraVoice({ sessionId, uid = 1, apiUrl }: UseAgoraVoiceOptions): UseAgoraVoiceReturn {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const trackRef = useRef<ILocalAudioTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [joinState, setJoinState] = useState<AgoraJoinState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const { fetchToken } = useFetchAgoraToken({ apiUrl });

  const join = useCallback(async () => {
    if (joinState === "joining" || joinState === "joined") return;
    setError(null);
    setJoinState("fetching-token");
    try {
      const channelName = `vh-${sessionId}`;
      const token = await fetchToken(channelName, Number(uid), "publisher");
      if (!token) throw new Error("Unable to fetch the Agora voice token");
      setJoinState("joining");
      const client = clientRef.current ?? AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;
      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        setRemoteUsers(Array.from(client.remoteUsers));
        if (mediaType === "audio") user.audioTrack?.play();
      });
      client.on("user-unpublished", () => setRemoteUsers(Array.from(client.remoteUsers)));
      client.on("user-left", () => setRemoteUsers(Array.from(client.remoteUsers)));
      client.on("volume-indicator", (volumes) => setAudioLevel(volumes.find((volume) => volume.uid === uid)?.level ?? 0));
      await client.join(token.app_id, token.channel_name, token.token, token.uid);
      const track = await AgoraRTC.createMicrophoneAudioTrack();
      trackRef.current = track;
      await client.publish(track);
      client.enableAudioVolumeIndicator();
      setJoinState("joined");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setJoinState("error");
    }
  }, [fetchToken, joinState, sessionId, uid]);

  const leave = useCallback(async () => {
    setJoinState("leaving");
    trackRef.current?.close();
    trackRef.current = null;
    if (clientRef.current) await clientRef.current.leave();
    setRemoteUsers([]);
    setAudioLevel(0);
    setJoinState("idle");
  }, []);

  useEffect(() => () => { void leave(); }, [leave]);

  return { client: clientRef.current, localAudioTrack: trackRef.current, remoteUsers, joinState, error, audioLevel, join, leave };
}