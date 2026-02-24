import fs from 'fs';
import path from 'path';

const preparedPath = path.join(process.cwd(), 'prepared-articles.json');

const rawApiBase =
  process.env.PAYLOAD_API_URL ||
  process.env.PUBLIC_PAYLOAD_API_URL ||
  process.env.PAYLOAD_URL;

const apiToken =
  process.env.PAYLOAD_API_TOKEN ||
  process.env.PAYLOAD_TOKEN ||
  process.env.PAYLOAD_AUTH_TOKEN;

const inputSlug = process.env.SLUG || process.argv[2] || '';
const inputId = process.env.ID || process.argv[3] || '';

const inputArticleIdsJson = process.env.ARTICLE_IDS_JSON || '[]';
const inputArticleSlugsJson = process.env.ARTICLE_SLUGS_JSON || '[]';
const inputArticleDeleteIdsJson = process.env.ARTICLE_DELETE_IDS_JSON || '[]';
const inputArticleDeleteSlugsJson = process.env.ARTICLE_DELETE_SLUGS_JSON || '[]';

const normalizeBase = (value) =>
  typeof value === 'string' ? value.trim().replace(/\/+$/g, '') : '';

const buildApiBaseCandidates = (value) => {
  const normalized = normalizeBase(value);
  if (!normalized) return [];

  const candidates = [];
  const seen = new Set();
  const add = (candidate) => {
    const clean = normalizeBase(candidate);
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    candidates.push(clean);
  };

  add(normalized);

  try {
    const parsed = new URL(normalized);
    const parsedPath = parsed.pathname.replace(/\/+$/g, '');
    const lowerPath = parsedPath.toLowerCase();

    if (!parsedPath || parsedPath === '/') {
      parsed.pathname = '/api';
      add(parsed.toString());
      return candidates;
    }

    if (lowerPath.endsWith('/api')) {
      const withoutApiPath = parsedPath.slice(0, -4) || '/';
      parsed.pathname = withoutApiPath;
      add(parsed.toString());
      return candidates;
    }

    if (lowerPath.includes('/api/')) {
      parsed.pathname = parsedPath.slice(0, lowerPath.indexOf('/api/') + 4);
      add(parsed.toString());
    }

    parsed.pathname = `${parsedPath}/api`;
    add(parsed.toString());
  } catch {
    // Keep raw candidate for non-standard URL values.
  }

  return candidates;
};

const apiBases = buildApiBaseCandidates(rawApiBase);

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
  slug = decodeSafe(slug);
  slug = slug.replace(/^\/+|\/+$/g, '');
  slug = slug.replace(/^articles?\//i, '');
  slug = slug.replace(/\/index\.html?$/i, '');
  slug = slug.replace(/\.html?$/i, '');
  return slug;
};

const normalizeId = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const getItemSlug = (item) => {
  if (!item) return '';
  if (typeof item.slug === 'string') return normalizeSlug(item.slug);
  if (item.slug?.current) return normalizeSlug(item.slug.current);
  return '';
};

const getItemId = (item) => {
  if (!item) return '';
  return item._id || item.id || item?.doc?._id || item?.doc?.id || '';
};

const buildHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (apiToken) {
    headers.Authorization = `Bearer ${apiToken}`;
  }
  return headers;
};

const fetchPayloadJSON = async (endpointPath, queryParams) => {
  let lastError = null;
  const attemptedURLs = [];

  for (const base of apiBases) {
    const qs = queryParams ? `?${queryParams.toString()}` : '';
    const url = `${base}${endpointPath}${qs}`;
    attemptedURLs.push(url);

    const res = await fetch(url, { headers: buildHeaders() });
    if (res.ok) {
      return res.json();
    }

    if (res.status === 404) {
      continue;
    }

    const details = await res.text().catch(() => '');
    lastError = new Error(
      `Payload API error (${res.status}) ${res.statusText} for ${url}${
        details ? ` | ${details.slice(0, 200)}` : ''
      }`,
    );

    if (res.status === 401 || res.status === 403) {
      break;
    }
  }

  if (lastError) {
    throw new Error(`${lastError.message}. Tried candidates: ${attemptedURLs.join(', ')}`);
  }

  return null;
};

const fetchArticleBySlug = async (slug) => {
  const qs = new URLSearchParams();
  qs.set('limit', '1');
  qs.set('depth', '2');
  qs.set('where[slug][equals]', slug);

  const data = await fetchPayloadJSON('/articles', qs);
  const docs = Array.isArray(data?.docs) ? data.docs : Array.isArray(data) ? data : [];
  return docs[0] || null;
};

const fetchArticleById = async (id) => {
  const qs = new URLSearchParams();
  qs.set('depth', '2');
  const data = await fetchPayloadJSON(`/articles/${encodeURIComponent(id)}`, qs);
  return data || null;
};

const parseList = (value) => {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed === null || parsed === undefined) {
      return [];
    }
    return [parsed];
  } catch {
    return String(value)
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
};

const loadPreparedArticles = () => {
  if (!fs.existsSync(preparedPath)) return [];
  const raw = fs.readFileSync(preparedPath, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
};

const writePreparedArticles = (items) => {
  fs.writeFileSync(preparedPath, JSON.stringify(items, null, 2));
};

const ensureIds = (doc) => {
  const existingId = doc?.id ?? doc?._id ?? doc?.doc?.id ?? doc?.doc?._id ?? '';
  const normalized = normalizeId(existingId);
  if (!normalized) return doc;
  return {
    ...doc,
    id: doc?.id || normalized,
    _id: doc?._id || normalized,
  };
};

const removeMatches = ({ items, ids, slugs }) =>
  items.filter((item) => {
    const itemId = normalizeId(getItemId(item));
    const itemSlug = getItemSlug(item);
    if (itemId && ids.has(itemId)) return false;
    if (itemSlug && slugs.has(itemSlug)) return false;
    return true;
  });

const upsertArticle = (items, article) => {
  const normalized = ensureIds(article);
  const articleId = normalizeId(getItemId(normalized));
  const articleSlug = normalizeSlug(
    typeof normalized.slug === 'string' ? normalized.slug : normalized.slug?.current,
  );

  let index = -1;
  if (articleId) {
    index = items.findIndex((item) => normalizeId(getItemId(item)) === articleId);
  }
  if (index === -1 && articleSlug) {
    index = items.findIndex((item) => getItemSlug(item) === articleSlug);
  }

  if (index >= 0) {
    items[index] = {
      ...normalized,
      slug: articleSlug || normalized.slug,
    };
  } else {
    items.push({
      ...normalized,
      slug: articleSlug || normalized.slug,
    });
  }
};

const dedupeByIdentity = (items) => {
  const deduped = [];
  const seenIds = new Set();
  const seenSlugs = new Set();

  for (const item of items) {
    const itemId = normalizeId(getItemId(item));
    const itemSlug = getItemSlug(item);

    if (itemId && seenIds.has(itemId)) continue;
    if (itemSlug && seenSlugs.has(itemSlug)) continue;

    if (itemId) seenIds.add(itemId);
    if (itemSlug) seenSlugs.add(itemSlug);

    deduped.push(item);
  }

  return deduped;
};

const main = async () => {
  if (!apiBases.length) {
    console.error('ERROR: PAYLOAD_API_URL not set.');
    process.exit(1);
  }

  const updateIds = new Set(
    parseList(inputArticleIdsJson).map((value) => normalizeId(value)).filter(Boolean),
  );
  const updateSlugs = new Set(
    parseList(inputArticleSlugsJson).map((value) => normalizeSlug(value)).filter(Boolean),
  );
  const deleteIds = new Set(
    parseList(inputArticleDeleteIdsJson).map((value) => normalizeId(value)).filter(Boolean),
  );
  const deleteSlugs = new Set(
    parseList(inputArticleDeleteSlugsJson).map((value) => normalizeSlug(value)).filter(Boolean),
  );

  const fallbackId = normalizeId(inputId);
  const fallbackSlug = normalizeSlug(inputSlug);
  if (fallbackId) updateIds.add(fallbackId);
  if (fallbackSlug) updateSlugs.add(fallbackSlug);

  for (const id of deleteIds) updateIds.delete(id);
  for (const slug of deleteSlugs) updateSlugs.delete(slug);

  const hasChanges =
    updateIds.size > 0 || updateSlugs.size > 0 || deleteIds.size > 0 || deleteSlugs.size > 0;

  if (!hasChanges) {
    console.log('No batch changes received. prepared-articles.json left unchanged.');
    return;
  }

  console.log(`Payload API candidates: ${apiBases.join(', ')}`);
  console.log(
    `Applying batch changes: +ids=${updateIds.size}, +slugs=${updateSlugs.size}, -ids=${deleteIds.size}, -slugs=${deleteSlugs.size}`,
  );

  let articles = loadPreparedArticles();
  const beforeDeleteCount = articles.length;
  articles = removeMatches({
    items: articles,
    ids: deleteIds,
    slugs: deleteSlugs,
  });
  const removedByDeleteCount = beforeDeleteCount - articles.length;

  const fetchedArticles = [];
  const fetchedIds = new Set();
  const fetchedSlugs = new Set();

  for (const id of updateIds) {
    const article = await fetchArticleById(id);
    if (!article) {
      console.warn(`Article not found for ID=${id}; removing stale entry if present.`);
      articles = removeMatches({
        items: articles,
        ids: new Set([id]),
        slugs: new Set(),
      });
      continue;
    }

    const normalized = ensureIds(article);
    fetchedArticles.push(normalized);

    const resolvedId = normalizeId(getItemId(normalized));
    const resolvedSlug = getItemSlug(normalized);
    if (resolvedId) fetchedIds.add(resolvedId);
    if (resolvedSlug) fetchedSlugs.add(resolvedSlug);
  }

  for (const slug of updateSlugs) {
    if (fetchedSlugs.has(slug)) continue;

    const article = await fetchArticleBySlug(slug);
    if (!article) {
      console.warn(`Article not found for slug=${slug}; removing stale entry if present.`);
      articles = removeMatches({
        items: articles,
        ids: new Set(),
        slugs: new Set([slug]),
      });
      continue;
    }

    const normalized = ensureIds(article);
    const resolvedId = normalizeId(getItemId(normalized));
    if (resolvedId && fetchedIds.has(resolvedId)) continue;

    fetchedArticles.push(normalized);
    if (resolvedId) fetchedIds.add(resolvedId);
    const resolvedSlug = getItemSlug(normalized);
    if (resolvedSlug) fetchedSlugs.add(resolvedSlug);
  }

  for (const article of fetchedArticles) {
    upsertArticle(articles, article);
  }

  const deduped = dedupeByIdentity(articles);
  writePreparedArticles(deduped);

  console.log(
    `prepared-articles.json updated. removed=${removedByDeleteCount}, upserted=${fetchedArticles.length}, total=${deduped.length}`,
  );
};

main().catch((error) => {
  console.error('ERROR: Failed to update prepared-articles.json in batch mode:', error);
  process.exit(1);
});
