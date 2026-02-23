const DEFAULT_UPSTREAM_URL =
  "https://atelier-lacuisinedebernard.com/api/upcoming-workshops";

const EDGE_TTL_SECONDS = 300;
const CLIENT_MAX_AGE_SECONDS = 60;
const BACKUP_TTL_SECONDS = 86400;
const UPSTREAM_TIMEOUT_MS = 2500;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

function baseHeaders(cacheControl) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cacheControl,
    ...CORS_HEADERS,
  };
}

function makeJsonResponse(body, cacheControl, status = 200) {
  return new Response(body, {
    status,
    headers: baseHeaders(cacheControl),
  });
}

function fallbackBody() {
  return JSON.stringify({
    items: [],
    error: "upstream_unavailable",
  });
}

function withMethod(request, method = "GET") {
  return new Request(request.url, { method });
}

function withBackupKey(request) {
  const url = new URL(request.url);
  url.searchParams.set("__backup", "1");
  return new Request(url.toString(), { method: "GET" });
}

async function fetchUpstreamJson(upstreamUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cf: {
        cacheEverything: true,
        cacheTtl: EDGE_TTL_SECONDS,
      },
      signal: controller.signal,
    });

    if (!upstream.ok) {
      throw new Error(`upstream_status_${upstream.status}`);
    }

    const body = await upstream.text();
    JSON.parse(body);
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

function toHeadResponse(response) {
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}

function stampStaleHeaders(headers) {
  const next = new Headers(headers);
  next.set(
    "Cache-Control",
    `public, max-age=${CLIENT_MAX_AGE_SECONDS}, s-maxage=${EDGE_TTL_SECONDS}`,
  );
  next.set("Content-Type", "application/json; charset=utf-8");
  next.set("X-Workshops-Cache", "stale");
  return next;
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD, OPTIONS", ...CORS_HEADERS },
      });
    }

    const upstreamUrl = env.WORKSHOPS_UPSTREAM_URL || DEFAULT_UPSTREAM_URL;
    const cache = caches.default;
    const primaryKey = withMethod(request, "GET");
    const backupKey = withBackupKey(request);

    const freshCached = await cache.match(primaryKey);
    if (freshCached) {
      return request.method === "HEAD" ? toHeadResponse(freshCached) : freshCached;
    }

    try {
      const body = await fetchUpstreamJson(upstreamUrl);

      const freshResponse = makeJsonResponse(
        body,
        `public, max-age=${CLIENT_MAX_AGE_SECONDS}, s-maxage=${EDGE_TTL_SECONDS}`,
      );

      const backupResponse = makeJsonResponse(
        body,
        `public, max-age=${CLIENT_MAX_AGE_SECONDS}, s-maxage=${BACKUP_TTL_SECONDS}`,
      );

      ctx.waitUntil(
        Promise.all([
          cache.put(primaryKey, freshResponse.clone()),
          cache.put(backupKey, backupResponse.clone()),
        ]),
      );

      return request.method === "HEAD"
        ? toHeadResponse(freshResponse)
        : freshResponse;
    } catch (error) {
      const stale =
        (await cache.match(primaryKey)) || (await cache.match(backupKey));

      if (stale) {
        const staleBody = await stale.text();
        const staleResponse = new Response(staleBody, {
          status: 200,
          headers: stampStaleHeaders(stale.headers),
        });
        return request.method === "HEAD"
          ? toHeadResponse(staleResponse)
          : staleResponse;
      }

      return request.method === "HEAD"
        ? new Response(null, {
            status: 200,
            headers: baseHeaders("public, max-age=30, s-maxage=30"),
          })
        : makeJsonResponse(
            fallbackBody(),
            "public, max-age=30, s-maxage=30",
            200,
          );
    }
  },
};
