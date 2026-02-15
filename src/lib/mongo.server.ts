import { MongoClient, ObjectId, type Db } from 'mongodb';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load env variables
config();

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;
let cachedPreparedArticles: any[] | null = null;
let cachedAllArticles: any[] | null = null;
let cachedAllArticlesAt = 0;
let inFlightAllArticlesPromise: Promise<any[]> | null = null;

const isDevMode = () => process.env.NODE_ENV !== 'production';

const getBuildLimit = () => {
  const envMax = Number(process.env.MAX_SSG_ARTICLES);
  const requestedLimit = Number.isFinite(envMax) && envMax > 0 ? envMax : 50;

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

const getPreparedArticles = () => {
  if (cachedPreparedArticles) return cachedPreparedArticles;
  const preparedPath = path.join(process.cwd(), 'prepared-articles.json');
  const raw = fs.readFileSync(preparedPath, 'utf8');
  const items = JSON.parse(raw);
  cachedPreparedArticles = Array.isArray(items) ? items : [];
  return cachedPreparedArticles;
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

    console.log('🔌 [BUILD] Establishing MongoDB connection...');
    const maxRetries = 3;
    let attempt = 0;
    let lastError: any = null;

    while (attempt < maxRetries) {
      attempt++;
      const connectionStartTime = Date.now();
      try {
        const client = new MongoClient(mongoUri);
        await client.connect();

        const connectionEndTime = Date.now();
        const connectionDuration = ((connectionEndTime - connectionStartTime) / 1000).toFixed(2);
        console.log(`✅ [BUILD] MongoDB connected successfully in ${connectionDuration}s (attempt ${attempt})`);

        const db = client.db('lcdb');
        cachedClient = client;
        cachedDb = db;
        return db;
      } catch (err) {
        lastError = err;
        console.warn(`⚠️ [BUILD] MongoDB connect attempt ${attempt} failed:`, err && err.message ? err.message : err);
        const backoffMs = 250 * Math.pow(2, attempt - 1);
        await new Promise(res => setTimeout(res, backoffMs));
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
  try {
    const db = await getMongoConnection();
    const articlesCollection = db.collection('articles');
    const categoriesCollection = db.collection('categories');
    const skip = (page - 1) * limit;

    let query = {};
    if (categoryName) {
      // Find the category by name
      const category = await categoriesCollection.findOne({
        name: new RegExp(categoryName, 'i')
      });

      if (category) {
        query = { categories: category._id };
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

    return articles.map(doc => ({
      _id: doc._id?.toString(),
      ...doc,
    }));
  } catch (error) {
    console.error('❌ Error fetching articles from MongoDB:', error);
    return [];
  }
}

export async function getArticlesCountFromMongo(): Promise<number> {
  try {
    const db = await getMongoConnection();
    const articlesCollection = db.collection('articles');
    const count = await articlesCollection.countDocuments({});
    return count;
  } catch (error) {
    console.error('❌ Error fetching articles count from MongoDB:', error);
    return 0;
  }
}

export async function getRelatedArticlesFromMongo(categoryIds: any[], excludeArticleId: string, limit = 6) {
  try {
    // Convert excludeArticleId to ObjectId if it's a string
    let excludeId = excludeArticleId;
    if (typeof excludeArticleId === 'string' && excludeArticleId.match(/^[0-9a-fA-F]{24}$/)) {
      excludeId = new ObjectId(excludeArticleId);
    }

    console.log('🔍 [RELATED] Exclude ID:', excludeId);

    const db = await getMongoConnection();
    const articlesCollection = db.collection('articles');

    // Convert string IDs to ObjectIds if needed
    const objectIds = categoryIds.map(id => {
      if (typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/)) {
        return new ObjectId(id);
      }
      return id;
    });

    console.log('🔍 [RELATED] Converted category IDs:', objectIds);

    const relatedArticles = await articlesCollection
      .aggregate([
        {
          $match: {
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

    console.log('✅ [RELATED] Found', relatedArticles.length, 'related articles');

    return relatedArticles.map(doc => ({
      _id: doc._id?.toString(),
      ...doc,
    }));
  } catch (error) {
    console.error('❌ Error fetching related articles from MongoDB:', error);
    return [];
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
    if (process.env.USE_LOCAL_JSON === '1') {
      try {
        const items = getPreparedArticles();
        const cappedItems = items.slice(0, limit);
        console.log(`[BUILD] Using prepared-articles.json with ${cappedItems.length}/${items.length} articles (USE_LOCAL_JSON=1, MAX_SSG_ARTICLES=${limit})`);
        cachedAllArticles = cappedItems;
        cachedAllArticlesAt = Date.now();
        return cappedItems;
      } catch (err) {
        console.error('[BUILD] Failed to read prepared-articles.json, falling back to Mongo:', err);
      }
    }

    const startTime = Date.now();
    console.log('[BUILD] Starting to fetch ALL articles from MongoDB...');

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
        console.log('[BUILD] Skipping INCLUDE_SLUGS in dev (set DEV_INCLUDE_SLUGS=1 to enable).');
      }

      // Count can be skipped in dev to speed up route generation.
      if (isDevMode()) {
        console.log(`[BUILD] Dev mode: fetching ${limit} articles (count skipped).`);
      } else {
        const totalCount = await articlesCollection.countDocuments();
        console.log(`[BUILD] Found ${totalCount} articles in database`);

        if (totalCount > limit) {
          console.warn(`[BUILD] Will fetch ${limit} base articles (set MAX_SSG_ARTICLES to raise). Priority slugs will still be added.`);
        }
      }

      const projection = {
        _id: 1,
        slug: 1,
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
      console.log(`[BUILD] Fetching up to ${limit} base articles from MongoDB (fields needed for SSG)...`);
      const baseArticles = await articlesCollection
        .find({}, { projection })
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
              $or: [
                { slug: { $in: prioritySlugs } },
                { 'slug.current': { $in: prioritySlugs } },
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
        console.log(`[BUILD] Added ${articles.length - baseArticles.length} priority slug articles (INCLUDE_SLUGS).`);
      }

      const processedArticles = articles.map(doc => ({
        _id: doc._id?.toString(),
        ...doc,
      }));

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      console.log(`[BUILD] Successfully fetched ${processedArticles.length} articles in ${duration}s`);
      console.log(`[BUILD] Average: ${(processedArticles.length / (endTime - startTime) * 1000).toFixed(0)} articles/second`);

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
  if (process.env.USE_LOCAL_JSON === '1') {
    try {
      const preparedPath = path.join(process.cwd(), 'prepared-articles.json');
      const raw = fs.readFileSync(preparedPath, 'utf8');
      const items = JSON.parse(raw);
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
          return item;
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
      $or: [
        { slug: { $in: variants } },             // plain string slug
        { 'slug.current': { $in: variants } },   // Sanity-style { current: '...' }
      ],
    });

    if (!article) return null;

    return {
      _id: article._id?.toString(),
      ...article,
    };
  } catch (error) {
    console.error('❌ Error fetching article by slug from MongoDB:', error);
    return null;
  }
}

export async function getCommentsByArticleIdFromMongo(articleId: string) {
  try {
    const db = await getMongoConnection();
    const commentsCollection = db.collection('comments');

    const comments = await commentsCollection
      .find({ article: new ObjectId(articleId) })
      .sort({ createdAt: -1 })
      .toArray();

    return comments.map(doc => ({
      _id: doc._id?.toString(),
      ...doc,
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
    const db = await getMongoConnection();
    const articlesCollection = db.collection('articles');

    // Create a regex pattern for case-insensitive search
    const searchRegex = new RegExp(query, 'i');

    const articles = await articlesCollection
      .aggregate([
        {
          $match: {
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

    return articles.map(doc => ({
      _id: doc._id?.toString(),
      ...doc,
    }));
  } catch (error) {
    console.error('❌ Error searching articles from MongoDB:', error);
    return [];
  }
}

export async function getAllCategoriesFromMongo() {
  try {
    const db = await getMongoConnection();
    const categoriesCollection = db.collection('categories');

    const categories = await categoriesCollection.find({}).toArray();

    return categories.map(doc => ({
      _id: doc._id?.toString(),
      ...doc,
    }));
  } catch (error) {
    console.error('❌ Error fetching categories from MongoDB:', error);
    return [];
  }
}

export async function getAllTagsFromMongo() {
  try {
    const db = await getMongoConnection();
    const tagsCollection = db.collection('tags');

    const tags = await tagsCollection.find({}).toArray();

    return tags.map(doc => ({
      _id: doc._id?.toString(),
      ...doc,
    }));
  } catch (error) {
    console.error('❌ Error fetching tags from MongoDB:', error);
    return [];
  }
}

export async function getArticlesByTagFromMongo(tagName: string, limit = 1000) {
  try {
    const db = await getMongoConnection();
    const articlesCollection = db.collection('articles');

    const articles = await articlesCollection
      .find({
        tags: { $in: [tagName] }
      })
      .limit(limit)
      .toArray();

    return articles.map(doc => ({
      _id: doc._id?.toString(),
      ...doc,
    }));
  } catch (error) {
    console.error('❌ Error fetching articles by tag from MongoDB:', error);
    return [];
  }
}
