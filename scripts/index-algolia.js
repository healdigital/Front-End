import * as algoliasearchModule from 'algoliasearch';
import fs from 'node:fs';
import path from 'node:path';

// Handle different Algolia package export shapes
let algoliasearch;
if (typeof algoliasearchModule.algoliasearch === 'function') {
  algoliasearch = algoliasearchModule.algoliasearch;
} else if (typeof algoliasearchModule.default === 'function') {
  algoliasearch = algoliasearchModule.default;
} else if (typeof algoliasearchModule === 'function') {
  algoliasearch = algoliasearchModule;
} else {
  console.error('[ALGOLIA] Could not resolve algoliasearch function from package.');
  process.exit(1);
}

const appId = process.env.ALGOLIA_APP_ID || process.env.PUBLIC_ALGOLIA_APP_ID;
const adminKey = process.env.ALGOLIA_ADMIN_KEY || process.env.ALGOLIA_WRITE_KEY;

if (!appId || !adminKey) {
  console.error('[ALGOLIA] Missing ALGOLIA_APP_ID and/or ALGOLIA_ADMIN_KEY/ALGOLIA_WRITE_KEY.');
  process.exit(1);
}

const indexPrefix = process.env.ALGOLIA_INDEX_PREFIX || 'lcdb_recipes';
const batchSize = Number(process.env.ALGOLIA_BATCH_SIZE || 500);
const preparedJsonPath = path.join(process.cwd(), 'prepared-articles.json');

const getAlgoliaSource = () => String(process.env.ALGOLIA_SOURCE || '').trim().toLowerCase();

const shouldUsePreparedFirst = () => {
  const source = getAlgoliaSource();
  return source !== 'mongo' && source !== 'api';
};

const readPreparedArticles = () => {
  if (!fs.existsSync(preparedJsonPath)) return null;

  try {
    const raw = fs.readFileSync(preparedJsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    console.warn('[ALGOLIA] Failed to parse prepared-articles.json:', error?.message || error);
    return null;
  }
};

const normalizeLang = (value) =>
  String(value || 'en')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'en';

const buildIndexName = (lang) => `${indexPrefix}_${normalizeLang(lang)}`;

const stripHtml = (value) => String(value || '').replace(/<[^>]*>/g, ' ');

const richTextToPlain = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return stripHtml(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item) return '';
        if (typeof item === 'string') return stripHtml(item);
        if (typeof item === 'object') {
          if (typeof item.text === 'string') return item.text;
          if (Array.isArray(item.children)) {
            return item.children
              .map((child) => (typeof child?.text === 'string' ? child.text : ''))
              .join(' ');
          }
        }
        return '';
      })
      .join(' ');
  }
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text;
    if (Array.isArray(value.children)) {
      return value.children
        .map((child) => (typeof child?.text === 'string' ? child.text : ''))
        .join(' ');
    }
  }
  return '';
};

const entityName = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return value.name || value.title || value.label || '';
  }
  return '';
};

const replaceCdnUrl = (url) => {
  if (!url) return url;
  return String(url)
    .replace(
      /^https?:\/\/cdn\.lacuisinedebernard\.com\//i,
      'https://lcdb.fra1.digitaloceanspaces.com/'
    )
    .replace(
      /^https?:\/\/(?:www\.)?lacuisinedebernard\.com\/wp-content\/uploads\//i,
      'https://lcdb.fra1.digitaloceanspaces.com/wp-content/uploads/'
    );
};

const processArticleImageUrl = (article) => {
  if (!article) return '';

  const extractFromHtml = (html) => {
    if (!html || typeof html !== 'string') return '';
    const match =
      html.match(/<img[^>]+src=["']([^"']+)["']/i) ||
      html.match(/<img[^>]+data-src=["']([^"']+)["']/i);
    if (!match) return '';
    return match[1] || '';
  };

  const possibleUrls = [
    article.featuredMedia?.url,
    article.featuredMedia?.value?.url,
    article.featured_image?.asset?.url,
    article.featured_image?.url,
    article.featured_image_url,
    article.featured_img_url,
    article.featureImage,
    article.featuredImage?.url,
    article.featuredImageUrl,
    extractFromHtml(article.content),
    extractFromHtml(article.contentV2),
  ];

  const imageUrl = possibleUrls.find((url) => url && typeof url === 'string');
  if (!imageUrl) return '';
  return replaceCdnUrl(imageUrl);
};

async function fetchArticles() {
  if (shouldUsePreparedFirst()) {
    const prepared = readPreparedArticles();
    if (Array.isArray(prepared) && prepared.length > 0) {
      console.log(`[ALGOLIA] Using prepared-articles.json (${prepared.length} articles).`);
      return prepared;
    }
    console.warn('[ALGOLIA] prepared-articles.json not found/empty. Falling back to Mongo/API.');
  }

  // Try to load Mongo helper; gracefully fallback to Payload API if TS import fails.
  let articles = [];
  try {
    const { getAllArticlesFromMongo: getArticles } = await import('../src/lib/mongo.server.ts');
    articles = await getArticles();
  } catch (err) {
    console.warn('[ALGOLIA] Could not import Mongo helper, falling back to Payload API. Error:', err?.message || err);
  }

  if (!Array.isArray(articles) || articles.length === 0) {
    const payloadApiUrl = process.env.PUBLIC_PAYLOAD_API_URL || process.env.PAYLOAD_API_URL;
    if (payloadApiUrl) {
      console.warn('[ALGOLIA] Mongo returned 0 articles. Falling back to Payload API.');
      const pageSize = 100;
      let page = 1;
      let totalPages = 0;
      let safety = 0;
      const fetched = [];

      while (safety < 500) {
        safety += 1;
        const url = `${payloadApiUrl}/articles?limit=${pageSize}&page=${page}&depth=2`;
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(`[ALGOLIA] Payload API error ${res.status} ${res.statusText}`);
          break;
        }
        const data = await res.json();
        const docs = Array.isArray(data?.docs) ? data.docs : Array.isArray(data) ? data : [];
        if (docs.length === 0) break;
        fetched.push(...docs);

        totalPages = Number(data?.totalPages) || totalPages;
        if (totalPages && page >= totalPages) break;
        if (docs.length < pageSize) break;
        page += 1;
      }

      articles = fetched;
    } else {
      console.warn('[ALGOLIA] PUBLIC_PAYLOAD_API_URL not set; cannot fallback to Payload API.');
    }
  }

  return Array.isArray(articles) ? articles : [];
}

function buildRecord(article) {
  const slug = typeof article.slug === 'string' ? article.slug : article.slug?.current || '';
  if (!slug) return null;

  const language = article.language || article.lang || 'en';
  const id = article._id?.toString() || article.id?.toString() || '';
  const objectID = id || `${normalizeLang(language)}:${slug}`;

  const contentText = richTextToPlain(article.content).substring(0, 2000);
  const excerptText = richTextToPlain(article.excerpt);
  const categoryText = Array.isArray(article.categories)
    ? article.categories.map(entityName).filter(Boolean).join(' ')
    : entityName(article.category);
  const tagsText = Array.isArray(article.tags)
    ? article.tags.map(entityName).filter(Boolean).join(' ')
    : '';
  const authorText = entityName(article.author);

  return {
    objectID,
    id,
    title: article.title || '',
    slug,
    url: `/${slug}`,
    language,
    content: contentText,
    excerpt: excerptText,
    category: categoryText,
    tags: tagsText,
    author: authorText,
    publishedAt: article.publishedAt || article.date || article.modified || '',
    featured_image: {
      url: processArticleImageUrl(article),
      alt: article.featured_image?.alt || article.title || '',
    },
  };
}

async function indexAlgolia() {
  console.log('[ALGOLIA] Preparing records...');
  const articles = await fetchArticles();
  console.log(`[ALGOLIA] Found ${articles.length} articles to index.`);

  const recordsByLang = new Map();
  for (const article of articles) {
    const record = buildRecord(article);
    if (!record) continue;
    const langKey = normalizeLang(record.language);
    if (!recordsByLang.has(langKey)) {
      recordsByLang.set(langKey, []);
    }
    recordsByLang.get(langKey).push(record);
  }

  if (recordsByLang.size === 0) {
    console.warn('[ALGOLIA] No records to index.');
    return;
  }

  const client = algoliasearch(appId, adminKey);
  const supportsTopLevelIndexing =
    typeof client.setSettings === 'function' &&
    typeof client.saveObjects === 'function';

  for (const [langKey, records] of recordsByLang.entries()) {
    const indexName = buildIndexName(langKey);

    console.log(`[ALGOLIA] Indexing ${records.length} records -> ${indexName}`);

    const indexSettings = {
      searchableAttributes: [
        'title',
        'excerpt',
        'content',
        'category',
        'tags',
        'author',
      ],
      attributesForFaceting: ['filterOnly(language)'],
    };

    if (supportsTopLevelIndexing) {
      await client.setSettings({
        indexName,
        indexSettings,
      });

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        await client.saveObjects({
          indexName,
          objects: batch,
        });
        console.log(`[ALGOLIA] ${indexName}: ${Math.min(i + batch.length, records.length)}/${records.length}`);
      }

      continue;
    }

    // Backward compatibility for older clients.
    let index;
    if (typeof client.initIndex === 'function') {
      index = client.initIndex(indexName);
    } else if (typeof client.index === 'function') {
      index = client.index(indexName);
    } else {
      console.warn(`[ALGOLIA] Client does not support index operations. Skipping index: ${indexName}`);
      continue;
    }

    await index.setSettings(indexSettings);

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await index.saveObjects(batch, { autoGenerateObjectIDIfNotExist: true });
      console.log(`[ALGOLIA] ${indexName}: ${Math.min(i + batch.length, records.length)}/${records.length}`);
    }
  }

  console.log('[ALGOLIA] Indexing complete.');
}

indexAlgolia().catch((error) => {
  console.error('[ALGOLIA] Indexing failed:', error);
  process.exit(1);
});
