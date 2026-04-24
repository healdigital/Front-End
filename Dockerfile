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

# Safe defaults for static deploys. Override only with non-sensitive values if needed.
ENV USE_LOCAL_JSON=1
ENV BUILD_ONLY_ARTICLE_PAGES=1
ENV BUILD_DISABLE_SEARCH=1

# Optional BuildKit secret file (`build_env`) for non-sensitive build configuration.
# Example local build:
# docker build --secret id=build_env,src=.env.build -t lcdb-astro:secure .
RUN --mount=type=secret,id=build_env,target=/run/secrets/build_env,required=false \
    set -e; \
    if [ -f /run/secrets/build_env ]; then set -a && . /run/secrets/build_env && set +a; fi; \
    npm run build

FROM nginx:1.27-alpine AS runtime
WORKDIR /usr/share/nginx/html
COPY --from=builder /app/dist ./
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
