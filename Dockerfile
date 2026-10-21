# syntax=docker/dockerfile:1

# ── Build stage ──────────────────────────────────────────────────────────────
# Debian (glibc) base so the better-sqlite3 / sharp prebuilt binaries install
# cleanly without a compiler toolchain.
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Optional: SITE_URL, the public address for the social-share links built
# into static pages.
ARG SITE_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# The runtime stage installs its own node_modules, so the standalone copy and
# the build cache would only bloat the image.
RUN npm run build && rm -rf .next/cache .next/standalone

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    DATA_DIR=/data

# Production dependencies only (native modules fetched for this platform).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./next.config.ts

RUN mkdir -p /data && chown node:node /data
USER node

VOLUME ["/data"]
EXPOSE 3000
# Docker / docker compose health.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# Run Next directly (not via npm) so it gets SIGTERM and finishes in-flight
# requests when the host stops or replaces the container.
CMD ["node", "node_modules/next/dist/bin/next", "start"]
