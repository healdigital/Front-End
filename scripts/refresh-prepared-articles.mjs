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

const pageSize = Number(process.env.PAYLOAD_PAGE_SIZE) || 100;
const depth = Number(process.env.PAYLOAD_DEPTH) || 2;
const limit = Number(process.env.PAYLOAD_LIMIT) || 0;
const requestTimeoutMs = Number(process.env.PAYLOAD_FETCH_TIMEOUT_MS) || 15000;

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
    const path = parsed.pathname.replace(/\/+$/g, '');
    const lowerPath = path.toLowerCase();

    if (!path || path === '/') {
      parsed.pathname = '/api';
      add(parsed.toString());
      return candidates;
    }

    if (lowerPath.endsWith('/api')) {
      const withoutApiPath = path.slice(0, -4) || '/';
      parsed.pathname = withoutApiPath;
      add(parsed.toString());
      return candidates;
    }

    if (!lowerPath.endsWith('/api')) {
      if (lowerPath.includes('/api/')) {
        parsed.pathname = path.slice(0, lowerPath.indexOf('/api/') + 4);
        add(parsed.toString());
      }

      parsed.pathname = `${path}/api`;
      add(parsed.toString());
    }
  } catch {
    // keep raw candidate for non-standard URL inputs
  }

  return candidates;
};

const apiBases = buildApiBaseCandidates(rawApiBase);

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

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
    const path = parsed.pathname.replace(/\/+$/g, '');
    const lowerPath = path.toLowerCase();

    if (!path || path === '/') {
      parsed.pathname = '/api';
      add(parsed.toString());
      return candidates;
    }

    if (lowerPath.endsWith('/api')) {
      const withoutApiPath = path.slice(0, -4) || '/';
      parsed.pathname = withoutApiPath;
      add(parsed.toString());
      return candidates;
    }

    if (!lowerPath.endsWith('/api')) {
      if (lowerPath.includes('/api/')) {
        parsed.pathname = path.slice(0, lowerPath.indexOf('/api/') + 4);
        add(parsed.toString());
      }

      parsed.pathname = `${path}/api`;
      add(parsed.toString());
    }
  } catch {
    // keep raw candidate for non-standard URL inputs
  }

  return candidates;
};

const apiBases = buildApiBaseCandidates(rawApiBase);

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
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

    try {
      const res = await fetchWithTimeout(url, { headers: buildHeaders() });
      if (res.ok) {
        return res.json();
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
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        lastError = new Error(
          `Payload API request timed out after ${requestTimeoutMs}ms for ${url}`,
        );
      } else {
        const message = error instanceof Error ? error.message : String(error);
        lastError = new Error(`Payload API request failed for ${url} | ${message}`);
      }
    }
  }

  if (lastError) {
    throw new Error(
      `${lastError.message}. Tried candidates: ${attemptedURLs.join(', ')}`,
    );
  }

  throw new Error('Payload API request failed before receiving a response.');
};

const fetchPage = async (page) => {
  const qs = new URLSearchParams();
  qs.set('limit', String(pageSize));
  qs.set('page', String(page));
  qs.set('depth', String(depth));
  return fetchPayloadJSON('/articles', qs);
};

const normalizeDate = (doc) =>
  doc?.date || doc?.modified || doc?.publishedAt || doc?.createdAt || null;

const normalizeAuthor = (value) => {
  if (!value) return null;
  if (typeof value === 'string' || typeof value === 'number') {
    return { id: value };
  }

  if (typeof value === 'object') {
    const id = value?.id || value?._id || null;
    const name = value?.name || value?.fullName || value?.displayName || null;
    const slug = value?.slug || null;
    const email = value?.email || null;
    return { id, name, slug, email };
  }

  return null;
};

const normalizeTaxonomyItems = (items) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((entry) => {
      if (!entry) return null;

      if (typeof entry === 'string' || typeof entry === 'number') {
        return { id: entry, name: null, slug: null };
      }

      if (typeof entry === 'object') {
        return {
          id: entry?.id || entry?._id || null,
          name: entry?.name || null,
          slug: entry?.slug || null,
        };
      }

      return null;
    })
    .filter(Boolean);
};

const toAbsoluteUrl = (value, apiBase) => {
  const input = toPlainString(value).trim();
  if (!input) return '';
  if (/^https?:\/\//i.test(input)) return input;

  try {
    return new URL(input, `${apiBase}/`).toString();
  } catch {
    return input;
  }
};

const normalizeFeaturedImage = (doc, apiBase) => {
  const featuredImage = doc?.featured_image || doc?.featuredImage || null;
  const featuredMedia = doc?.featuredMedia || null;

  if (featuredImage && typeof featuredImage === 'object') {
    const url = toAbsoluteUrl(featuredImage?.url || featuredImage?.src || '', apiBase);
    if (url || featuredImage?.id || featuredImage?.width || featuredImage?.height) {
      return {
        id: featuredImage?.id || featuredImage?._id || null,
        url,
        width: featuredImage?.width || null,
        height: featuredImage?.height || null,
        alt: featuredImage?.alt || '',
      };
    }
  }

  if (featuredMedia && typeof featuredMedia === 'object') {
    return {
      id: featuredMedia?.id || featuredMedia?._id || null,
      url: toAbsoluteUrl(featuredMedia?.url || featuredMedia?.thumbnailURL || '', apiBase),
      width: featuredMedia?.width || null,
      height: featuredMedia?.height || null,
      alt: featuredMedia?.alt || '',
    };
  }

  if (typeof doc?.featured_img_url === 'string' && doc.featured_img_url.trim()) {
    return {
      id: null,
      url: toAbsoluteUrl(doc.featured_img_url, apiBase),
      width: null,
      height: null,
      alt: '',
    };
  }

  return null;
};

const toLegacyPreparedArticle = (doc, apiBase) => ({
  _id: doc?._id || doc?.id || null,
  slug: normalizeSlug(typeof doc?.slug === 'string' ? doc.slug : doc?.slug?.current),
  lang: normalizeLang(doc?.lang || doc?.language || doc?.locale),
  title: toPlainString(doc?.title),
  content: toPlainString(doc?.content ?? doc?.contentV2 ?? doc?.body ?? ''),
  excerpt: toPlainString(doc?.excerpt ?? ''),
  date: normalizeDate(doc),
  author: normalizeAuthor(doc?.author),
  categories: normalizeTaxonomyItems(doc?.categories),
  tags: normalizeTaxonomyItems(doc?.tags),
  featured_image: normalizeFeaturedImage(doc, apiBase),
});

const dedupeByLangAndSlug = (items) => {
  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    const slug = normalizeSlug(item?.slug);
    const lang = normalizeLang(item?.lang || item?.language || item?.locale);
    const key = `${lang}::${slug}`;
    if (!slug || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
};

const main = async () => {
  if (!apiBases.length) {
    console.error('ERROR: PAYLOAD_API_URL not set.');
    process.exit(1);
  }

  console.log(
    `Refreshing prepared-articles.json from Payload API... [${apiBases.join(', ')}], timeout=${requestTimeoutMs}ms`,
  );

  let page = 1;
  let totalPages = 0;
  const allDocs = [];

  while (true) {
    const data = await fetchPage(page);
    const docs = Array.isArray(data?.docs) ? data.docs : Array.isArray(data) ? data : [];
    if (!docs.length) break;

    allDocs.push(...docs.map(ensureIds));

    totalPages = Number(data?.totalPages) || totalPages;
    if (totalPages) {
      console.log(`Fetched page ${page}/${totalPages} (${allDocs.length} articles so far)`);
    } else {
      console.log(`Fetched page ${page} (${allDocs.length} articles so far)`);
    }
    if (totalPages && page >= totalPages) break;
    if (limit && allDocs.length >= limit) break;
    if (docs.length < pageSize) break;

    page += 1;
  }

  const output = limit ? allDocs.slice(0, limit) : allDocs;
  const legacyPrepared = output.map((doc) => toLegacyPreparedArticle(doc, apiBases[0]));
  const deduped = dedupeByLangAndSlug(legacyPrepared);

  fs.writeFileSync(preparedPath, JSON.stringify(deduped, null, 2));
  console.log(`Wrote ${deduped.length} articles to prepared-articles.json`);
};

main().catch((error) => {
  console.error('ERROR: Failed to refresh prepared-articles.json:', error);
  process.exit(1);
});
