/**
 * Payload CMS Client
 * Temporary placeholder - will be configured with real Payload API
 */

const normalizeEnvValue = (value: string | undefined): string => String(value || '').trim();

const firstCoolifyUrl = (): string => {
  const raw = normalizeEnvValue(process.env.COOLIFY_URL);
  if (!raw) return '';
  const first = raw.split(',')[0]?.trim() || '';
  if (!first) return '';
  // Coolify can occasionally inject malformed values like "http//example.com".
  if (/^https?:\/\//i.test(first)) return first;
  if (/^https?:\/[^/]/i.test(first)) return first.replace(/^http:\/(?!\/)/i, 'http://').replace(/^https:\/(?!\/)/i, 'https://');
  return '';
};

const getSiteBaseUrl = (): string => {
  const publicSiteUrl = normalizeEnvValue(process.env.PUBLIC_SITE_URL);
  if (publicSiteUrl) return publicSiteUrl.replace(/\/+$/g, '');
  const coolify = firstCoolifyUrl();
  if (coolify) return coolify.replace(/\/+$/g, '');
  return process.env.NODE_ENV === 'development' ? 'http://localhost:4321' : '';
};

const resolvePayloadApiUrl = (): string => {
  const explicit =
    normalizeEnvValue(process.env.PAYLOAD_API_URL) ||
    normalizeEnvValue(process.env.PUBLIC_PAYLOAD_API_URL);

  if (explicit) {
    if (/^https?:\/\//i.test(explicit)) return explicit.replace(/\/+$/g, '');
    if (explicit.startsWith('/')) {
      // During server-side build/runtime in Node, fetch needs an absolute URL.
      if (typeof window === 'undefined') {
        const siteBase = getSiteBaseUrl();
        if (siteBase) return `${siteBase}${explicit}`.replace(/\/+$/g, '');
      }
      return explicit.replace(/\/+$/g, '');
    }
  }

  if (process.env.NODE_ENV === 'development') return 'http://localhost:3000/api';
  if (typeof window === 'undefined') {
    const siteBase = getSiteBaseUrl();
    if (siteBase) return `${siteBase}/api`;
  }
  return '/api';
};

export const payloadApiUrl = resolvePayloadApiUrl();

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

const extractCollectionTotal = (data: unknown, docsLength: number): number => {
  if (!isRecord(data)) return docsLength;
  const t = (data as Record<string, unknown>).totalDocs;
  if (typeof t === 'number' && Number.isFinite(t)) return t;
  const total = (data as Record<string, unknown>).total;
  if (typeof total === 'number' && Number.isFinite(total)) return total;
  const meta = (data as Record<string, unknown>).meta;
  if (isRecord(meta)) {
    const m = (meta as Record<string, unknown>).total;
    if (typeof m === 'number' && Number.isFinite(m)) return m;
  }
  return docsLength;
};

export type ArticlesPageResult<T = unknown> = {
  docs: T[];
  totalDocs: number;
  totalPages: number;
};

/**
 * Single request for a page of articles plus collection totals (avoids a second /articles?limit=1 call).
 */
export async function getArticlesPageWithMeta<T = unknown>(
  page = 1,
  limit = 10,
  init?: RequestInit,
): Promise<ArticlesPageResult<T>> {
  try {
    const params = new URLSearchParams({
      limit: String(limit),
      page: String(page),
      depth: '0',
    });
    const url = `${payloadApiUrl}/articles?${params.toString()}`;
    const res = await fetch(url, { ...init, cache: init?.cache ?? 'force-cache' });
    if (!res.ok) {
      return { docs: [], totalDocs: 0, totalPages: 1 };
    }
    const data: unknown = await res.json();
    const docs = normalizePayloadList<T>(data);
    const totalDocs = extractCollectionTotal(data, docs.length);
    const rawTotalPages = isRecord(data) ? (data as Record<string, unknown>).totalPages : undefined;
    const totalPages =
      typeof rawTotalPages === 'number' && rawTotalPages >= 1
        ? Math.floor(rawTotalPages)
        : Math.max(1, Math.ceil(totalDocs / Math.max(1, limit)));
    return { docs, totalDocs, totalPages };
  } catch (error) {
    console.error('Error fetching articles page with meta:', error);
    return { docs: [], totalDocs: 0, totalPages: 1 };
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
  const { totalDocs } = await getArticlesPageWithMeta(1, 1);
  return totalDocs;
}

/**
 * Fetch a single page of articles from Payload (server-side pagination)
 */
export async function getArticlesPage(page = 1, limit = 10) {
  const { docs } = await getArticlesPageWithMeta(page, limit);
  return docs;
}
