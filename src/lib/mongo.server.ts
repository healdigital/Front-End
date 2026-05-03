import { payloadFetch, payloadApiUrl } from './payload.client';

type GenericDoc = Record<string, any>;
type ArticleRecord = GenericDoc & { _id?: string; id?: string; slug?: string | { current?: string } };
type CategoryLike = { _id?: string; id?: string; name?: string; slug?: string; title?: string; label?: string };
type RelatedArticleId = string | { toString?: () => string };

const BUILD_DEBUG = process.env.BUILD_DEBUG === '1';
const debugLog = (...args: unknown[]) => {
  if (BUILD_DEBUG) console.log(...args);
};

const CACHE_TTL_MS = Number(process.env.FRONTEND_DATA_CACHE_MS) || 60_000;
const TAXONOMY_CACHE_TTL_MS = Number(process.env.FRONTEND_TAXONOMY_CACHE_MS) || CACHE_TTL_MS;

const normalizeComparableText = (value: string): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const getBuildLimit = () => {
  const envLimit = Number(process.env.MAX_SSG_ARTICLES);
  const safeEnvLimit = Number.isFinite(envLimit) && envLimit > 0 ? envLimit : 120;
  return Math.min(safeEnvLimit, 10000);
};

const getId = (value: any): string =>
  String(
    value?._id || value?.id || value?.value || value?.doc?._id || value?.doc?.id || '',
  ).trim();

const getSlug = (value: any): string => {
  const raw = typeof value?.slug === 'string' ? value.slug : value?.slug?.current;
  return String(raw || '').replace(/^\/+|\/+$/g, '');
};

const getTaxonomyLabel = (entry: any): string =>
  String(entry?.title || entry?.name || entry?.label || entry || '').trim();

const toArticleArray = (items: any[]): ArticleRecord[] =>
  (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    _id: getId(item) || undefined,
    id: getId(item) || undefined,
  }));

let cachedAllArticles: ArticleRecord[] | null = null;
let cachedAllArticlesAt = 0;

let cachedAllCategories: CategoryLike[] | null = null;
let cachedAllCategoriesAt = 0;
let cachedAllTags: GenericDoc[] | null = null;
let cachedAllTagsAt = 0;
const FRONTEND_ARTICLE_DEBUG = process.env.FRONTEND_ARTICLE_DEBUG === '1';

const logArticleSnapshot = (source: string, items: ArticleRecord[], phase: 'cache' | 'fetch') => {
  if (!FRONTEND_ARTICLE_DEBUG) return;
  const sampleSlugs = items
    .slice(0, 8)
    .map((item) => getSlug(item))
    .filter(Boolean);
  console.log(
    `[frontend/articles:${phase}] source=${source} count=${items.length} sample=${sampleSlugs.join(', ') || 'none'}`,
  );
};

async function fetchCollection<T = GenericDoc>(collection: string, query: Record<string, any> = {}): Promise<T[]> {
  return payloadFetch<T>({ collection, query: { depth: 0, ...query } });
}

export async function getMongoConnection() {
  throw new Error('Direct Mongo access removed from Front-End. Use backend API calls.');
}

export async function getAllArticlesFromMongo(source = 'unknown'): Promise<ArticleRecord[]> {
  const now = Date.now();
  if (cachedAllArticles && now - cachedAllArticlesAt < CACHE_TTL_MS) {
    logArticleSnapshot(source, cachedAllArticles, 'cache');
    return cachedAllArticles;
  }

  try {
    // Archive/listing pages only need article-owned fields (slug/title/excerpt/recipeBlocks),
    // so fetch at depth=0 to avoid huge payload responses that can timeout/stall.
    const remote = await fetchCollection<ArticleRecord>('articles', {
      limit: getBuildLimit(),
      depth: 0,
    });
    const normalized = toArticleArray(remote);
    cachedAllArticles = normalized;
    cachedAllArticlesAt = Date.now();
    logArticleSnapshot(source, normalized, 'fetch');
    return normalized;
  } catch (error) {
    console.error('[data] Failed loading articles from backend API:', error);
    return [];
  }
}

export async function getArticleBySlugFromMongo(slug: string): Promise<ArticleRecord | null> {
  const clean = String(slug || '').replace(/^\/+|\/+$/g, '');
  if (!clean) return null;

  const slugVariants = Array.from(
    new Set([
      clean,
      decodeURIComponent(clean),
      `/${clean}`,
      `/${decodeURIComponent(clean)}`,
      clean.replace(/^fr\/recettes\//i, ''),
      clean.replace(/^recettes\//i, ''),
    ]),
  ).filter(Boolean);

  // Try focused backend queries first.
  for (const candidate of slugVariants) {
    try {
      const apiHit = await fetchCollection<ArticleRecord>('articles', {
        slug: candidate,
        limit: 1,
        depth: 2,
      });
      if (apiHit[0]) return apiHit[0];
    } catch (error) {
      debugLog('[data] getArticleBySlug targeted query failed:', error);
    }
  }

  // Fall back to cached broad article list and normalized matching (legacy slug formats).
  const all = await getAllArticlesFromMongo('getArticleBySlugFromMongo');
  const exact = all.find((item) => getSlug(item) === clean);
  if (exact) return exact;

  // Last resort: force a broad backend fetch and normalized matching.
  try {
    const apiAll = await fetchCollection<ArticleRecord>('articles', {
      limit: getBuildLimit(),
      depth: 0,
    });
    const normalizedMap = new Set(slugVariants.map((value) => getSlug({ slug: value })));
    const loose = (Array.isArray(apiAll) ? apiAll : []).find((item) => {
      const itemSlug = getSlug(item);
      if (!itemSlug) return false;
      if (normalizedMap.has(itemSlug)) return true;
      return Array.from(normalizedMap).some((candidate) =>
        itemSlug.endsWith(`/${candidate}`) || candidate.endsWith(`/${itemSlug}`),
      );
    });
    return loose || null;
  } catch (error) {
    debugLog('[data] getArticleBySlug fallback failed:', error);
    return null;
  }
}

export async function getArticlesFromMongo(page = 1, limit = 10, categoryName?: string): Promise<ArticleRecord[]> {
  const all = await getAllArticlesFromMongo('getArticlesFromMongo');
  const normalizedCategoryName = normalizeComparableText(String(categoryName || ''));

  const filtered = normalizedCategoryName
    ? all.filter((article) => {
        const categories = Array.isArray(article?.categories) ? article.categories : [];
        return categories.some((entry) =>
          normalizeComparableText(getTaxonomyLabel(entry)).includes(normalizedCategoryName),
        );
      })
    : all;

  const skip = Math.max(0, (page - 1) * limit);
  return filtered.slice(skip, skip + limit);
}

export async function getArticlesCountFromMongo(): Promise<number> {
  const all = await getAllArticlesFromMongo('getArticlesCountFromMongo');
  return all.length;
}

export async function getRelatedArticlesFromMongo(
  categoryIds: RelatedArticleId[],
  excludeArticleId: string,
  limit = 6,
): Promise<ArticleRecord[]> {
  const all = await getAllArticlesFromMongo('getRelatedArticlesFromMongo');
  const exclude = String(excludeArticleId || '').trim();
  const categoryIdSet = new Set((Array.isArray(categoryIds) ? categoryIds : []).map((id) => String(id || '').trim()));

  if (!categoryIdSet.size) {
    return all.filter((item) => getId(item) !== exclude).slice(0, limit);
  }

  const scored = all
    .filter((item) => getId(item) !== exclude)
    .map((item) => {
      const cats = Array.isArray(item?.categories) ? item.categories : [];
      const score = cats.reduce((acc: number, entry: any) => {
        const id = String(entry?._id || entry?.id || entry?.value || '').trim();
        return categoryIdSet.has(id) ? acc + 1 : acc;
      }, 0);
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);

  return scored;
}

export async function getCommentsByArticleIdFromMongo(articleId: string) {
  try {
    return await fetchCollection('comments', { article: articleId, limit: 200 });
  } catch (error) {
    console.error('[data] Failed to fetch comments from backend API:', error);
    return [];
  }
}

export async function saveCommentToMongo(
  articleId: string,
  commentData: {
    authorName: string;
    authorEmail: string;
    content: string;
    rating?: number;
  },
) {
  const endpoint = `${String(payloadApiUrl || '').replace(/\/+$/g, '')}/comments`;
  if (!endpoint.startsWith('http')) {
    throw new Error('PUBLIC_PAYLOAD_API_URL must be absolute for server comment writes.');
  }

  const body = {
    article: articleId,
    authorName: commentData.authorName,
    authorEmail: commentData.authorEmail,
    content: commentData.content,
    rating: commentData.rating,
    status: 'pending',
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to save comment via backend API (${res.status}): ${text}`);
  }

  return res.json();
}

export async function searchArticlesFromMongo(query: string, limit = 50): Promise<ArticleRecord[]> {
  const needle = normalizeComparableText(String(query || ''));
  if (!needle) return [];

  const all = await getAllArticlesFromMongo('searchArticlesFromMongo');
  return all
    .filter((item) => {
      const title = normalizeComparableText(String(item?.title?.rendered || item?.title || ''));
      const excerpt = normalizeComparableText(String(item?.excerpt || item?.description || ''));
      return title.includes(needle) || excerpt.includes(needle);
    })
    .slice(0, Math.max(1, limit));
}

export async function getAllCategoriesFromMongo(): Promise<CategoryLike[]> {
  const now = Date.now();
  if (cachedAllCategories && now - cachedAllCategoriesAt < TAXONOMY_CACHE_TTL_MS) {
    return cachedAllCategories;
  }

  try {
    const categories = await fetchCollection<CategoryLike>('categories', { limit: 1000 });
    const normalized = (Array.isArray(categories) ? categories : []).map((item) => ({
      ...item,
      _id: getId(item) || undefined,
      id: getId(item) || undefined,
    }));
    cachedAllCategories = normalized;
    cachedAllCategoriesAt = Date.now();
    return normalized;
  } catch (error) {
    console.error('[data] Failed loading categories from backend API:', error);
    const all = await getAllArticlesFromMongo('getAllCategoriesFromMongo');
    const byKey = new Map<string, CategoryLike>();
    all.forEach((article) => {
      const categories = Array.isArray(article?.categories) ? article.categories : [];
      categories.forEach((entry: any) => {
        const key = String(entry?.slug || entry?.name || entry?.title || '').trim();
        if (!key || byKey.has(key)) return;
        byKey.set(key, {
          _id: getId(entry) || undefined,
          id: getId(entry) || undefined,
          name: String(entry?.name || entry?.title || '').trim(),
          title: String(entry?.title || entry?.name || '').trim(),
          slug: String(entry?.slug || '').trim(),
        });
      });
    });
    const fallback = Array.from(byKey.values());
    cachedAllCategories = fallback;
    cachedAllCategoriesAt = Date.now();
    return fallback;
  }
}

export async function getAllTagsFromMongo() {
  const now = Date.now();
  if (cachedAllTags && now - cachedAllTagsAt < TAXONOMY_CACHE_TTL_MS) {
    return cachedAllTags;
  }

  try {
    const tags = await fetchCollection('tags', { limit: 2000 });
    const normalized = (Array.isArray(tags) ? tags : []).map((item: any) => ({
      ...item,
      _id: getId(item) || undefined,
      id: getId(item) || undefined,
    }));
    cachedAllTags = normalized;
    cachedAllTagsAt = Date.now();
    return normalized;
  } catch (error) {
    console.error('[data] Failed loading tags from backend API:', error);
    const all = await getAllArticlesFromMongo('getAllTagsFromMongo');
    const byKey = new Map<string, any>();
    all.forEach((article) => {
      const tags = Array.isArray(article?.tags) ? article.tags : [];
      tags.forEach((entry: any) => {
        const key = String(entry?.slug || entry?.name || entry?.title || '').trim();
        if (!key || byKey.has(key)) return;
        byKey.set(key, {
          _id: getId(entry) || undefined,
          id: getId(entry) || undefined,
          name: String(entry?.name || entry?.title || '').trim(),
          title: String(entry?.title || entry?.name || '').trim(),
          slug: String(entry?.slug || '').trim(),
        });
      });
    });
    const fallback = Array.from(byKey.values());
    cachedAllTags = fallback;
    cachedAllTagsAt = Date.now();
    return fallback;
  }
}

export async function getArticlesByTagFromMongo(tagName: string, limit = 1000) {
  const needle = normalizeComparableText(String(tagName || ''));
  if (!needle) return [];

  const all = await getAllArticlesFromMongo('getArticlesByTagFromMongo');
  return all
    .filter((article) => {
      const tags = Array.isArray(article?.tags) ? article.tags : [];
      return tags.some((entry: any) =>
        normalizeComparableText(getTaxonomyLabel(entry)).includes(needle),
      );
    })
    .slice(0, Math.max(1, limit));
}
