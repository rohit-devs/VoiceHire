import { describe, expect, it } from "vitest";

import {
  ROUTES,
  isAuthPage,
  isPublicPath,
  resolveFlowRedirect,
  safeRedirectTarget,
} from "./auth-flow";

const signedOut = { isAuthenticated: false, onboardingComplete: false };
const newUser = { isAuthenticated: true, onboardingComplete: false };
const member = { isAuthenticated: true, onboardingComplete: true };

describe("path helpers", () => {
  it("treats landing and auth pages as public", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/sign-in")).toBe(true);
    expect(isPublicPath("/sign-up/verify-email")).toBe(true);
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/sign-inside")).toBe(false);
  });

  it("detects auth pages by whole segment", () => {
    expect(isAuthPage("/sign-in/factor-one")).toBe(true);
    expect(isAuthPage("/sign-in-help")).toBe(false);
  });
});

describe("safeRedirectTarget", () => {
  it("accepts same-site relative paths", () => {
    expect(safeRedirectTarget("/reports/abc?x=1")).toBe("/reports/abc?x=1");
  });

  it("rejects open redirects and falls back", () => {
    expect(safeRedirectTarget("//evil.com")).toBe(ROUTES.dashboard);
    expect(safeRedirectTarget("https://evil.com")).toBe(ROUTES.dashboard);
    expect(safeRedirectTarget("/\\evil.com")).toBe(ROUTES.dashboard);
    expect(safeRedirectTarget(null)).toBe(ROUTES.dashboard);
  });

  it("never loops back to an auth page", () => {
    expect(safeRedirectTarget("/sign-in")).toBe(ROUTES.dashboard);
  });
});

describe("resolveFlowRedirect: signed out", () => {
  it("lets visitors see landing and auth pages", () => {
    for (const pathname of ["/", "/sign-in", "/sign-up"]) {
      expect(resolveFlowRedirect({ ...signedOut, pathname })).toBeNull();
    }
  });

  it("sends protected pages to sign-in and remembers the target", () => {
    expect(
      resolveFlowRedirect({
        ...signedOut,
        pathname: "/reports/abc",
        search: "?tab=plan",
      }),
    ).toBe("/sign-in?redirect_url=%2Freports%2Fabc%3Ftab%3Dplan");
  });
});

describe("resolveFlowRedirect: new user (signed in, not onboarded)", () => {
  it("bounces landing and auth pages to onboarding", () => {
    for (const pathname of ["/", "/sign-in", "/sign-up"]) {
      expect(resolveFlowRedirect({ ...newUser, pathname })).toBe(
        ROUTES.onboarding,
      );
    }
  });

  it("keeps them on onboarding and forces other pages there", () => {
    expect(
      resolveFlowRedirect({ ...newUser, pathname: "/onboarding" }),
    ).toBeNull();
    expect(
      resolveFlowRedirect({ ...newUser, pathname: "/dashboard" }),
    ).toBe(ROUTES.onboarding);
  });
});

describe("resolveFlowRedirect: onboarded member", () => {
  it("bounces landing and auth pages to the dashboard", () => {
    for (const pathname of ["/", "/sign-in", "/sign-up"]) {
      expect(resolveFlowRedirect({ ...member, pathname })).toBe(
        ROUTES.dashboard,
      );
    }
  });

  it("does not send finished users back to onboarding", () => {
    expect(
      resolveFlowRedirect({ ...member, pathname: "/onboarding" }),
    ).toBe(ROUTES.dashboard);
  });

  it("lets them use protected pages", () => {
    expect(
      resolveFlowRedirect({ ...member, pathname: "/interview/new" }),
    ).toBeNull();
  });

  it("can keep the landing page visible when configured", () => {
    expect(
      resolveFlowRedirect({
        ...member,
        pathname: "/",
        redirectHomeWhenSignedIn: false,
      }),
    ).toBeNull();
  });
});
