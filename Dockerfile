# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

FROM base AS builder
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Coolify "buildtime" vars are often passed as `docker build --build-arg`; map here so npm sees them.
ARG PREPARED_JSON_URL
ENV PREPARED_JSON_URL=${PREPARED_JSON_URL}

# SSR-first deploy defaults: backend APIs are source of truth.
ENV USE_LOCAL_JSON=0
ENV BUILD_ONLY_ARTICLE_PAGES=0
ENV BUILD_DISABLE_SEARCH=0

# Optional BuildKit secret file (`build_env`) for KEY=value lines (e.g. PREPARED_JSON_URL=...).
RUN --mount=type=secret,id=build_env,target=/run/secrets/build_env,required=false \
    set -e; \
    if [ -f /run/secrets/build_env ]; then set -a && . /run/secrets/build_env && set +a; fi; \
    npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends wget ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:${PORT:-4321}/healthz | grep -q ok || exit 1

CMD ["node", "./dist/server/entry.mjs"]
