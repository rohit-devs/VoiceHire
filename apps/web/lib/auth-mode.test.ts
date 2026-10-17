import { describe, expect, it } from "vitest";
import { getAuthMode } from "./auth-mode";

describe("getAuthMode", () => {
  it("uses Clerk only when both server and publishable keys are configured", () => {
    expect(
      getAuthMode({
        CLERK_SECRET_KEY: "secret",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "publishable",
      }),
    ).toBe("clerk");
    expect(
      getAuthMode({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "publishable" }),
    ).toBe("unavailable");
  });

  it("enables the local demo only with explicit development flags and no Clerk keys", () => {
    expect(
      getAuthMode({
        NEXT_PUBLIC_APP_ENV: "development",
        NEXT_PUBLIC_DEMO_MODE: "true",
      }),
    ).toBe("local-demo");
    expect(
      getAuthMode({
        NEXT_PUBLIC_APP_ENV: "production",
        NEXT_PUBLIC_DEMO_MODE: "true",
      }),
    ).toBe("unavailable");
    expect(
      getAuthMode({
        NEXT_PUBLIC_APP_ENV: "development",
        NEXT_PUBLIC_DEMO_MODE: "true",
        CLERK_SECRET_KEY: "secret",
      }),
    ).toBe("unavailable");
  });

  it("uses server runtime flags when middleware does not receive the public aliases", () => {
    expect(
      getAuthMode({
        APP_ENV: "development",
        DEMO_MODE: "true",
      }),
    ).toBe("local-demo");
    expect(
      getAuthMode({
        APP_ENV: "production",
        DEMO_MODE: "true",
      }),
    ).toBe("unavailable");
  });

  it("does not enable authentication when no mode is configured", () => {
    expect(getAuthMode({})).toBe("unavailable");
  });
});
