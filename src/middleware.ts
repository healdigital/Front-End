import type { MiddlewareHandler } from 'astro';

/** Legacy pagination URLs `/articles/:page` migrated to `/articles/page/:page` for SSR routing (no clash with `[slug]`). */
export const onRequest: MiddlewareHandler = async (context, next) => {
  const pathname = context.url.pathname.replace(/\/+$/, '') || '/';
  const legacy = pathname.match(/^\/articles\/(\d+)$/);
  if (legacy && Number(legacy[1]) >= 2) {
    return context.redirect(`${context.url.origin}/articles/page/${legacy[1]}`, 308);
  }

  const response = await next();
  const contentType = response.headers.get('content-type') || '';
  const hasCacheControl = response.headers.has('Cache-Control');
  const isHtml = contentType.includes('text/html');
  const isApiOrAsset =
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_astro/') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/favicon');

  // Keep defaults conservative for dynamic HTML if route did not provide explicit cache headers.
  if (isHtml && !isApiOrAsset && !hasCacheControl) {
    response.headers.set(
      'Cache-Control',
      'public, max-age=0, s-maxage=120, stale-while-revalidate=3600',
    );
  }

  // Basic hardening headers for every response.
  if (!response.headers.has('X-Content-Type-Options')) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
  }
  if (!response.headers.has('Referrer-Policy')) {
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  }
  if (!response.headers.has('X-Frame-Options')) {
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  }
  if (!response.headers.has('Permissions-Policy')) {
    response.headers.set(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=()',
    );
  }

  return response;
};
