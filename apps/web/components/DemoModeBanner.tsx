"use client";

import { useEffect, useState } from "react";

type AppMode = "demo" | "live";
type BannerState = AppMode | "loading" | "unavailable";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function DemoModeBanner() {
  const [state, setState] = useState<BannerState>("loading");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);

    fetch(`${API_URL}/`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Could not determine API mode: HTTP ${response.status}`);
        }
        const body: unknown = await response.json();
        if (
          typeof body !== "object" ||
          body === null ||
          !("mode" in body) ||
          (body.mode !== "demo" && body.mode !== "live")
        ) {
          throw new Error("API returned an invalid mode response");
        }
        if (active) setState(body.mode);
      })
      .catch(() => {
        if (active) setState("unavailable");
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
    : `API unreachable at ${API_URL} — start the backend`;
  return (
    <div className="pointer-events-none fixed left-0 right-0 top-3 z-50 flex justify-center px-3">
      <div
        role="status"
        className={`max-w-full rounded-full border px-3 py-1.5 text-center text-xs font-medium shadow-lg backdrop-blur ${
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
