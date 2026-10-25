import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiInterviewService } from "./apiInterviewService";
import { getOrCreateGuestId } from "@/lib/guest";

vi.mock("@/lib/guest", () => ({
  getOrCreateGuestId: vi.fn(() => "test-guest-uuid-v4-1234-4abc-8def-123456789abc"),
  GUEST_ID_HEADER: "x-guest-id",
  getGuestId: vi.fn(() => "test-guest-uuid-v4-1234-4abc-8def-123456789abc"),
  isValidGuestId: vi.fn(() => true),
}));

describe("apiInterviewService request handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(getOrCreateGuestId).mockReturnValue("test-guest-uuid-v4-1234-4abc-8def-123456789abc");
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

  it("posts recorded audio as multipart data with the guest ID header", async () => {
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
    expect((options.headers as Record<string, string>)["x-guest-id"]).toBe(
      "test-guest-uuid-v4-1234-4abc-8def-123456789abc",
    );
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).get("audio")).toBeInstanceOf(File);
  });

  it("uses a stable guest ID from localStorage for each authenticated request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiInterviewService.getHistory();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)["x-guest-id"]).toBe(
      "test-guest-uuid-v4-1234-4abc-8def-123456789abc",
    );
  });

  it("retries idempotent GET on 503 and succeeds on retry", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        json: async () => ({ detail: "down" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        json: async () => ({ detail: "down" }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: "OK", json: async () => [{ id: "s1", duration_seconds: 0 }] });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiInterviewService.getHistory()).resolves.toEqual([
      {
        id: "s1",
        role: undefined,
        difficulty: undefined,
        experienceLevel: "",
        interviewType: undefined,
        persona: undefined,
        pressureMode: false,
        duration: 0,
        company: undefined,
        agoraChannel: undefined,
        isDemo: undefined,
        createdAt: undefined,
        status: undefined,
        currentState: undefined,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry GET on 404", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ detail: "not found" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiInterviewService.getInterview("missing")).rejects.toThrow("not found");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry non-idempotent POST on 503", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: async () => ({ detail: "overloaded" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiInterviewService.generateNextQuestion("session-1", "answer"))
      .rejects.toThrow("overloaded");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries idempotent GET on network error", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: "OK", json: async () => [{ id: "s1", duration_seconds: 0 }] });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiInterviewService.getHistory()).resolves.toEqual([
      {
        id: "s1",
        role: undefined,
        difficulty: undefined,
        experienceLevel: "",
        interviewType: undefined,
        persona: undefined,
        pressureMode: false,
        duration: 0,
        company: undefined,
        agoraChannel: undefined,
        isDemo: undefined,
        createdAt: undefined,
        status: undefined,
        currentState: undefined,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting retries on persistent 503", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: async () => ({ detail: "persistently down" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiInterviewService.getHistory()).rejects.toThrow("persistently down");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
