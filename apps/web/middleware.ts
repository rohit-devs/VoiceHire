import { authMiddleware } from "@clerk/nextjs";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";

const clerkMiddleware = authMiddleware({
  publicRoutes: ["/", "/sign-in(.*)", "/sign-up(.*)"],
});

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  const localDemoEnabled =
    process.env.APP_ENV === "development" &&
    process.env.DEMO_MODE === "true" &&
    !process.env.CLERK_SECRET_KEY &&
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (localDemoEnabled) return NextResponse.next();
  return clerkMiddleware(request, event);
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
