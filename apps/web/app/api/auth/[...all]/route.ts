/**
 * Better Auth catch-all route handler.
 * Mounts at /api/auth/* and delegates every request to the BA server instance.
 *
 * Note: this path is already excluded from the Next.js API rewrite to the FastAPI
 * backend in next.config.js — the rewrite is `/api/:path*` → FastAPI, and Next
 * routes take precedence over rewrites for files that exist on disk.
 * Better Auth owns /api/auth/*; FastAPI owns all other /api/* paths.
 */

import { auth } from "@/lib/auth";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return auth.handler(request);
}

export async function POST(request: NextRequest) {
  return auth.handler(request);
}
