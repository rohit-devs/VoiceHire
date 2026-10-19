import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAgoraVoice } from "./useAgoraVoice";

const agoraMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createMicrophoneAudioTrack: vi.fn(),
}));

vi.mock("agora-rtc-sdk-ng", () => ({
  default: {
    createClient: agoraMocks.createClient,
    createMicrophoneAudioTrack: agoraMocks.createMicrophoneAudioTrack,
  },
}));

function mockAgoraClient() {
  const listeners = new Map<string, (...args: never[]) => void>();
  const track = {
    stop: vi.fn(),
    close: vi.fn(),
    setMuted: vi.fn().mockResolvedValue(undefined),
  };
  const localTracks: unknown[] = [];
  const client = {
    localTracks,
    remoteUsers: [],
    on: vi.fn((event: string, listener: (...args: never[]) => void) => {
      listeners.set(event, listener);
    }),
    off: vi.fn((event: string) => {
      listeners.delete(event);
    }),
    join: vi.fn().mockResolvedValue(1),
    publish: vi.fn().mockImplementation(async (publishedTrack: unknown) => {
      client.localTracks = [publishedTrack];
    }),
    leave: vi.fn().mockResolvedValue(undefined),
    enableAudioVolumeIndicator: vi.fn(),
    subscribe: vi.fn().mockResolvedValue(undefined),
  };

  return { client, listeners, track };
}

describe("useAgoraVoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          token: "signed-token",
          channel_name: "vh-session-1",
          uid: 1,
          app_id: "a".repeat(32),
          expires_in_seconds: 3600,
        }),
      }),
    );
  });

  it("connects, supports mute, and releases the track, listeners, and channel", async () => {
    const { client, track } = mockAgoraClient();
    agoraMocks.createClient.mockReturnValue(client);
    agoraMocks.createMicrophoneAudioTrack.mockResolvedValue(track);

    const { result, unmount } = renderHook(() =>
      useAgoraVoice({ sessionId: "session-1", authToken: "clerk-token" }),
    );

    await act(async () => {
      await result.current.join();
    });
    expect(result.current.state).toBe("connected");

    await act(async () => {
      await result.current.mute();
    });
    expect(result.current.isMuted).toBe(true);
    expect(track.setMuted).toHaveBeenCalledWith(true);

    unmount();
    await waitFor(() => {
      expect(track.stop).toHaveBeenCalledOnce();
      expect(track.close).toHaveBeenCalledOnce();
      expect(client.leave).toHaveBeenCalledOnce();
    });
    expect(client.off).toHaveBeenCalledTimes(6);
  });

  it("reports a denied microphone permission with a dedicated state", async () => {
    const permissionError = Object.assign(new Error("Permission denied"), {
      name: "NotAllowedError",
    });
    agoraMocks.createMicrophoneAudioTrack.mockRejectedValue(permissionError);

    const { result } = renderHook(() => useAgoraVoice({ sessionId: "session-1" }));
    await act(async () => {
      await result.current.join();
    });

    expect(result.current.state).toBe("permission-denied");
    expect(result.current.error).toBe("Permission denied");
  });
});
