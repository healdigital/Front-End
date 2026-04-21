import { MongoClient, ObjectId, type Db } from 'mongodb';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { repairDeepStrings } from '../utils/repairMojibake';

// Load env variables
config();

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;
type GenericDoc = Record<string, unknown>;
type MediaSizeEntry = {
  url?: string;
};
type MediaRecord = GenericDoc & {
  url?: string;
  sizes?: {
    articleHero?: MediaSizeEntry;
    gallery?: MediaSizeEntry;
  };
};
type ArticleRecord = GenericDoc & {
  _id?: string | ObjectId;
  _status?: string;
  featuredImage?: MediaRecord;
  featuredImageUrl?: string;
  featuredMedia?: MediaRecord;
  featured_image?: MediaRecord;
  featured_img_url?: string;
  id?: string;
  slug?: string | { current?: string };
  categories?: unknown[];
  tags?: unknown[];
};
type CategoryLike = { _id: string; name: string; slug: string; title: string };
type RelatedArticleId = string | ObjectId;
type TaxonomyEntry = {
  _id?: string | ObjectId;
  id?: string | ObjectId;
  label?: string;
  name?: string;
  title?: string;
  value?: string | ObjectId | GenericDoc;
};

let cachedPreparedArticles: ArticleRecord[] | null = null;
let cachedAllArticles: ArticleRecord[] | null = null;
let cachedAllArticlesAt = 0;
let inFlightAllArticlesPromise: Promise<ArticleRecord[]> | null = null;

const isDevMode = () => process.env.NODE_ENV !== 'production';

const getBuildLimit = () => {
  const envMax = Number(process.env.MAX_SSG_ARTICLES);
  const requestedLimit = Number.isFinite(envMax) && envMax > 0 ? envMax : 6000;

  // Keep local dev light even if production MAX_SSG_ARTICLES is high.
  if (isDevMode()) {
    const envDevMax = Number(process.env.DEV_MAX_SSG_ARTICLES);
    const devCap = Number.isFinite(envDevMax) && envDevMax > 0 ? envDevMax : 50;
    return Math.min(requestedLimit, devCap);
  }

  return requestedLimit;
};

const shouldUseIncludeSlugs = () => {
  if (!isDevMode()) return true;
  return process.env.DEV_INCLUDE_SLUGS === '1';
};

const normalizeComparableText = (value: string): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PUBLISHED_ARTICLE_MATCH = { _status: 'published' } as const;
const BUILD_DEBUG = process.env.BUILD_DEBUG === '1';
const debugLog = (...args: unknown[]) => {
  if (BUILD_DEBUG) {
    console.log(...args);
  }
};

const getTaxonomyLabel = (entry: unknown): string =>
  String(
    (typeof entry === 'object' && entry
      ? (entry as TaxonomyEntry).title || (entry as TaxonomyEntry).name || (entry as TaxonomyEntry).label
      : entry) || '',
  ).trim();

const getPreparedArticles = (): ArticleRecord[] => {
  if (cachedPreparedArticles) return cachedPreparedArticles;
  const preparedPath = path.join(process.cwd(), 'prepared-articles.json');
  const raw = fs.readFileSync(preparedPath, 'utf8');
  const items = JSON.parse(raw);
  cachedPreparedArticles = Array.isArray(items) ? repairDeepStrings(items) : [];
  return cachedPreparedArticles;
};

const normalizeId = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    if (value instanceof ObjectId) {
      return value.toHexString();
    }
    const record = value as Record<string, unknown>;
    if (typeof record.toHexString === 'function') {
      try {
        const hex = record.toHexString();
        if (typeof hex === 'string') return hex.trim();
      } catch {
        // ignore and continue with nested fields
      }
    }
    const nested =
      record.id ??
      record._id ??
      (typeof record.value === 'object' && record.value
        ? ((record.value as Record<string, unknown>).id ??
          (record.value as Record<string, unknown>)._id)
        : record.value);
    return typeof nested === 'string' ? nested.trim() : '';
  }
  return '';
};

const isObjectIdString = (value: string): boolean => /^[0-9a-fA-F]{24}$/.test(value);

const extractMediaRelationId = (value: unknown): string => {
  if (!value || typeof value === 'number' || typeof value === 'boolean') return '';
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.url === 'string' && record.url.trim()) return '';
    if (
      record.sizes &&
      typeof record.sizes === 'object' &&
      Object.keys(record.sizes as Record<string, unknown>).length > 0
    ) {
      return '';
    }
  }

  const id = normalizeId(value);
  return isObjectIdString(id) ? id : '';
};

const withStringIds = <T extends Record<string, unknown>>(doc: T): T & { _id?: string; id?: string } => ({
  ...doc,
  _id: normalizeId(doc._id) || undefined,
  id: normalizeId(doc.id) || normalizeId(doc._id) || undefined,
});

const hasUsableArticleImage = (article: ArticleRecord): boolean =>
  Boolean(
    article?.featuredMedia?.url ||
      article?.featuredMedia?.sizes?.articleHero?.url ||
      article?.featuredMedia?.sizes?.gallery?.url ||
      extractMediaRelationId(article?.featuredMedia) ||
      article?.featuredImage?.url ||
      article?.featuredImage?.sizes?.articleHero?.url ||
      article?.featuredImage?.sizes?.gallery?.url ||
      article?.featured_img_url ||
      article?.featured_image?.url ||
      article?.featuredImageUrl,
  );

const shouldUseLocalJson = (): boolean => process.env.USE_LOCAL_JSON === '1';

const backfillPreparedArticleMediaFields = async (articles: ArticleRecord[]): Promise<ArticleRecord[]> => {
  if (!Array.isArray(articles) || articles.length === 0) return articles;
  if (shouldUseLocalJson()) return articles;

  const articlesNeedingBackfill = articles.filter((article) => !hasUsableArticleImage(article));
  if (articlesNeedingBackfill.length === 0) return articles;

  const slugs = Array.from(
    new Set(
      articlesNeedingBackfill
        .map((article) =>
          typeof article?.slug === 'string' ? article.slug.trim() : article?.slug?.current?.trim(),
        )
        .filter(Boolean),
    ),
  );

  const ids = Array.from(
    new Set(
      articlesNeedingBackfill
        .map((article) => normalizeId(article?._id || article?.id))
        .filter((value) => isObjectIdString(value)),
    ),
  );

  if (slugs.length === 0 && ids.length === 0) return articles;

  try {
    const db = await getMongoConnection();
    const articleDocs = await db
      .collection('articles')
      .find(
        {
          $and: [
            PUBLISHED_ARTICLE_MATCH,
            {
              $or: [
                ...(slugs.length ? [{ slug: { $in: slugs } }, { 'slug.current': { $in: slugs } }] : []),
                ...(ids.length ? [{ _id: { $in: ids.map((id) => new ObjectId(id)) } }] : []),
              ],
            },
          ],
        },
        {
          projection: {
            _id: 1,
            featuredMedia: 1,
            featuredImage: 1,
            featuredImageUrl: 1,
            featured_img_url: 1,
            featured_image: 1,
            slug: 1,
          },
        },
      )
      .toArray();

    const bySlug = new Map<string, ArticleRecord>();
    const byId = new Map<string, ArticleRecord>();

    for (const doc of articleDocs) {
      const normalizedDoc = withStringIds(doc as GenericDoc) as ArticleRecord;
      const docSlug =
        typeof normalizedDoc.slug === 'string'
          ? normalizedDoc.slug.trim()
          : normalizedDoc.slug?.current?.trim();
      if (docSlug) bySlug.set(docSlug, normalizedDoc);
      const docId = normalizeId(normalizedDoc._id);
      if (docId) byId.set(docId, normalizedDoc);
    }

    return articles.map((article) => {
      if (hasUsableArticleImage(article)) return article;

      const articleSlug =
        typeof article?.slug === 'string' ? article.slug.trim() : article?.slug?.current?.trim();
      const articleId = normalizeId(article?._id || article?.id);
      const liveDoc = (articleSlug && bySlug.get(articleSlug)) || (articleId && byId.get(articleId));

      if (!liveDoc) return article;

      return {
        ...article,
        featuredMedia: liveDoc.featuredMedia ?? article.featuredMedia,
        featuredImage: liveDoc.featuredImage ?? article.featuredImage,
        featuredImageUrl: liveDoc.featuredImageUrl ?? article.featuredImageUrl,
        featured_img_url: liveDoc.featured_img_url ?? article.featured_img_url,
        featured_image: liveDoc.featured_image ?? article.featured_image,
      };
    });
  } catch (error) {
    console.error('[BUILD] Failed to backfill prepared article media fields:', error);
    return articles;
  }
};

const hydrateArticleMediaRelations = async (articles: ArticleRecord[]): Promise<ArticleRecord[]> => {
  if (!Array.isArray(articles) || articles.length === 0) return articles;
  if (shouldUseLocalJson()) {
    return articles.map((article) => ({
      ...article,
      _id: normalizeId(article?._id) || undefined,
    }));
  }

  const mediaIds = new Set<string>();

  for (const article of articles) {
    const featuredMediaId = extractMediaRelationId(article?.featuredMedia);
    if (featuredMediaId) mediaIds.add(featuredMediaId);
  }

  if (mediaIds.size === 0) {
    return articles.map((article) => ({
      _id: normalizeId(article?._id) || undefined,
      ...article,
    }));
  }

  try {
    const db = await getMongoConnection();
    const mediaCollection = db.collection('media');
    const mediaDocs = await mediaCollection
      .find(
        {
          _id: {
            $in: Array.from(mediaIds).map((id) => new ObjectId(id)),
          },
        },
        {
          projection: {
            alt: 1,
            filename: 1,
            filesize: 1,
            height: 1,
            mimeType: 1,
            sizes: 1,
            updatedAt: 1,
            url: 1,
            width: 1,
          },
        },
      )
      .toArray();

    const mediaMap = new Map(
      mediaDocs.map((doc) => {
        const normalizedDoc = withStringIds(doc as Record<string, unknown>);
        return [normalizedDoc.id || normalizedDoc._id || '', normalizedDoc];
      }),
    );

    return articles.map((article) => {
      const normalizedArticleId = normalizeId(article?._id);
      const featuredMediaId = extractMediaRelationId(article?.featuredMedia);
      const hydratedFeaturedMedia = featuredMediaId ? mediaMap.get(featuredMediaId) : null;

      return {
        _id: normalizedArticleId || undefined,
        ...article,
        ...(hydratedFeaturedMedia
          ? {
              featuredMedia: {
                ...(typeof article?.featuredMedia === 'object' && article?.featuredMedia ? article.featuredMedia : {}),
                ...hydratedFeaturedMedia,
              },
            }
          : {}),
      };
    });
  } catch (error) {
    console.error('[BUILD] Failed to hydrate article media relations:', error);
    return articles.map((article) => ({
      _id: normalizeId(article?._id) || undefined,
      ...article,
    }));
  }
};

export async function getMongoConnection() {
  if (cachedClient && cachedDb) {
    return cachedDb;
  }

  try {
    const mongoUri = process.env.MONGODB_URI || import.meta.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in process.env or import.meta.env');
    }

    debugLog('[BUILD] Establishing MongoDB connection...');
    const maxRetries = 3;
    let attempt = 0;
    let lastError: unknown = null;

    while (attempt < maxRetries) {
      attempt++;
      const connectionStartTime = Date.now();
      try {
        const client = new MongoClient(mongoUri);
        await client.connect();

        const connectionEndTime = Date.now();
        const connectionDuration = ((connectionEndTime - connectionStartTime) / 1000).toFixed(2);
        debugLog(`[BUILD] MongoDB connected successfully in ${connectionDuration}s (attempt ${attempt})`);

        const db = client.db('lcdb');
        cachedClient = client;
        cachedDb = db;
        return db;
      } catch (err: unknown) {
        lastError = err;
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`⚠️ [BUILD] MongoDB connect attempt ${attempt} failed:`, message);
        const backoffMs = 250 * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    console.error('❌ [BUILD] All MongoDB connection attempts failed');
    throw lastError;
  } catch (error) {
    console.error('❌ [BUILD] MongoDB connection error:', error);
    throw error;
  }
}

export async function getArticlesFromMongo(page = 1, limit = 10, categoryName?: string) {
  if (shouldUseLocalJson()) {
    const allArticles = await getAllArticlesFromMongo();
    const skip = Math.max(0, (page - 1) * limit);
    const normalizedCategoryName = String(categoryName || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    const filteredArticles = normalizedCategoryName
      ? allArticles.filter((article) => {
          const categories = Array.isArray(article?.categories) ? article.categories : [];
          return categories.some((entry) =>
            normalizeComparableText(getTaxonomyLabel(entry)).includes(normalizedCategoryName),
          );
        })
      : allArticles;

    return filteredArticles.slice(skip, skip + limit);
  }

  try {
    const db = await getMongoConnection();
    const articlesCollection = db.collection('articles');
    const categoriesCollection = db.collection('categories');
    const skip = (page - 1) * limit;

    let query: Record<string, unknown> = { ...PUBLISHED_ARTICLE_MATCH };
    if (categoryName) {
      // Find the category by name
      const category = await categoriesCollection.findOne({
        name: new RegExp(categoryName, 'i')
      });

      if (category) {
        query = { ...PUBLISHED_ARTICLE_MATCH, categories: category._id };
      } else {
        // If category not found, return empty array
        return [];
      }
    }

    const articles = await articlesCollection
      .aggregate([
        { $match: query },
        // Sort on _id so Mongo can use the default index (avoids in-memory sort limit).
        { $sort: { _id: -1 } },
        {
          $lookup: {
            from: 'categories',
            localField: 'categories',
            foreignField: '_id',
            as: 'categories'
          }
        },
        { $skip: skip },
        { $limit: limit }
      ])
      .toArray();

    return articles.map((doc) => ({
      ...doc,
      _id: doc._id?.toString(),
    }));
  } catch (error) {
    console.error('❌ Error fetching articles from MongoDB:', error);
    return [];
  }
}

export async function getArticlesCountFromMongo(): Promise<number> {
  if (shouldUseLocalJson()) {
    const allArticles = await getAllArticlesFromMongo();
    return allArticles.length;
  }

  try {
    const db = await getMongoConnection();
    const articlesCollection = db.collection('articles');
    const count = await articlesCollection.countDocuments(PUBLISHED_ARTICLE_MATCH);
    return count;
  } catch (error) {
    console.error('❌ Error fetching articles count from MongoDB:', error);
    return 0;
  }
}

const getArticleCategoryIds = (article: ArticleRecord): string[] => {
  if (!Array.isArray(article?.categories)) return [];

  return article.categories
    .map((item) => normalizeId((item as TaxonomyEntry)?.id || (item as TaxonomyEntry)?._id || (item as TaxonomyEntry)?.value || item))
    .filter(Boolean);
};

const fallbackRelatedArticlesFromPrepared = async (
  categoryIds: RelatedArticleId[],
  excludeArticleId: string,
  limit = 6,
) => {
  const normalizedCategoryIds = Array.from(
    new Set(
      (Array.isArray(categoryIds) ? categoryIds : [])
        .map((id) => normalizeId(id))
        .filter(Boolean),
    ),
  );

  if (normalizedCategoryIds.length === 0) return [];

  const excludeId = normalizeId(excludeArticleId);
  const allArticles = await getAllArticlesFromMongo();

  const relatedArticles = allArticles
    .filter((article) => {
      const articleId = normalizeId(article?._id || article?.id);
      if (!articleId || articleId === excludeId) return false;

      const articleTitle = typeof article?.title === 'string' ? article.title.trim() : '';
      if (!articleTitle) return false;

      const articleCategoryIds = getArticleCategoryIds(article);
      return articleCategoryIds.some((id) => normalizedCategoryIds.includes(id));
    })
    .slice(0, limit);

  debugLog('[RELATED:FALLBACK] Found', relatedArticles.length, 'related articles from prepared/local data');

  return relatedArticles;
};

export async function getRelatedArticlesFromMongo(categoryIds: RelatedArticleId[], excludeArticleId: string, limit = 6) {
  if (shouldUseLocalJson()) {
    return fallbackRelatedArticlesFromPrepared(categoryIds, excludeArticleId, limit);
  }

  try {
    // Convert excludeArticleId to ObjectId if it's a string
    let excludeId: RelatedArticleId = excludeArticleId;
    if (typeof excludeArticleId === 'string' && excludeArticleId.match(/^[0-9a-fA-F]{24}$/)) {
      excludeId = new ObjectId(excludeArticleId);
    }

    debugLog('[RELATED] Exclude ID:', excludeId);

    const db = await getMongoConnection();
    const articlesCollection = db.collection('articles');

    // Convert string IDs to ObjectIds if needed
    const objectIds = categoryIds.map((id) => {
      if (typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/)) {
        return new ObjectId(id);
      }
      return id;
    });

    debugLog('[RELATED] Converted category IDs:', objectIds);

    const relatedArticles = await articlesCollection
      .aggregate([
        {
          $match: {
            ...PUBLISHED_ARTICLE_MATCH,
            'categories': { $in: objectIds },
            '_id': { $ne: excludeId },
            $or: [
              {
                $and: [
                  { title: { $exists: true } },
                  { title: { $ne: null } },
                  { title: { $ne: '' } }
                ]
              },
              { 'featured_image.asset': { $exists: true } },
              { 'featured_img_url': { $exists: true } }
            ]
          }
        },
        {
          $lookup: {
            from: 'categories',
            localField: 'categories',
            foreignField: '_id',
            as: 'categoryData'
          }
        },
        { $limit: limit }
      ])
      .toArray();

    debugLog('[RELATED] Found', relatedArticles.length, 'related articles');

    return relatedArticles.map((doc) => ({
      ...doc,
      _id: doc._id?.toString(),
    }));
  } catch (error) {
    console.error('❌ Error fetching related articles from MongoDB:', error);
    return fallbackRelatedArticlesFromPrepared(categoryIds, excludeArticleId, limit);
  }
}

export async function getAllArticlesFromMongo() {
  const limit = getBuildLimit();
  const now = Date.now();
  const cacheAge = now - cachedAllArticlesAt;
  const cacheTtlMs = 30_000;

  if (cachedAllArticles && (!isDevMode() || cacheAge < cacheTtlMs)) {
    return cachedAllArticles;
  }

  if (inFlightAllArticlesPromise) {
    return inFlightAllArticlesPromise;
  }

  inFlightAllArticlesPromise = (async () => {
    // Optional: use local JSON dump instead of hitting Mongo (one-off full build)
    if (shouldUseLocalJson()) {
      try {
        const items = getPreparedArticles();
        const publishedItems = items.filter((item) => !item?._status || item._status === 'published');
        const cappedItems = publishedItems.slice(0, limit);
        debugLog(
          `[BUILD] Using prepared-articles.json with ${cappedItems.length}/${publishedItems.length} published articles (USE_LOCAL_JSON=1, MAX_SSG_ARTICLES=${limit})`,
        );
        const mergedItems = await backfillPreparedArticleMediaFields(cappedItems);
        const hydratedItems = await hydrateArticleMediaRelations(mergedItems);
        cachedAllArticles = hydratedItems;
        cachedAllArticlesAt = Date.now();
        return hydratedItems;
      } catch (err) {
        console.error('[BUILD] Failed to read prepared-articles.json, falling back to Mongo:', err);
      }
    }

    const startTime = Date.now();
    debugLog('[BUILD] Starting to fetch ALL articles from MongoDB...');

    try {
      const db = await getMongoConnection();
      const articlesCollection = db.collection('articles');

      const prioritySlugsRaw = shouldUseIncludeSlugs()
        ? (process.env.INCLUDE_SLUGS || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        : [];

      if (isDevMode() && (process.env.INCLUDE_SLUGS || '').trim() && prioritySlugsRaw.length === 0) {
        debugLog('[BUILD] Skipping INCLUDE_SLUGS in dev (set DEV_INCLUDE_SLUGS=1 to enable).');
      }

      // Count can be skipped in dev to speed up route generation.
      if (isDevMode()) {
        debugLog(`[BUILD] Dev mode: fetching ${limit} articles (count skipped).`);
      } else {
        const totalCount = await articlesCollection.countDocuments(PUBLISHED_ARTICLE_MATCH);
        debugLog(`[BUILD] Found ${totalCount} published articles in database`);

        if (totalCount > limit) {
          console.warn(`[BUILD] Will fetch ${limit} base articles (set MAX_SSG_ARTICLES to raise). Priority slugs will still be added.`);
        }
      }

      const projection = {
        _id: 1,
        slug: 1,
        lang: 1,
        title: 1,
        content: 1,
        contentV2: 1,
        contentBlocks: 1,
        recipeBlocks: 1,
        imageBlocks: 1,
        excerpt: 1,
        date: 1,
        modified: 1,
        updated: 1,
        author: 1,
        categories: 1,
        tags: 1,
        featuredMedia: 1,
        featuredImage: 1,
        featured_img_url: 1,
        featured_image: 1,
        featuredImageUrl: 1,
      };

      // Fetch only fields needed to render article pages statically
      debugLog(`[BUILD] Fetching up to ${limit} base articles from MongoDB (fields needed for SSG)...`);
      const baseArticles = await articlesCollection
        .find(PUBLISHED_ARTICLE_MATCH, { projection })
        // Sort on indexed _id to avoid in-memory sort limits.
        .sort({ _id: -1 })
        .maxTimeMS(60_000)
        .limit(limit)
        .toArray();

      let articles = baseArticles;

      // Force-include priority slugs even if outside the base limit
      if (prioritySlugsRaw.length) {
        const decodeSafe = (s: string) => {
          try { return decodeURIComponent(s); } catch { return s; }
        };
        const prioritySlugs = Array.from(new Set(prioritySlugsRaw.flatMap(s => [s, decodeSafe(s)])));

        const extraArticles = await articlesCollection
          .find(
            {
              $and: [
                PUBLISHED_ARTICLE_MATCH,
                {
                  $or: [
                    { slug: { $in: prioritySlugs } },
                    { 'slug.current': { $in: prioritySlugs } },
                  ],
                },
              ],
            },
            { projection },
          )
          .toArray();

        const seen = new Set(articles.map(a => a._id?.toString() || (typeof a.slug === 'object' ? a.slug?.current : a.slug)));
        for (const doc of extraArticles) {
          const key = doc._id?.toString() || (typeof doc.slug === 'object' ? doc.slug?.current : doc.slug);
          if (!seen.has(key)) {
            articles.push(doc);
            seen.add(key);
          }
        }
        debugLog(`[BUILD] Added ${articles.length - baseArticles.length} priority slug articles (INCLUDE_SLUGS).`);
      }

      const processedArticles = await hydrateArticleMediaRelations(
        articles.map((doc) => ({
          ...doc,
          _id: doc._id?.toString(),
        })),
      );

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      debugLog(`[BUILD] Successfully fetched ${processedArticles.length} articles in ${duration}s`);
      debugLog(`[BUILD] Average: ${(processedArticles.length / (endTime - startTime) * 1000).toFixed(0)} articles/second`);

      cachedAllArticles = processedArticles;
      cachedAllArticlesAt = Date.now();
      return processedArticles;
    } catch (error) {
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      console.error(`[BUILD] Error fetching articles after ${duration}s:`, error);
      return [];
    } finally {
      inFlightAllArticlesPromise = null;
    }
  })();

  return inFlightAllArticlesPromise;
}

export async function getArticleBySlugFromMongo(slug: string) {
  // Optional local JSON lookup
  if (shouldUseLocalJson()) {
    try {
      const items = getPreparedArticles();
      const decodeSafe = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
      const variants = new Set<string>();
      const pushVar = (val?: string) => {
        if (!val) return;
        variants.add(val);
        variants.add(decodeSafe(val));
        variants.add(encodeURIComponent(decodeSafe(val)));
        variants.add(val.replace(/^\/+|\/+$/g, ''));
      };
      pushVar(slug);
      for (const item of items) {
        const itemSlug = typeof item.slug === 'string' ? item.slug : item.slug?.current;
        if (itemSlug && variants.has(itemSlug)) {
          const [mergedItem] = await backfillPreparedArticleMediaFields([item]);
          const [hydratedItem] = await hydrateArticleMediaRelations([mergedItem]);
          return hydratedItem || item;
        }
      }
    } catch (err) {
      console.error('❌ [BUILD] Local JSON slug lookup failed, falling back to Mongo:', err);
    }
  }

  try {
    // Support Unicode slugs (Arabic, etc.) and encoded/decoded/trimmed variants
    const decodeSafe = (s: string) => {
      try { return decodeURIComponent(s); } catch { return s; }
    };
    const add = (set: Set<string>, value?: string) => {
      if (!value || typeof value !== 'string') return;
      set.add(value);
      set.add(value.toLowerCase());
      // strip leading/trailing slashes
      set.add(value.replace(/^\/+|\/+$/g, ''));
      set.add(value.replace(/^\/+|\/+$/g, '').toLowerCase());
    };

    const variantsSet = new Set<string>();
    const decoded = decodeSafe(slug);
    const encoded = encodeURIComponent(decoded);

    add(variantsSet, slug);
    add(variantsSet, decoded);
    add(variantsSet, encoded);

    const variants = Array.from(variantsSet).filter(Boolean);

    const db = await getMongoConnection();
    const articlesCollection = db.collection('articles');
    const article = await articlesCollection.findOne({
      $and: [
        PUBLISHED_ARTICLE_MATCH,
        {
          $or: [
            { slug: { $in: variants } },             // plain string slug
            { 'slug.current': { $in: variants } },   // nested slug object { current: '...' }
          ],
        },
      ],
    });

    if (!article) return null;

    const [hydratedArticle] = await hydrateArticleMediaRelations([
      {
        ...article,
        _id: article._id?.toString(),
      },
    ]);

    return hydratedArticle || null;
  } catch (error) {
    console.error('❌ Error fetching article by slug from MongoDB:', error);
    return null;
  }
}

export async function getCommentsByArticleIdFromMongo(articleId: string) {
  if (shouldUseLocalJson()) {
    return [];
  }

  try {
    const db = await getMongoConnection();
    const commentsCollection = db.collection('comments');

    const comments = await commentsCollection
      .find({ article: new ObjectId(articleId) })
      .sort({ createdAt: -1 })
      .toArray();

    return comments.map((doc) => ({
      ...doc,
      _id: doc._id?.toString(),
    }));
  } catch (error) {
    console.error('❌ Error fetching comments from MongoDB:', error);
    return [];
  }
}

export async function saveCommentToMongo(articleId: string, commentData: {
  author: string;
  email: string;
  text: string;
  rating: number;
}) {
  try {
    const db = await getMongoConnection();
    const commentsCollection = db.collection('comments');

    const comment = {
      article: new ObjectId(articleId),
      author: commentData.author,
      email: commentData.email,
      text: commentData.text,
      rating: commentData.rating,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await commentsCollection.insertOne(comment);

    return {
      _id: result.insertedId.toString(),
      ...comment,
      article: articleId, // Return article as string for consistency
    };
  } catch (error) {
    console.error('❌ Error saving comment to MongoDB:', error);
    throw error;
  }
}

export async function searchArticlesFromMongo(query: string, limit = 50) {
  try {
    const trimmedQuery = String(query || '').trim();
    if (!trimmedQuery) return [];

    const db = await getMongoConnection();
    const articlesCollection = db.collection('articles');

    // Escape user input to avoid unsafe runtime regex behavior.
    const searchRegex = new RegExp(escapeRegex(trimmedQuery).slice(0, 120), 'i');

    const articles = await articlesCollection
      .aggregate([
        {
          $match: {
            ...PUBLISHED_ARTICLE_MATCH,
            $or: [
              { title: { $regex: searchRegex } },
              { excerpt: { $regex: searchRegex } },
              { content: { $regex: searchRegex } }
            ]
          }
        },
        {
          $lookup: {
            from: 'categories',
            localField: 'categories',
            foreignField: '_id',
            as: 'categories'
          }
        },
        { $limit: limit }
      ])
      .toArray();

    return articles.map((doc) => ({
      ...doc,
      _id: doc._id?.toString(),
    }));
  } catch (error) {
    console.error('❌ Error searching articles from MongoDB:', error);
    return [];
  }
}

export async function getAllCategoriesFromMongo() {
  if (shouldUseLocalJson()) {
    const allArticles = await getAllArticlesFromMongo();
    const seen = new Map<string, CategoryLike>();

    allArticles.forEach((article) => {
      const categories = Array.isArray(article?.categories) ? article.categories : [];
      categories.forEach((entry) => {
        const label = getTaxonomyLabel(entry);
        if (!label) return;
        const slug = label
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        if (!slug || seen.has(slug)) return;
        seen.set(slug, { _id: slug, title: label, name: label, slug });
      });
    });

    return Array.from(seen.values());
  }

  try {
    const db = await getMongoConnection();
    const categoriesCollection = db.collection('categories');

    const categories = await categoriesCollection.find({}).toArray();

    return categories.map((doc) => ({
      ...doc,
      _id: doc._id?.toString(),
    }));
  } catch (error) {
    console.error('❌ Error fetching categories from MongoDB:', error);
    return [];
  }
}

export async function getAllTagsFromMongo() {
  if (shouldUseLocalJson()) {
    const allArticles = await getAllArticlesFromMongo();
    const seen = new Map<string, CategoryLike>();

    allArticles.forEach((article) => {
      const tags = Array.isArray(article?.tags) ? article.tags : [];
      tags.forEach((entry) => {
        const label = getTaxonomyLabel(entry);
        if (!label) return;
        const slug = label
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        if (!slug || seen.has(slug)) return;
        seen.set(slug, { _id: slug, title: label, name: label, slug });
      });
    });

    return Array.from(seen.values());
  }

  try {
    const db = await getMongoConnection();
    const tagsCollection = db.collection('tags');

    const tags = await tagsCollection.find({}).toArray();

    return tags.map((doc) => ({
      ...doc,
      _id: doc._id?.toString(),
    }));
  } catch (error) {
    console.error('❌ Error fetching tags from MongoDB:', error);
    return [];
  }
}

export async function getArticlesByTagFromMongo(tagName: string, limit = 1000) {
  if (shouldUseLocalJson()) {
    const normalizedTagName = String(tagName || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    const allArticles = await getAllArticlesFromMongo();

    return allArticles
      .filter((article) => {
        const tags = Array.isArray(article?.tags) ? article.tags : [];
        return tags.some((entry) =>
          normalizeComparableText(getTaxonomyLabel(entry)).includes(normalizedTagName),
        );
      })
      .slice(0, limit);
  }

  try {
    const db = await getMongoConnection();
    const articlesCollection = db.collection('articles');

    const articles = await articlesCollection
      .find({
        ...PUBLISHED_ARTICLE_MATCH,
        tags: { $in: [tagName] }
      })
      .limit(limit)
      .toArray();

    return articles.map((doc) => ({
      ...doc,
      _id: doc._id?.toString(),
    }));
  } catch (error) {
    console.error('❌ Error fetching articles by tag from MongoDB:', error);
    return [];
  }
}
