import type { APIRoute } from 'astro';

const DEEPL_PRO_URL = 'https://api.deepl.com/v2/translate';
const DEEPL_FREE_URL = 'https://api-free.deepl.com/v2/translate';
const DEFAULT_DEEPL_ALLOWED_HOSTS = ['api.deepl.com', 'api-free.deepl.com'];
const DEFAULT_ALLOWED_ORIGINS = [
  'https://lacuisinedebernard.com',
  'https://www.lacuisinedebernard.com',
  'https://staging.lacuisinedebernard.com',
  'http://localhost:4321',
  'http://127.0.0.1:4321',
];
const isDev = import.meta.env.DEV;
// Translate API needs runtime request handling for POST/headers.
export const prerender = false;

const languageMap: Record<string, string> = {
  en: 'EN-GB',
  'en-gb': 'EN-GB',
  fr: 'FR',
  'fr-fr': 'FR',
  es: 'ES',
  'es-es': 'ES',
  pt: 'PT-PT',
  'pt-br': 'PT-PT',
  'pt-pt': 'PT-PT',
  ar: 'AR',
};

const normalizeTargetLang = (value?: string): string | null => {
  if (!value) return null;
  const lowered = value.toLowerCase();
  if (languageMap[lowered]) return languageMap[lowered];
  return value.toUpperCase();
};

const normalizeOrigin = (value?: string | null): string | null => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const parseAllowedOrigins = (request: Request): Set<string> => {
  const configured = String(process.env.TRANSLATE_ALLOWED_ORIGINS || '')
    .split(/[,\n;]+/)
    .map((item) => normalizeOrigin(item.trim()))
    .filter((item): item is string => Boolean(item));

  const requestOrigin = normalizeOrigin(request.url);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured, requestOrigin].filter(Boolean) as string[]);
};

const getRequestOrigin = (request: Request): string | null => {
  const fromOriginHeader = normalizeOrigin(request.headers.get('origin'));
  if (fromOriginHeader) return fromOriginHeader;
  return normalizeOrigin(request.headers.get('referer'));
};

const withCors = (response: Response, requestOrigin?: string | null): Response => {
  const headers = new Headers(response.headers);
  if (requestOrigin) {
    headers.set('Access-Control-Allow-Origin', requestOrigin);
  }
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, headers });
};

const assertAllowedOrigin = (
  request: Request,
): { allowed: true; origin: string } | { allowed: false; origin: string | null } => {
  const requestOrigin = getRequestOrigin(request);
  const serverOrigin = normalizeOrigin(request.url);

  // Same-origin browser/dev-server requests may not include Origin/Referer.
  // Allow them by falling back to the request URL origin.
  if (!requestOrigin) {
    if (serverOrigin) return { allowed: true, origin: serverOrigin };
    return { allowed: false, origin: null };
  }

  const allowedOrigins = parseAllowedOrigins(request);
  if (!allowedOrigins.has(requestOrigin)) return { allowed: false, origin: requestOrigin };

  return { allowed: true, origin: requestOrigin };
};

const parseAllowedDeepLHosts = (): Set<string> => {
  const configuredHosts = String(process.env.DEEPL_ALLOWED_HOSTS || '')
    .split(/[,\n;]+/)
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  return new Set([...DEFAULT_DEEPL_ALLOWED_HOSTS, ...configuredHosts]);
};

const isLikelyDeepLFreeKey = (apiKey: string): boolean => apiKey.trim().toLowerCase().endsWith(':fx');

const resolveDeepLApiUrl = (
  value: string | undefined,
  apiKey: string,
): { ok: true; value: string } | { ok: false; error: string } => {
  const defaultUrl = isLikelyDeepLFreeKey(apiKey) ? DEEPL_FREE_URL : DEEPL_PRO_URL;
  const target = value && value.trim().length > 0 ? value.trim() : defaultUrl;

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return { ok: false, error: 'DEEPL_API_URL is invalid.' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'DEEPL_API_URL must use HTTPS.' };
  }

  const allowedHosts = parseAllowedDeepLHosts();
  const host = parsed.hostname.toLowerCase();
  if (!allowedHosts.has(host)) {
    return {
      ok: false,
      error: `DEEPL_API_URL host "${host}" is not allowed.`,
    };
  }

  return { ok: true, value: parsed.toString() };
};

export const OPTIONS: APIRoute = async ({ request }) => {
  if (!isDev) {
    return withCors(new Response(null, { status: 204 }));
  }

  const originCheck = assertAllowedOrigin(request);
  if (!originCheck.allowed) {
    return withCors(
      new Response(JSON.stringify({ error: 'Origin not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
      originCheck.origin,
    );
  }

  return withCors(new Response(null, { status: 204 }), originCheck.origin);
};

export const GET: APIRoute = async ({ request }) => {
  if (!isDev) {
    return withCors(
      new Response(
        JSON.stringify({ error: 'Translate API disabled in static production build.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }

  const originCheck = assertAllowedOrigin(request);
  if (!originCheck.allowed) {
    return withCors(
      new Response(JSON.stringify({ error: 'Origin not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
      originCheck.origin,
    );
  }

  if (isDev) {
    return withCors(
      new Response(
        JSON.stringify({ error: 'Use POST for translation in dev.' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } },
      ),
      originCheck.origin,
    );
  }

  return withCors(new Response(JSON.stringify({ error: 'Translate API disabled in static production build.' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  }));
};

export const POST: APIRoute = async ({ request }) => {
  if (!isDev) {
    return withCors(
      new Response(
        JSON.stringify({ error: 'Translate API disabled in static production build.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }

  const originCheck = assertAllowedOrigin(request);
  if (!originCheck.allowed) {
    return withCors(
      new Response(JSON.stringify({ error: 'Origin not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
      originCheck.origin,
    );
  }

  const apiKey = process.env.DEEPL_API_KEY;

  if (!apiKey) {
    return withCors(
      new Response(JSON.stringify({ error: 'DEEPL_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
      originCheck.origin,
    );
  }

  const apiUrlResult = resolveDeepLApiUrl(process.env.DEEPL_API_URL, apiKey);

  if (!apiUrlResult.ok) {
    return withCors(
      new Response(JSON.stringify({ error: apiUrlResult.error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
      originCheck.origin,
    );
  }

  const apiUrl = apiUrlResult.value;

  const contentType = request.headers.get('content-type') || '';
  let targetLang: string | null = null;
  let texts: string[] = [];

  const buffer = await request.arrayBuffer();
  const raw = new TextDecoder().decode(buffer || new ArrayBuffer(0));

  if (!raw) {
    return withCors(
      new Response(
        JSON.stringify({
          error: 'Empty request body',
          contentType,
          contentLength: request.headers.get('content-length') || '',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
      originCheck.origin,
    );
  }

  const isForm =
    contentType.includes('application/x-www-form-urlencoded') ||
    raw.includes('targetLang=');

  if (isForm) {
    const params = new URLSearchParams(raw);
    targetLang = normalizeTargetLang(String(params.get('targetLang') || ''));
    texts = params.getAll('text').map((text) => String(text ?? '').trim()).filter(Boolean);
  } else {
    try {
      const body = JSON.parse(raw);
      const rawTarget = body?.targetLang || body?.target || body?.target_lang;
      targetLang = normalizeTargetLang(rawTarget);
      texts = Array.isArray(body?.texts)
        ? body.texts.map((text: unknown) => String(text ?? '').trim()).filter(Boolean)
        : [];
    } catch {
      return withCors(
        new Response(
          JSON.stringify({
            error: 'Invalid JSON body',
            contentType,
            bodyPreview: raw.slice(0, 200),
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
        originCheck.origin,
      );
    }
  }

  if (!targetLang) {
    return withCors(
      new Response(JSON.stringify({ error: 'targetLang is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
      originCheck.origin,
    );
  }

  if (!texts.length) {
    return withCors(
      new Response(JSON.stringify({ error: 'texts must be a non-empty array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
      originCheck.origin,
    );
  }

  const params = new URLSearchParams();
  params.append('target_lang', targetLang);
  texts.forEach((text) => params.append('text', text));

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `DeepL-Auth-Key ${apiKey.trim()}`,
    },
    body: params,
  });

  if (!response.ok) {
    const errorText = await response.text();
    return withCors(
      new Response(
        JSON.stringify({ error: 'DeepL request failed', details: errorText }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      ),
      originCheck.origin,
    );
  }

  const data: unknown = await response.json();
  const rawTranslations =
    typeof data === 'object' && data !== null && 'translations' in data
      ? (data as { translations?: unknown }).translations
      : undefined;

  const translations = Array.isArray(rawTranslations)
    ? rawTranslations.map((item) => {
        if (typeof item === 'object' && item !== null && 'text' in item) {
          return String((item as { text?: unknown }).text ?? '');
        }
        return '';
      })
    : [];

  return withCors(
    new Response(JSON.stringify({ translations }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
    originCheck.origin,
  );
};
