import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { getAuthMode, resolveFlowRedirect } from "@/lib/auth-mode";

async function checkOnboardingComplete(token?: string | null): Promise<boolean> {
  const apiInternalUrl = (process.env.API_INTERNAL_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${apiInternalUrl}/api/users/me`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { target_role?: string | null };
    return Boolean(data?.target_role && data.target_role.trim().length > 0);
  } catch {
    return false;
  }
}

const clerkHandler = clerkMiddleware(async (auth, request) => {
  const { userId, getToken } = await auth();
  const isAuthenticated = Boolean(userId);
  let onboardingComplete = false;
  if (isAuthenticated) {
    const token = await getToken();
    onboardingComplete = await checkOnboardingComplete(token);
  }
  const redirectPath = resolveFlowRedirect({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    isAuthenticated,
    onboardingComplete,
  });
  if (redirectPath) {
    return NextResponse.redirect(new URL(redirectPath, request.url));
  }
  return NextResponse.next();
});

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api") || pathname.startsWith("/trpc")) {
    return NextResponse.next();
  }

  const authMode = getAuthMode({
    APP_ENV: process.env.APP_ENV,
    DEMO_MODE: process.env.DEMO_MODE,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  });

  if (authMode === "local-demo") return NextResponse.next();

  if (authMode === "unavailable") {
    const redirectPath = resolveFlowRedirect({
      pathname,
      search,
      isAuthenticated: false,
      onboardingComplete: false,
    });
    if (redirectPath) {
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }
    return NextResponse.next();
  }

  return clerkHandler(request, event);
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
