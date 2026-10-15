"use client";

import { useEffect, useState } from "react";

type AppMode = "demo" | "live" | "unknown";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function DemoModeBanner() {
  const [mode, setMode] = useState<AppMode>("unknown");

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/`, { cache: "no-store" })
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
        if (active) setMode(body.mode);
      })
      .catch((error: unknown) => {
        console.error("Could not determine VoiceHire runtime mode:", error);
        if (active) setMode("unknown");
      });

    return () => {
      active = false;
    };
  }, []);

  if (mode === "live") return null;

  const message =
    mode === "demo"
      ? "DEMO FEATURES ENABLED — simulated sessions are opt-in and labeled separately."
      : "MODE UNKNOWN — unable to verify whether this session uses demo or live data.";

  return (
    <div
      role="status"
      className={`px-4 py-2 text-center text-xs font-semibold tracking-wide ${
        mode === "demo"
          ? "bg-amber-300 text-amber-950"
          : "bg-rose-700 text-white"
      }`}
    >
      {message}
    </div>
  );
}
