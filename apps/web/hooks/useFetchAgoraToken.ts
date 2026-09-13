"use client";

import { useState, useCallback } from "react";

export interface AgoraTokenResponse {
  token: string;
  channel_name: string;
  uid: number;
  app_id: string;
  expires_in_seconds: number;
}

interface UseFetchAgoraTokenOptions {
  apiUrl?: string;
}

interface UseFetchAgoraTokenReturn {
  token: string | null;
  channelName: string | null;
  uid: number | null;
  appId: string | null;
  isLoading: boolean;
  error: string | null;
  fetchToken: (channelName: string, uid: number, role?: string) => Promise<AgoraTokenResponse | null>;
}

/**
 * Hook for securely fetching Agora RTC tokens from the backend.
 *
 * The token is generated server-side to protect the Agora App Certificate
 * from being exposed to the client.
 *
 * Usage:
 * ```tsx
 * const { token, channelName, uid, appId, fetchToken, isLoading } = useFetchAgoraToken();
 *
 * const handleJoinInterview = async () => {
 *   await fetchToken("vh-session-123", 1, "publisher");
 * };
 * ```
 */
export const useFetchAgoraToken = ({
  apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
}: UseFetchAgoraTokenOptions = {}): UseFetchAgoraTokenReturn => {
  const [token, setToken] = useState<string | null>(null);
  const [channelName, setChannelName] = useState<string | null>(null);
  const [uid, setUid] = useState<number | null>(null);
  const [appId, setAppId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(
    async (
      channelName: string,
      uid: number,
      role: string = "publisher"
    ): Promise<AgoraTokenResponse | null> => {
      setIsLoading(true);
      setError(null);

      try {
        console.log(
          `🔐 Fetching Agora token for channel: ${channelName}, uid: ${uid}, role: ${role}`
        );

        const response = await fetch(`${apiUrl}/api/agora/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channel_name: channelName,
            uid: uid,
            role: role,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.detail || `Token fetch failed with status ${response.status}`
          );
        }

        const data: AgoraTokenResponse = await response.json();

        console.log("✅ Agora token fetched successfully");

        // Store token and related info
        setToken(data.token);
        setChannelName(data.channel_name);
        setUid(data.uid);
        setAppId(data.app_id);

        return data;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error("❌ Failed to fetch Agora token:", errorMsg);
        setError(errorMsg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [apiUrl]
  );

  return {
    token,
    channelName,
    uid,
    appId,
    isLoading,
    error,
    fetchToken,
  };
};

export default useFetchAgoraToken;
