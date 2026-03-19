import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), 'payload-admin', '.env') });

const preparedPath = path.join(process.cwd(), 'prepared-articles.json');
const backupDir = path.join(process.cwd(), 'tmp');

const mongoUrl = process.env.DATABASE_URL;
const rawApiBase =
  process.env.PAYLOAD_API_URL ||
  process.env.PUBLIC_PAYLOAD_API_URL ||
  process.env.PAYLOAD_URL ||
  'http://127.0.0.1:3000/api';
const apiToken =
  process.env.PAYLOAD_API_TOKEN ||
  process.env.PAYLOAD_TOKEN ||
  process.env.PAYLOAD_AUTH_TOKEN;

const migrationStatus = process.env.MIGRATION_STATUS || 'editor-migrated-single';
const chunkSize = Math.max(1, Number(process.env.SYNC_PREPARED_CHUNK_SIZE) || 100);
const concurrency = Math.max(1, Number(process.env.SYNC_PREPARED_CONCURRENCY) || 6);
const requestTimeoutMs = Math.max(
  5000,
  Number(process.env.PAYLOAD_FETCH_TIMEOUT_MS) || 30000,
);

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
    // keep raw candidate for non-standard URL values
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
        return await res.json();
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

const normalizeSlug = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^\/+|\/+$/g, '');
};

const normalizeId = (value) => (value ? String(value).trim() : '');

const getItemId = (item) =>
  normalizeId(item?._id || item?.id || item?.doc?._id || item?.doc?.id || '');

const getItemSlug = (item) => {
  if (!item) return '';
  if (typeof item.slug === 'string') return normalizeSlug(item.slug);
  if (item.slug?.current) return normalizeSlug(item.slug.current);
  return '';
};

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

const upsertArticle = (items, article) => {
  const normalized = ensureIds(article);
  const articleId = getItemId(normalized);
  const articleSlug = getItemSlug(normalized);

  let index = -1;
  if (articleId) {
    index = items.findIndex((item) => getItemId(item) === articleId);
  }
  if (index === -1 && articleSlug) {
    index = items.findIndex((item) => getItemSlug(item) === articleSlug);
  }

  if (index >= 0) {
    items[index] = normalized;
  } else {
    items.push(normalized);
  }
};

const dedupeByIdentity = (items) => {
  const deduped = [];
  const seenIds = new Set();
  const seenSlugs = new Set();

  for (const item of items) {
    const itemId = getItemId(item);
    const itemSlug = getItemSlug(item);
    if (itemId && seenIds.has(itemId)) continue;
    if (itemSlug && seenSlugs.has(itemSlug)) continue;
    if (itemId) seenIds.add(itemId);
    if (itemSlug) seenSlugs.add(itemSlug);
    deduped.push(item);
  }

  return deduped;
};

const fetchArticleById = async (id) => {
  const qs = new URLSearchParams();
  qs.set('depth', '2');
  return fetchPayloadJSON(`/articles/${encodeURIComponent(id)}`, qs);
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

const createBackup = () => {
  if (!fs.existsSync(preparedPath)) return null;
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `prepared-articles-sync-backup-${stamp}.json`);
  fs.copyFileSync(preparedPath, backupPath);
  return backupPath;
};

const chunkItems = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const fetchIdsFromMongo = async () => {
  if (!mongoUrl) {
    throw new Error('DATABASE_URL not set.');
  }

  const client = new MongoClient(mongoUrl);
  try {
    await client.connect();
    const dbName = new URL(mongoUrl).pathname.replace(/^\//, '') || 'lcdb';
    const db = client.db(dbName);
    const docs = await db
      .collection('articles')
      .find({ migrationStatus })
      .project({ _id: 1 })
      .toArray();

    return docs.map((doc) => normalizeId(doc?._id)).filter(Boolean);
  } finally {
    await client.close();
  }
};

const runPool = async (items, worker, maxConcurrency) => {
  const results = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(maxConcurrency, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
};

const main = async () => {
  if (!apiBases.length) {
    throw new Error('No Payload API base configured.');
  }

  console.log(`API candidates: ${apiBases.join(', ')}`);
  console.log(`Loading migrated article IDs with migrationStatus=${migrationStatus}...`);

  const ids = await fetchIdsFromMongo();
  if (!ids.length) {
    console.log('No migrated article IDs found. Nothing to update.');
    return;
  }

  console.log(`Found ${ids.length} migrated articles.`);
  const backupPath = createBackup();
  if (backupPath) {
    console.log(`Backup created: ${backupPath}`);
  }

  let preparedArticles = loadPreparedArticles();
  const chunks = chunkItems(ids, chunkSize);
  let updatedCount = 0;
  const failures = [];

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    console.log(
      `Syncing chunk ${i + 1}/${chunks.length} (${chunk.length} articles, updated=${updatedCount})...`,
    );

    const docs = await runPool(
      chunk,
      async (id) => {
        try {
          return { id, article: ensureIds(await fetchArticleById(id)) };
        } catch (error) {
          return {
            id,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
      concurrency,
    );

    for (const result of docs) {
      if (result?.article) {
        upsertArticle(preparedArticles, result.article);
        updatedCount += 1;
      } else if (result?.error) {
        failures.push({ id: result.id, error: result.error });
      }
    }

    preparedArticles = dedupeByIdentity(preparedArticles);
    writePreparedArticles(preparedArticles);
  }

  console.log(
    `Prepared snapshot sync complete. updated=${updatedCount}, failed=${failures.length}, total=${preparedArticles.length}`,
  );

  if (failures.length) {
    const failurePath = path.join(
      backupDir,
      `prepared-articles-sync-failures-${Date.now()}.json`,
    );
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(failurePath, JSON.stringify(failures, null, 2));
    console.log(`Failure log written: ${failurePath}`);
  }
};

main().catch((error) => {
  console.error('ERROR: Failed to sync migrated articles into prepared-articles.json:', error);
  process.exit(1);
});
