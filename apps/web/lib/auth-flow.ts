/**
 * Single source of truth for where each visitor should land.
 * Pure functions only: no Clerk, no Next imports, so it works in middleware,
 * server components, client components, and unit tests, in demo mode and with Clerk.
 *
 * Flow:
 *   visitor      -> "/"            landing page (Create account / Sign in / Try demo)
 *   new user     -> /sign-up       -> /onboarding -> /dashboard
 *   returning    -> /sign-in       -> /dashboard
 *   signed in    -> "/", /sign-in, /sign-up bounce to /dashboard (or /onboarding)
 *   not onboarded-> any protected page bounces to /onboarding
 *   signed out   -> protected page bounces to /sign-in?redirect_url=<original page>
 */

export const ROUTES = {
  home: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
  onboarding: "/onboarding",
  dashboard: "/dashboard",
} as const;

const AUTH_PAGES = [ROUTES.signIn, ROUTES.signUp];

export interface FlowInput {
  pathname: string;
  search?: string; // include the leading "?" if present
  isAuthenticated: boolean;
  onboardingComplete: boolean;
  /** Set false to let signed-in users still see the landing page. Default true. */
  redirectHomeWhenSignedIn?: boolean;
}

function startsWithSegment(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((page) => startsWithSegment(pathname, page));
}

/** Public pages: landing and the auth pages. Everything else needs a session. */
export function isPublicPath(pathname: string): boolean {
  return pathname === ROUTES.home || isAuthPage(pathname);
}

/**
 * Only allow same-site relative paths as post-login targets.
 * Blocks open redirects such as "//evil.com" or "https://evil.com".
 */
export function safeRedirectTarget(
  raw: string | null | undefined,
  fallback: string = ROUTES.dashboard,
): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return fallback;
  }
  if (isAuthPage(raw.split("?")[0])) return fallback;
  return raw;
}

/** Returns the path to redirect to, or null if the visitor may stay where they are. */
export function resolveFlowRedirect(input: FlowInput): string | null {
  const {
    pathname,
    search = "",
    isAuthenticated,
    onboardingComplete,
    redirectHomeWhenSignedIn = true,
  } = input;

  const home = onboardingComplete ? ROUTES.dashboard : ROUTES.onboarding;

  if (!isAuthenticated) {
    if (isPublicPath(pathname)) return null;
    const target = encodeURIComponent(`${pathname}${search}`);
    return `${ROUTES.signIn}?redirect_url=${target}`;
  }

  if (isAuthPage(pathname)) return home;
  if (pathname === ROUTES.home) return redirectHomeWhenSignedIn ? home : null;

  if (startsWithSegment(pathname, ROUTES.onboarding)) {
    return onboardingComplete ? ROUTES.dashboard : null;
  }
  if (!onboardingComplete) return ROUTES.onboarding;

  return null;
}
