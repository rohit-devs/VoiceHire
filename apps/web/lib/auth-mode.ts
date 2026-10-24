export type AuthMode = "clerk" | "better-auth" | "local-demo" | "unavailable";

export function getAuthMode(
  env: Record<string, string | undefined> = process.env,
): AuthMode {
  const isDemo = env.DEMO_MODE === "true" || env.NEXT_PUBLIC_DEMO_MODE === "true";
  const isDev =
    env.APP_ENV === "development" || env.NEXT_PUBLIC_APP_ENV === "development";
  const hasClerk = Boolean(
    env.CLERK_SECRET_KEY && env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );
  const hasBetterAuth = Boolean(
    env.BETTER_AUTH_SECRET && env.BETTER_AUTH_SECRET.length >= 32,
  );

  if (hasClerk) return "clerk";
  if (hasBetterAuth) return "better-auth";
  if (isDemo && isDev) return "local-demo";
  return "unavailable";
}

export * from "./auth-flow";