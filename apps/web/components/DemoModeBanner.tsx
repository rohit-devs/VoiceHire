"use client";

import { useEffect, useState } from "react";

type BannerState = "demo" | "live" | "loading" | "unavailable";

export default function DemoModeBanner() {
  const [state, setState] = useState<BannerState>("loading");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);

    fetch("/api/health/ready", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Could not determine API mode: HTTP ${response.status}`);
        }
        const body: unknown = await response.json();
        if (
          typeof body !== "object" ||
          body === null ||
          !("demo_mode" in body) ||
          typeof body.demo_mode !== "boolean"
        ) {
          throw new Error("API returned an invalid mode response");
        }
        if (active) setState(body.demo_mode ? "demo" : "live");
      })
      .catch(() => {
        if (active) setState("unavailable");
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  if (state === "loading" || state === "live") return null;
  if (state === "unavailable" && process.env.NODE_ENV === "production") {
    return null;
  }

  const isDemo = state === "demo";
  const message = isDemo
    ? "Demo mode — simulated sessions are opt-in and labeled separately"
    : `API unreachable at ${new URL("/api", window.location.href).toString()} — start the backend`;
  return (
    <div className="flex justify-center px-3 py-2">
      <div
        role="status"
        className={`max-w-full rounded-full border px-3 py-1 text-center text-xs font-medium ${
          isDemo
            ? "border-amber-300/30 bg-amber-950/90 text-amber-100"
            : "border-slate-600 bg-slate-900/95 text-slate-200"
        }`}
      >
        {message}
      </div>
    </div>
  );
}
