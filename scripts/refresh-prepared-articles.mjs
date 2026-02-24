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

const normalizeSlug = (value) =>
  typeof value === 'string' ? value.trim().replace(/^\/+|\/+$/g, '') : '';

const normalizeId = (value) => (value ? String(value).trim() : '');

const ensureIds = (doc) => {
  const existingId = doc?.id ?? doc?._id ?? doc?.doc?.id ?? doc?.doc?._id ?? '';
  const normalizedId = normalizeId(existingId);
  if (!normalizedId) return doc;
  return {
    ...doc,
    id: doc?.id || normalizedId,
    _id: doc?._id || normalizedId,
  };
};

const dedupeBySlug = (items) => {
  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    const slug = normalizeSlug(
      typeof item.slug === 'string' ? item.slug : item.slug?.current,
    );
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
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
    `Refreshing prepared-articles.json from Payload API... [${apiBases.join(', ')}]`,
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
    if (totalPages && page >= totalPages) break;
    if (limit && allDocs.length >= limit) break;
    if (docs.length < pageSize) break;

    page += 1;
  }

  const output = limit ? allDocs.slice(0, limit) : allDocs;
  const deduped = dedupeBySlug(output);

  fs.writeFileSync(preparedPath, JSON.stringify(deduped, null, 2));
  console.log(`Wrote ${deduped.length} articles to prepared-articles.json`);
};

main().catch((error) => {
  console.error('ERROR: Failed to refresh prepared-articles.json:', error);
  process.exit(1);
});
