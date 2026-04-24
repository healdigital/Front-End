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

# Safe defaults for static deploys. `scripts/build-site.mjs` downloads prepared-articles.json from PREPARED_JSON_URL.
ENV USE_LOCAL_JSON=1
ENV BUILD_ONLY_ARTICLE_PAGES=1
ENV BUILD_DISABLE_SEARCH=1

# Optional BuildKit secret file (`build_env`) for KEY=value lines (e.g. PREPARED_JSON_URL=...).
# Example local build:
# docker build --build-arg PREPARED_JSON_URL=https://.../prepared-articles.json -t lcdb-astro .
# docker build --secret id=build_env,src=.env.build -t lcdb-astro .
RUN --mount=type=secret,id=build_env,target=/run/secrets/build_env,required=false \
    set -e; \
    if [ -f /run/secrets/build_env ]; then set -a && . /run/secrets/build_env && set +a; fi; \
    if [ -z "${PREPARED_JSON_URL:-}" ]; then \
      echo 'ERROR: PREPARED_JSON_URL must be set for Docker build.' >&2; \
      echo 'scripts/build-site.mjs needs it to curl prepared-articles.json (USE_LOCAL_JSON + BUILD_ONLY_ARTICLE_PAGES).' >&2; \
      echo 'Set it in Coolify build-time env (enable "Available at build time") or in build_env secret.' >&2; \
      exit 1; \
    fi; \
    npm run build

FROM nginx:1.27-alpine AS runtime
WORKDIR /usr/share/nginx/html
COPY --from=builder /app/dist ./
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
