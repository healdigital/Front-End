import fs from 'fs';
import path from 'path';

const preparedPath = path.join(process.cwd(), 'prepared-articles.json');

const apiBase =
  process.env.PAYLOAD_API_URL ||
  process.env.PUBLIC_PAYLOAD_API_URL ||
  process.env.PAYLOAD_URL;

const apiToken =
  process.env.PAYLOAD_API_TOKEN ||
  process.env.PAYLOAD_TOKEN ||
  process.env.PAYLOAD_AUTH_TOKEN;

const inputSlug = process.env.SLUG || process.argv[2] || '';
const inputId = process.env.ID || process.argv[3] || '';

const decodeSafe = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const normalizeSlug = (value) => {
  if (typeof value !== 'string') return '';
  let slug = value.trim();
  try {
    slug = decodeURIComponent(slug);
  } catch {
    // keep original
  }
  slug = slug.replace(/^\/+|\/+$/g, '');
  slug = slug.replace(/^articles?\//i, '');
  slug = slug.replace(/\/index\.html?$/i, '');
  slug = slug.replace(/\.html?$/i, '');
  return slug;
};

const normalizeId = (value) => (value ? String(value).trim() : '');

const getItemSlug = (item) => {
  if (!item) return '';
  if (typeof item.slug === 'string') return normalizeSlug(item.slug);
  if (item.slug?.current) return normalizeSlug(item.slug.current);
  return '';
};

const getItemId = (item) => {
  if (!item) return '';
  return (
    item._id ||
    item.id ||
    item?.doc?._id ||
    item?.doc?.id ||
    ''
  );
};

const normalizeTitle = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
};

const buildHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (apiToken) {
    headers.Authorization = `Bearer ${apiToken}`;
  }
  return headers;
};

const fetchArticleBySlug = async (slug) => {
  const qs = new URLSearchParams();
  qs.set('limit', '1');
  qs.set('depth', '2');
  qs.set('where[slug][equals]', slug);
  const url = `${apiBase}/articles?${qs.toString()}`;
  const res = await fetch(url, { headers: buildHeaders() });
  if (!res.ok) {
    throw new Error(`Payload API error (${res.status}) ${res.statusText}`);
  }
  const data = await res.json();
  const docs = Array.isArray(data?.docs) ? data.docs : Array.isArray(data) ? data : [];
  return docs[0] || null;
};

const fetchArticleById = async (id) => {
  const url = `${apiBase}/articles/${encodeURIComponent(id)}?depth=2`;
  const res = await fetch(url, { headers: buildHeaders() });
  if (!res.ok) {
    throw new Error(`Payload API error (${res.status}) ${res.statusText}`);
  }
  return res.json();
};

const loadPreparedArticles = () => {
  if (!fs.existsSync(preparedPath)) {
    return [];
  }
  const raw = fs.readFileSync(preparedPath, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
};

const writePreparedArticles = (items) => {
  fs.writeFileSync(preparedPath, JSON.stringify(items, null, 2));
};

const main = async () => {
  if (!apiBase) {
    console.error('ERROR: PAYLOAD_API_URL not set.');
    process.exit(1);
  }

  const slug = normalizeSlug(inputSlug);
  const id = String(inputId || '').trim();

  if (!slug && !id) {
    console.error('ERROR: Missing SLUG or ID. Provide SLUG env or pass slug as argument.');
    process.exit(1);
  }

  const article = id ? await fetchArticleById(id) : await fetchArticleBySlug(slug);
  if (!article) {
    console.error('ERROR: Article not found in Payload API.');
    process.exit(1);
  }

  const articles = loadPreparedArticles();
  const normalizedSlug = normalizeSlug(
    typeof article.slug === 'string' ? article.slug : article.slug?.current || slug,
  );
  const normalizedTitle = normalizeTitle(article.title);

  const articleId = normalizeId(
    article._id || article.id || article?.doc?._id || article?.doc?.id || id,
  );

  const variants = new Set([
    normalizedSlug,
    normalizeSlug(decodeSafe(normalizedSlug)),
    normalizeSlug(slug),
    normalizeSlug(decodeSafe(slug)),
  ].filter(Boolean));

  let index = -1;
  if (articleId) {
    index = articles.findIndex((item) => normalizeId(getItemId(item)) === articleId);
  }
  if (index === -1) {
    index = articles.findIndex((item) => variants.has(getItemSlug(item)));
  }
  if (index === -1 && normalizedTitle) {
    const titleMatches = articles
      .map((item, idx) => ({ idx, title: normalizeTitle(item?.title) }))
      .filter((entry) => entry.title && entry.title === normalizedTitle);
    if (titleMatches.length === 1) {
      index = titleMatches[0].idx;
    } else if (titleMatches.length > 1) {
      console.warn(
        `Multiple title matches for "${article.title}". Skipping title-based update.`,
      );
    }
  }

  const merged = {
    ...article,
    _id: articleId || article._id || article.id || article?.doc?._id || article?.doc?.id,
    id: articleId || article.id || article._id || article?.doc?.id || article?.doc?._id,
    slug: normalizedSlug || article.slug,
  };

  if (index >= 0) {
    articles[index] = merged;
    console.log(`Updated prepared-articles.json entry for slug: ${normalizedSlug}`);
  } else {
    // Remove any stale entries that still match this slug/id before adding.
    const cleaned = articles.filter((item) => {
      const itemId = normalizeId(getItemId(item));
      const itemSlug = getItemSlug(item);
      if (articleId && itemId && itemId === articleId) return false;
      if (itemSlug && variants.has(itemSlug)) return false;
      return true;
    });
    cleaned.push(merged);
    articles.length = 0;
    articles.push(...cleaned);
    console.log(`Added new entry to prepared-articles.json for slug: ${normalizedSlug}`);
  }

  const deduped = [];
  const seenIds = new Set();
  const seenSlugs = new Set();
  for (const item of articles) {
    const itemId = normalizeId(getItemId(item));
    const itemSlug = getItemSlug(item);

    if (itemId && seenIds.has(itemId)) continue;
    if (itemSlug && seenSlugs.has(itemSlug)) continue;

    if (itemId) seenIds.add(itemId);
    if (itemSlug) seenSlugs.add(itemSlug);

    deduped.push(item);
  }

  writePreparedArticles(deduped);
};

main().catch((error) => {
  console.error('ERROR: Failed to update prepared-articles.json:', error);
  process.exit(1);
});
