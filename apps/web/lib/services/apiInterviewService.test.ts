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
