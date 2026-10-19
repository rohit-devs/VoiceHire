export type AuthMode = "clerk" | "local-demo" | "unavailable";

type AuthEnvironment = {
  [key: string]: string | undefined;
  APP_ENV?: string;
  DEMO_MODE?: string;
  NEXT_PUBLIC_APP_ENV?: string;
  NEXT_PUBLIC_DEMO_MODE?: string;
  CLERK_SECRET_KEY?: string;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
};

const runtimeEnvironment: AuthEnvironment = {
  APP_ENV: process.env.APP_ENV,
  DEMO_MODE: process.env.DEMO_MODE,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
};

export function getAuthMode(environment = runtimeEnvironment): AuthMode {
  const appEnv = environment.APP_ENV ?? environment.NEXT_PUBLIC_APP_ENV;
  const demoMode = environment.DEMO_MODE ?? environment.NEXT_PUBLIC_DEMO_MODE;
  const hasSecretKey = Boolean(environment.CLERK_SECRET_KEY?.trim());
  const hasPublishableKey = Boolean(
    environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim(),
  );

  if (hasSecretKey && hasPublishableKey) return "clerk";
  if (
    !hasSecretKey &&
    !hasPublishableKey &&
    appEnv === "development" &&
    demoMode === "true"
  ) {
    return "local-demo";
  }
  return "unavailable";
}
