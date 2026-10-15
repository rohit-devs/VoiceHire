FROM node:20-alpine AS builder

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile

ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
RUN pnpm --filter @voicehire/web build

FROM node:20-alpine AS runner

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/prompts/package.json packages/prompts/package.json
RUN pnpm install --prod --filter @voicehire/web --frozen-lockfile
COPY --from=builder /workspace/apps/web /workspace/apps/web

ENV NODE_ENV=production \
    PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=12 \
    CMD node -e "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["pnpm", "--filter", "@voicehire/web", "start"]
