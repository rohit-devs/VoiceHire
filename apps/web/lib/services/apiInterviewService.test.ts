import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiInterviewService,
  setAuthToken,
  setAuthTokenProvider,
} from "./apiInterviewService";

describe("apiInterviewService request handling", () => {
  beforeEach(() => {
    setAuthToken(null);
    setAuthTokenProvider(null);
    vi.restoreAllMocks();
  });

  it("surfaces API detail when a request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: async () => ({ detail: "Profile storage is unavailable" }),
    }));

    await expect(apiInterviewService.getHistory()).rejects.toThrow(
      "Profile storage is unavailable",
    );
  });

  it("surfaces provider fallback guidance from structured API errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: async () => ({
        detail: { user_message: "Use text answers or start a demo interview." },
      }),
    }));

    await expect(apiInterviewService.generateNextQuestion("session-1", "answer"))
      .rejects.toThrow("Use text answers or start a demo interview.");
  });

  it("selects browser STT from provider readiness", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ providers: { stt: { status: "disabled", using: "browser" } } }),
    }));

    await expect(apiInterviewService.getSTTProvider()).resolves.toBe("browser");
  });

  it("posts recorded audio as multipart data with the current auth token", async () => {
    setAuthToken("fresh-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: "A spoken answer.", provider: "deepgram", model: "nova-3" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const audio = new Blob(["recorded audio"], { type: "audio/webm" });
    await expect(apiInterviewService.transcribeAudio("session-1", audio)).resolves.toEqual({
      text: "A spoken answer.",
      provider: "deepgram",
      model: "nova-3",
    });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/stt/transcribe?session_id=session-1");
    expect(options.method).toBe("POST");
    expect((options.headers as Record<string, string>).Authorization).toBe("******");
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).get("audio")).toBeInstanceOf(File);
  });

  it("uses a fresh Clerk token provider for each authenticated request", async () => {
    const tokenProvider = vi.fn().mockResolvedValue("fresh-clerk-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock);
    setAuthTokenProvider(tokenProvider);

    await apiInterviewService.getHistory();

    expect(tokenProvider).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>).Authorization).toBe(
      "Bearer fresh-clerk-token",
    );
  });
});
