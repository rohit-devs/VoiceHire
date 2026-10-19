import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiInternalUrl = (
  process.env.API_INTERNAL_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");
const allowedDevOrigins = (process.env.DEV_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  allowedDevOrigins,
  serverExternalPackages: ['pg', 'pgvector', 'agora-rtc-sdk-ng'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    NEXT_PUBLIC_APP_ENV: process.env.APP_ENV || process.env.NODE_ENV || 'development',
    NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE || process.env.DEMO_MODE || 'false',
  },
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
        ],
      },
    ]
  },
  rewrites: async () => [
    {
      source: '/api/:path*',
      destination: `${apiInternalUrl}/api/:path*`,
    },
  ],
}

export default nextConfig
