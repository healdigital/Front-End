import type { MiddlewareHandler } from 'astro';

/**
 * Routing strategy
 * ----------------
 *  /                    → FR home
 *  /en                  → FR home, but with lcdb_lang=en cookie set so the page
 *                          renders content in EN
 *  /en/recettes-sucrees → /recettes-sucrees with lcdb_lang=en
 *  /en/recipes-sweet    → alias, rewrites to /recettes-sucrees with lcdb_lang=en
 *  /en/recipe/<slug>    → existing [lang]/recipe/[slug].astro route — left alone
 *  /articles/<n>        → legacy redirect to /articles/page/<n>
 *
 * Supported languages: en, es, pt-br, ar, zh-hans (fr is the default, no prefix)
 */

const SUPPORTED_LANGS = new Set(['en', 'es', 'pt-br', 'ar', 'zh-hans']);

/**
 * Whitelist of FR-canonical Astro pages that we want to expose under language
 * prefixes (`/en/recettes-sucrees`, `/es/recettes-sucrees`, …). Anything outside
 * this list reaching `/<lang>/<x>` is treated as an article slug and routed by
 * the [lang]/[slug].astro page.
 */
const KNOWN_LISTING_PAGES = new Set([
  'recettes-sucrees',
  'recettes-salees',
  'le-sucre',
  'le-sale',
  'voyage',
  'voyages-culinaires',
  'reportages',
  'workshops',
  'books',
  'mes-livres',
  'videos',
  'cours-video',
  'contact',
  'partenariat',
  'partnership',
  'mentions-legales',
  'rgpd',
  'gdpr',
  'legal',
  'cgu',
  'news',
  'search',
  'compte',
  'favoris',
  'selection',
  'selections',
  'articles',
]);

/**
 * Per-language URL aliases for listing pages. Keys are language codes; values
 * map a localised URL fragment to its FR canonical equivalent.
 */
const URL_ALIASES: Record<string, Record<string, string>> = {
  en: {
    'recipes-sweet': 'recettes-sucrees',
    'recipes-savoury': 'recettes-salees',
    'recipes-savory': 'recettes-salees',
    'sweet': 'le-sucre',
    'savoury': 'le-sale',
    'savory': 'le-sale',
    'travel': 'voyage',
  },
  es: {
    'recetas-dulces': 'recettes-sucrees',
    'recetas-saladas': 'recettes-salees',
    'dulce': 'le-sucre',
    'salado': 'le-sale',
  },
  'pt-br': {
    'receitas-doces': 'recettes-sucrees',
    'receitas-salgadas': 'recettes-salees',
    'doce': 'le-sucre',
    'salgado': 'le-sale',
  },
  ar: {
    'حلو': 'le-sucre',
    'مالح': 'le-sale',
    'حلويات': 'recettes-sucrees',
    'مالحة': 'recettes-salees',
  },
};

const trimSlashes = (s: string) => s.replace(/^\/+|\/+$/g, '');

/**
 * Resolve `/<lang>/<rest>` URLs.
 *
 * Returns null when the URL does not match the lang-prefix pattern (so the
 * outer middleware should fall through to the regular request flow).
 *
 * Otherwise returns:
 *   - lang: the matched language code
 *   - targetPathname: the rewritten internal path that maps to a real Astro
 *     page (always FR-canonical)
 */
function resolveLangPrefix(pathname: string): { lang: string; targetPathname: string | null } | null {
  const trimmed = trimSlashes(pathname);
  if (!trimmed) return null;

  const segments = trimmed.split('/');
  const first = segments[0]?.toLowerCase();
  if (!first || !SUPPORTED_LANGS.has(first)) return null;

  // /<lang>/recipe/<slug> already has its own dedicated route.
  if (segments[1]?.toLowerCase() === 'recipe') return null;

  const lang = first;
  const restSegments = segments.slice(1);
  // Bare /<lang>/ → render the FR home in target language.
  if (restSegments.length === 0) {
    return { lang, targetPathname: '/' };
  }

  // /<lang>/<head>/<tail…> — translate head if it matches a known
  // listing alias OR is itself a known listing slug. Anything else is an
  // article slug, leave to the article route handler.
  const aliasMap = URL_ALIASES[lang] || {};
  const head = restSegments[0];
  const tail = restSegments.slice(1);
  const decodedHead = decodeURIComponent(head);
  const aliased = aliasMap[head] || aliasMap[decodedHead];
  const isKnownListing = KNOWN_LISTING_PAGES.has(aliased || head);
  if (!aliased && !isKnownListing) {
    // Article slug: only set the cookie, don't rewrite. The
    // [lang]/[slug].astro route resolves the article.
    return { lang, targetPathname: null };
  }
  const targetPathname = '/' + [aliased || head, ...tail].filter(Boolean).join('/');
  return { lang, targetPathname };
}

export const onRequest: MiddlewareHandler = async (context, next) => {
  const pathname = context.url.pathname.replace(/\/+$/, '') || '/';

  const legacy = pathname.match(/^\/articles\/(\d+)$/);
  if (legacy && Number(legacy[1]) >= 2) {
    return context.redirect(`${context.url.origin}/articles/page/${legacy[1]}`, 308);
  }

  const langMatch = resolveLangPrefix(pathname);
  if (langMatch) {
    context.cookies.set('lcdb_lang', langMatch.lang, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
    if (langMatch.targetPathname) {
      // Rewrite to the canonical FR Astro page (cookie drives the lang).
      const search = context.url.search || '';
      return context.rewrite(langMatch.targetPathname + search);
    }
    // Article URL — fall through, [lang]/[slug].astro handles it.
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

  if (isHtml && !isApiOrAsset && !hasCacheControl) {
    response.headers.set(
      'Cache-Control',
      'public, max-age=0, s-maxage=120, stale-while-revalidate=3600',
    );
  }

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
