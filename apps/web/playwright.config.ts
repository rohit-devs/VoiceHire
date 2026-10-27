import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const isWin = process.platform === "win32";
const apiPython = isWin ? ".venv\\Scripts\\python.exe" : "python";
const databasePath = path.join(tmpdir(), `voicehire-playwright-${process.pid}.db`);
const apiUrl = "http://127.0.0.1:8100";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3101",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: `${apiPython} -m uvicorn app.main:app --host 127.0.0.1 --port 8100`,
      url: `${apiUrl}/api/health/ready`,
      cwd: "../api",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        APP_ENV: "development",
        DEMO_MODE: "true",
        DATABASE_URL: `sqlite+aiosqlite:///${databasePath.replace(/\\/g, "/")}`,
        CORS_ORIGINS: "http://127.0.0.1:3101",
        CLERK_SECRET_KEY: "",
        CLERK_JWT_JWKS_URL: "",
        GROQ_API_KEY: "",
        DEEPGRAM_API_KEY: "",
        STT_PROVIDER: "browser",
        AGORA_APP_ID: "",
        AGORA_APP_CERTIFICATE: "",
      },
    },
    {
      command: "pnpm --filter @voicehire/web dev --hostname 127.0.0.1 --port 3101",
      url: "http://127.0.0.1:3101",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        APP_ENV: "development",
        DEMO_MODE: "true",
        NEXT_PUBLIC_DEMO_MODE: "true",
        NEXT_DIST_DIR: ".next-playwright",
        API_INTERNAL_URL: apiUrl,
        DEV_ALLOWED_ORIGINS: "127.0.0.1,localhost",
        CLERK_SECRET_KEY: "",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
        NEXT_PUBLIC_API_URL: "",
      },
    },
  ],
});
