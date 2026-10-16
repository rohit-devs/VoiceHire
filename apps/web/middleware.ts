import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);

const clerkHandler = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  const localDemoEnabled =
    process.env.APP_ENV === "development" &&
    process.env.DEMO_MODE === "true" &&
    !process.env.CLERK_SECRET_KEY &&
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (localDemoEnabled) return NextResponse.next();
  return clerkHandler(request, event);
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
