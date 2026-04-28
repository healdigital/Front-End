/**
 * Payload CMS Client
 * Temporary placeholder - will be configured with real Payload API
 */

export const payloadApiUrl = process.env.PUBLIC_PAYLOAD_API_URL ||
  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000/api'
    : '/api');

type PayloadQueryValue = string | number | boolean;
type PayloadQuery = Record<string, PayloadQueryValue | null | undefined>;

interface PayloadCollectionResponse<T> {
  docs?: T[];
  meta?: {
    total?: number;
  };
  total?: number;
  totalDocs?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isPayloadCollectionResponse = <T>(value: unknown): value is PayloadCollectionResponse<T> =>
  isRecord(value) && (!('docs' in value) || Array.isArray(value.docs));

const normalizePayloadList = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (isPayloadCollectionResponse<T>(value) && Array.isArray(value.docs)) return value.docs;
  return [];
};

/**
 * Fetch data from Payload CMS API
 */
export async function payloadFetch<T>({
  collection,
  query = {},
  cache = 'force-cache',
}: {
  collection: string;
  query?: PayloadQuery;
  cache?: RequestCache;
}): Promise<T[]> {
  try {
    let url = `${payloadApiUrl}/${collection}`;
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      if (key === 'limit' || key === 'page' || key === 'depth') {
        params.append(key, String(value));
        continue;
      }
      params.append(`where[${key}][equals]`, String(value));
    }

    const qs = params.toString();
    if (qs) url += `?${qs}`;

    const res = await fetch(url, { cache });
    if (!res.ok) {
      console.warn(`Payload API error: ${res.status} ${res.statusText} - falling back to secondary API URL`);

      try {
        const fallbackUrl = process.env.NODE_ENV === 'development'
          ? 'http://localhost:3000/api'
          : 'https://payloadcms-pi.vercel.app/api';
        const proxyRes = await fetch(`${fallbackUrl}/${collection}${qs ? `?${qs}` : ''}`);
        if (proxyRes.ok) {
          const proxyData: unknown = await proxyRes.json();
          return normalizePayloadList<T>(proxyData);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Fallback proxy fetch error:', message);
      }

      return [];
    }

    const data: unknown = await res.json();
    return normalizePayloadList<T>(data);
  } catch (error) {
    console.error(`Payload fetch error [${collection}]:`, error);
    return [];
  }
}

/**
 * Get all articles
 */
export async function getAllArticles() {
  return payloadFetch({
    collection: 'articles',
    query: { depth: 0 },
  });
}

/**
 * Get article by slug
 */
export async function getArticleBySlug(slug: string) {
  const articles = await payloadFetch({
    collection: 'articles',
    query: { slug, depth: 2, limit: 1 },
  });
  return articles[0] || null;
}

/**
 * Get articles by category
 */
export async function getArticlesByCategory(categoryId: string) {
  return payloadFetch({
    collection: 'articles',
    query: { categories: categoryId, depth: 0 },
  });
}

/**
 * Get articles by tag
 */
export async function getArticlesByTag(tagId: string) {
  return payloadFetch({
    collection: 'articles',
    query: { tags: tagId, depth: 0 },
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
    const params = new URLSearchParams({
      limit: '1',
      depth: '0',
    });
    const url = `${payloadApiUrl}/articles?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) return 0;

    const data: unknown = await res.json();
    if (Array.isArray(data)) return data.length;
    if (!isPayloadCollectionResponse<unknown>(data)) return 0;
    return data.totalDocs ?? data.total ?? data.meta?.total ?? 0;
  } catch (error) {
    console.error('Error fetching articles count:', error);
    return 0;
  }
}

/**
 * Fetch a single page of articles from Payload (server-side pagination)
 */
export async function getArticlesPage(page = 1, limit = 10) {
  try {
    const params = new URLSearchParams({
      limit: String(limit),
      page: String(page),
      depth: '0',
    });
    const url = `${payloadApiUrl}/articles?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data: unknown = await res.json();
    return normalizePayloadList(data);
  } catch (error) {
    console.error('Error fetching articles page:', error);
    return [];
  }
}
