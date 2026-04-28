import type { MiddlewareHandler } from 'astro';

/** Legacy pagination URLs `/articles/:page` migrated to `/articles/page/:page` for SSR routing (no clash with `[slug]`). */
export const onRequest: MiddlewareHandler = async (context, next) => {
  const pathname = context.url.pathname.replace(/\/+$/, '') || '/';
  const legacy = pathname.match(/^\/articles\/(\d+)$/);
  if (legacy && Number(legacy[1]) >= 2) {
    return context.redirect(`${context.url.origin}/articles/page/${legacy[1]}`, 308);
  }
  return next();
};
