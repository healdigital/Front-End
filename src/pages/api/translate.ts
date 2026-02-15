import type { APIRoute } from 'astro';

const DEFAULT_DEEPL_URL = 'https://api.deepl.com/v2/translate';
const isDev = import.meta.env.DEV;
// Dev-only API route. In production (pure SSG), this must be prerendered to avoid SSR.
export const prerender = !isDev;

const languageMap: Record<string, string> = {
  en: 'EN',
  fr: 'FR',
  es: 'ES',
  'pt-br': 'PT-BR',
  ar: 'AR',
};

const normalizeTargetLang = (value?: string): string | null => {
  if (!value) return null;
  const lowered = value.toLowerCase();
  if (languageMap[lowered]) return languageMap[lowered];
  return value.toUpperCase();
};

const withCors = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(response.body, { status: response.status, headers });
};

export const OPTIONS: APIRoute = async () => {
  return withCors(new Response(null, { status: 204 }));
};

export const GET: APIRoute = async () => {
  if (isDev) {
    return withCors(
      new Response(
        JSON.stringify({ error: 'Use POST for translation in dev.' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }
  return withCors(
    new Response(
      JSON.stringify({ error: 'Translate API disabled in static production build.' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    ),
  );
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
  const apiKey = process.env.DEEPL_API_KEY;
  const apiUrl = process.env.DEEPL_API_URL || DEFAULT_DEEPL_URL;

  if (!apiKey) {
    return withCors(
      new Response(JSON.stringify({ error: 'DEEPL_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

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
      );
    }
  }

  if (!targetLang) {
    return withCors(
      new Response(JSON.stringify({ error: 'targetLang is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  if (!texts.length) {
    return withCors(
      new Response(JSON.stringify({ error: 'texts must be a non-empty array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  const params = new URLSearchParams();
  params.append('auth_key', apiKey);
  params.append('target_lang', targetLang);
  texts.forEach((text) => params.append('text', text));

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
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
    );
  }

  const data = await response.json();
  const translations = Array.isArray(data?.translations)
    ? data.translations.map((t: any) => t.text)
    : [];

  return withCors(
    new Response(JSON.stringify({ translations }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
};
