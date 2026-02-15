/**
 * Payload CMS Client
 * Temporary placeholder - will be configured with real Payload API
 */

export const payloadApiUrl = process.env.PUBLIC_PAYLOAD_API_URL ||
  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000/api'
    : '/api');

/**
 * Fetch data from Payload CMS API
 */
export async function payloadFetch<T>({
  collection,
  query = {},
  cache = 'force-cache',
}: {
  collection: string;
  query?: Record<string, any>;
  cache?: RequestCache;
}): Promise<T[]> {
  try {

    // Build URL
    let url = `${payloadApiUrl}/${collection}`;

    const params = new URLSearchParams();

    // Support special query keys: `limit` and `page` (sent directly)
    // Other keys are converted to Payload `where` equals filters
    for (const [k, v] of Object.entries(query || {})) {
      if (v === undefined || v === null) continue;
      if (k === 'limit' || k === 'page' || k === 'depth') {
        params.append(k, String(v));
        continue;
      }
      // support direct slug lookup or simple equality
      params.append(`where[${k}][equals]`, String(v));
    }

    // Don't set a default limit - let caller specify what they need
    // (removed: 10000 limit was causing 333 second delays on homepage)

    const qs = params.toString();
    if (qs) url += `?${qs}`;

    const res = await fetch(url, { cache: cache as any });
    if (!res.ok) {
      console.warn(`Payload API error: ${res.status} ${res.statusText} - falling back to local mongo proxy`);
      // try local mongo proxy fallback
      try {
        const fallbackUrl = process.env.NODE_ENV === 'development'
          ? 'http://localhost:3000/api'
          : 'https://payloadcms-pi.vercel.app/api';
        const proxyRes = await fetch(`${fallbackUrl}/${collection}`);
        if (proxyRes.ok) {
          const proxyData = await proxyRes.json();
          if (proxyData && Array.isArray(proxyData.docs)) return proxyData.docs as any;
          if (Array.isArray(proxyData)) return proxyData as any;
        }
      } catch (e) {
        console.error('Fallback proxy fetch error:', e.message);
      }

      return [];
    }

    const data = await res.json();
    // Payload returns { docs: [...] } for collection endpoints
    if (Array.isArray(data)) return data as any;
    if (data && Array.isArray(data.docs)) return data.docs as any;
    return [];
  } catch (error) {
    console.error(`❌ Payload fetch error [${collection}]:`, error);
    return [];
  }
}

/**
 * Get all articles
 */
export async function getAllArticles() {
  return payloadFetch({
    collection: 'articles',
    query: { depth: 2 }
  });
}

/**
 * Get article by slug
 */
export async function getArticleBySlug(slug: string) {
  const articles = await payloadFetch({
    collection: 'articles',
    query: { slug },
  });
  return articles[0] || null;
}

/**
 * Get articles by category
 */
export async function getArticlesByCategory(categoryId: string) {
  return payloadFetch({
    collection: 'articles',
    query: { categories: categoryId },
  });
}

/**
 * Get articles by tag
 */
export async function getArticlesByTag(tagId: string) {
  return payloadFetch({
    collection: 'articles',
    query: { tags: tagId },
  });
}

/**
 * Get comments for article
 */
export async function getCommentsByArticle(articleId: string) {
  return payloadFetch({
    collection: 'comments',
    query: { article: articleId },
  });
}

/**
 * Get total count of articles from Payload (uses collection meta returned by API)
 */
export async function getArticlesCount(): Promise<number> {
  try {
    const url = `${payloadApiUrl}/articles?limit=1&depth=2`;
    const res = await fetch(url);
    if (!res.ok) return 0;
    const data = await res.json();
    return (
      data?.totalDocs ?? data?.total ?? data?.meta?.total ?? (Array.isArray(data) ? data.length : 0)
    );
  } catch (e) {
    console.error('Error fetching articles count:', e);
    return 0;
  }
}

/**
 * Fetch a single page of articles from Payload (server-side pagination)
 */
export async function getArticlesPage(page = 1, limit = 10) {
  try {
    const url = `${payloadApiUrl}/articles?limit=${limit}&page=${page}&depth=2`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) return data as any[];
    if (Array.isArray(data.docs)) return data.docs as any[];
    return [];
  } catch (e) {
    console.error('Error fetching articles page:', e);
    return [];
  }
}
