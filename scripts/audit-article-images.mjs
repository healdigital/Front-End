import fs from 'node:fs';
import path from 'node:path';
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

const ROOT = process.cwd();
const ARTICLES_DIR = path.join(ROOT, 'All Articles');
const TMP_DIR = path.join(ROOT, 'tmp');
const SPACES_BUCKET = process.env.SPACES_BUCKET || 'lcdb';
const SPACES_REGION = process.env.SPACES_REGION || 'fra1';
const SPACES_ENDPOINT =
  process.env.SPACES_ENDPOINT || `https://${SPACES_REGION}.digitaloceanspaces.com`;

const WP_IMAGE_URL_PATTERN =
  /^(.+?)(\.(?:jpe?g|png|webp|avif|gif))(?:\?([^#]+))?(?:#(.+))?$/i;
const COMMON_WP_VARIANTS = [
  '1920x2468',
  '1593x2048',
  '1536x2048',
  '797x1024',
  '768x1024',
  '585x585',
  '587x587',
  '500x500',
];

const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Safari/537.36',
  Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
};

function replaceCdnUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return url
    .replace(/^https?:\/\/cdn\.lacuisinedebernard\.com\//i, 'https://lcdb.fra1.digitaloceanspaces.com/')
    .replace(
      /^https?:\/\/(?:www\.)?lacuisinedebernard\.com\/wp-content\/uploads\//i,
      'https://lcdb.fra1.digitaloceanspaces.com/wp-content/uploads/',
    );
}

function splitWpUploadUrl(url) {
  const normalized = replaceCdnUrl(url);
  if (!/\/wp-content\/uploads\//i.test(normalized)) return null;
  const match = normalized.match(WP_IMAGE_URL_PATTERN);
  if (!match) return null;
  return {
    normalized,
    base: match[1],
    ext: match[2],
    query: match[3] ? `?${match[3]}` : '',
    hash: match[4] ? `#${match[4]}` : '',
  };
}

function normalizeWpUploadBase(base) {
  return base
    .replace(/-(?:\d+)(?:x|X|\*|Ã—)(?:\d+)-scaled$/i, '')
    .replace(/-(?:\d+)(?:x|X|\*|Ã—)(?:\d+)$/i, '')
    .replace(/-scaled$/i, '')
    .replace(/\/$/, '');
}

function buildFromParts(base, ext, query = '', hash = '') {
  return `${base}${ext}${query}${hash}`;
}

function buildWordPressImageFallbackCandidates(url) {
  if (!url || typeof url !== 'string') return [];
  const parts = splitWpUploadUrl(url);
  if (!parts) return [replaceCdnUrl(url)];

  const strippedBase = normalizeWpUploadBase(parts.base);
  const candidates = new Set();
  candidates.add(parts.normalized);
  candidates.add(buildFromParts(strippedBase, parts.ext, parts.query, parts.hash));

  for (const variant of COMMON_WP_VARIANTS) {
    candidates.add(buildFromParts(`${strippedBase}-${variant}`, parts.ext, parts.query, parts.hash));
  }

  return Array.from(candidates).filter(Boolean);
}

function toObjectKey(url) {
  const normalized = replaceCdnUrl(url);
  try {
    const parsed = new URL(normalized);
    return parsed.pathname.replace(/^\/+/, '');
  } catch {
    return '';
  }
}

function extractUrlsFromString(value) {
  if (!value || typeof value !== 'string') return [];
  const found = new Set();
  const regex =
    /https?:\/\/(?:cdn\.lacuisinedebernard\.com|(?:www\.)?lacuisinedebernard\.com)\/wp-content\/uploads\/[^"')\s<]+/gi;
  for (const match of value.matchAll(regex)) {
    found.add(match[0]);
  }
  return Array.from(found);
}

function scanNodeForUrls(node, found) {
  if (!node) return;
  if (typeof node === 'string') {
    for (const url of extractUrlsFromString(node)) found.add(url);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) scanNodeForUrls(item, found);
    return;
  }
  if (typeof node === 'object') {
    for (const value of Object.values(node)) scanNodeForUrls(value, found);
  }
}

function collectArticleImages(article, sourceTag) {
  const found = new Set();
  scanNodeForUrls(article, found);
  return Array.from(found).map((url) => ({
    articleId: article.id || article._id || null,
    slug: article.slug || null,
    title: article.title || article.post_title || null,
    source: sourceTag,
    originalUrl: url,
  }));
}

async function mapWithConcurrency(items, concurrency, task) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (true) {
      const current = index;
      index += 1;
      if (current >= items.length) return;
      results[current] = await task(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  return results;
}

function writeJson(fileName, data) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(path.join(TMP_DIR, fileName), JSON.stringify(data, null, 2));
}

function uniqueBy(items, keyFn, mapFn = (item) => item) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, mapFn(item));
  }
  return Array.from(map.values());
}

function loadExportRecords() {
  const records = [];
  const files = fs.readdirSync(ARTICLES_DIR).filter((file) => file.endsWith('.json'));

  for (const file of files) {
    const fullPath = path.join(ARTICLES_DIR, file);
    const raw = fs.readFileSync(fullPath, 'utf8');
    const json = JSON.parse(raw);

    if (Array.isArray(json)) {
      for (const article of json) records.push(...collectArticleImages(article, file));
      continue;
    }

    if (Array.isArray(json.posts)) {
      for (const article of json.posts) records.push(...collectArticleImages(article, file));
    }
  }

  return records;
}

function dedupeRecords(records) {
  const map = new Map();

  for (const record of records) {
    const key = `${record.slug || record.articleId || 'unknown'}|${record.originalUrl}`;
    const existing = map.get(key);
    if (existing) {
      existing.sources.add(record.source);
      continue;
    }
    map.set(key, {
      ...record,
      sources: new Set([record.source]),
    });
  }

  return Array.from(map.values()).map((record) => ({
    ...record,
    sources: Array.from(record.sources),
  }));
}

async function auditRecord(record) {
  const candidates = buildWordPressImageFallbackCandidates(record.originalUrl);
  const normalizedOriginalUrl = candidates[0] || replaceCdnUrl(record.originalUrl);
  const originalKey = toObjectKey(normalizedOriginalUrl);
  const originalExists = objectKeySet.has(originalKey);

  if (originalExists) {
    return {
      ...record,
      normalizedOriginalUrl,
      fallbackCandidates: candidates.slice(1),
      workingUrl: normalizedOriginalUrl,
      classification: 'working-direct',
      originalCheck: { ok: true, status: 200, method: 'LIST', objectKey: originalKey },
    };
  }

  for (const fallbackUrl of candidates.slice(1)) {
    const fallbackKey = toObjectKey(fallbackUrl);
    if (objectKeySet.has(fallbackKey)) {
      return {
        ...record,
        normalizedOriginalUrl,
        fallbackCandidates: candidates.slice(1),
        workingUrl: fallbackUrl,
        classification: 'working-via-fallback',
        originalCheck: { ok: false, status: 404, method: 'LIST', objectKey: originalKey },
        fallbackCheck: { ok: true, status: 200, method: 'LIST', objectKey: fallbackKey },
      };
    }
  }

  return {
    ...record,
    normalizedOriginalUrl,
    fallbackCandidates: candidates.slice(1),
    workingUrl: null,
    classification: 'broken',
    originalCheck: { ok: false, status: 404, method: 'LIST', objectKey: originalKey },
  };
}

const objectKeySet = new Set();

async function listBucketKeys() {
  const client = new S3Client({
    region: SPACES_REGION,
    endpoint: SPACES_ENDPOINT,
    forcePathStyle: false,
    credentials: {
      accessKeyId: process.env.SPACES_ACCESS_KEY_ID,
      secretAccessKey: process.env.SPACES_SECRET_ACCESS_KEY,
    },
  });

  let continuationToken = undefined;
  let batchCount = 0;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: SPACES_BUCKET,
        Prefix: 'wp-content/uploads/',
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }),
    );

    for (const object of response.Contents || []) {
      if (object.Key) objectKeySet.add(object.Key);
    }

    batchCount += 1;
    if (batchCount % 25 === 0) {
      console.log(`[AUDIT] Listed ${objectKeySet.size} bucket keys so far...`);
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);
}

async function main() {
  const concurrencyArg = process.argv.find((arg) => arg.startsWith('--concurrency='));
  const concurrency = concurrencyArg ? Number(concurrencyArg.split('=')[1]) || 8 : 8;
  const summaryOnly = process.argv.includes('--summary-only');

  console.log('[AUDIT] Loading article exports...');
  const rawRecords = loadExportRecords();
  const records = dedupeRecords(rawRecords);
  console.log(`[AUDIT] Found ${rawRecords.length} image references (${records.length} unique article-image pairs).`);

  if (!process.env.SPACES_ACCESS_KEY_ID || !process.env.SPACES_SECRET_ACCESS_KEY) {
    throw new Error('SPACES_ACCESS_KEY_ID and SPACES_SECRET_ACCESS_KEY are required.');
  }

  console.log('[AUDIT] Listing existing Spaces objects...');
  await listBucketKeys();
  console.log(`[AUDIT] Existing bucket keys loaded: ${objectKeySet.size}`);

  const uniqueOriginalUrls = Array.from(new Set(records.map((record) => record.originalUrl)));
  console.log(`[AUDIT] Unique original URLs to test: ${uniqueOriginalUrls.length}`);

  let completed = 0;
  const urlAuditEntries = await mapWithConcurrency(uniqueOriginalUrls, concurrency, async (originalUrl) => {
    const result = await auditRecord({ originalUrl });
    completed += 1;
    if (completed % 250 === 0 || completed === uniqueOriginalUrls.length) {
      console.log(`[AUDIT] Progress ${completed}/${uniqueOriginalUrls.length}`);
    }
    return result;
  });

  const auditByUrl = new Map(urlAuditEntries.map((entry) => [entry.originalUrl, entry]));
  const audited = records.map((record) => {
    const audit = auditByUrl.get(record.originalUrl);
    return {
      ...record,
      normalizedOriginalUrl: audit.normalizedOriginalUrl,
      fallbackCandidates: audit.fallbackCandidates,
      workingUrl: audit.workingUrl,
      classification: audit.classification,
      originalCheck: audit.originalCheck,
      fallbackCheck: audit.fallbackCheck,
    };
  });

  const workingDirect = audited.filter((item) => item.classification === 'working-direct');
  const fallbackWorking = audited.filter((item) => item.classification === 'working-via-fallback');
  const broken = audited.filter((item) => item.classification === 'broken');

  if (!summaryOnly) {
    writeJson('working-direct-images.json', workingDirect);
    writeJson('fallback-images.json', fallbackWorking);
    writeJson('broken-images.json', broken);
  }
  writeJson(
    'unique-working-direct-images.json',
    uniqueBy(workingDirect, (item) => item.originalUrl, (item) => ({
      originalUrl: item.originalUrl,
      normalizedOriginalUrl: item.normalizedOriginalUrl,
      slug: item.slug,
      title: item.title,
    })),
  );
  writeJson(
    'unique-fallback-image-map.json',
    uniqueBy(fallbackWorking, (item) => item.originalUrl, (item) => ({
      originalUrl: item.originalUrl,
      normalizedOriginalUrl: item.normalizedOriginalUrl,
      workingFallbackUrl: item.workingUrl,
      slug: item.slug,
      title: item.title,
    })),
  );
  writeJson(
    'unique-broken-images.json',
    uniqueBy(broken, (item) => item.originalUrl, (item) => ({
      originalUrl: item.originalUrl,
      normalizedOriginalUrl: item.normalizedOriginalUrl,
      slug: item.slug,
      title: item.title,
      fallbackCandidates: item.fallbackCandidates,
    })),
  );
  writeJson('image-audit-summary.json', {
    generatedAt: new Date().toISOString(),
    totalImageReferences: rawRecords.length,
    uniqueArticleImagePairs: records.length,
    existingBucketKeys: objectKeySet.size,
    workingDirect: workingDirect.length,
    fallbackWorking: fallbackWorking.length,
    broken: broken.length,
    uniqueUrlsChecked: uniqueOriginalUrls.length,
    uniqueWorkingDirect: uniqueBy(workingDirect, (item) => item.originalUrl).length,
    uniqueFallbackWorking: uniqueBy(fallbackWorking, (item) => item.originalUrl).length,
    uniqueBroken: uniqueBy(broken, (item) => item.originalUrl).length,
  });

  console.log('[AUDIT] Summary');
  console.log(`  working direct   : ${workingDirect.length}`);
  console.log(`  working fallback : ${fallbackWorking.length}`);
  console.log(`  broken           : ${broken.length}`);
  console.log(`  unique URLs      : ${uniqueOriginalUrls.length}`);
  console.log(`[AUDIT] Reports written to ${TMP_DIR}`);
}

main().catch((error) => {
  console.error('[AUDIT] Failed:', error);
  process.exit(1);
});
