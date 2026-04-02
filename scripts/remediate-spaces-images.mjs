import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  CopyObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, 'tmp');
const FALLBACK_FILE = path.join(TMP_DIR, 'unique-fallback-image-map.json');
const BROKEN_FILE = path.join(TMP_DIR, 'unique-broken-images.json');
const REPORT_FILE = path.join(TMP_DIR, 'spaces-remediation-report.json');
const DEFAULT_BATCH_REPORT = path.join(TMP_DIR, 'spaces-remediation-batch-report.json');

const SPACES_BUCKET = process.env.SPACES_BUCKET || 'lcdb';
const SPACES_REGION = process.env.SPACES_REGION || 'fra1';
const SPACES_ENDPOINT =
  process.env.SPACES_ENDPOINT || `https://${SPACES_REGION}.digitaloceanspaces.com`;

const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Safari/537.36',
  Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
};

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.split('=');
    return [key, value];
  }),
);

const limit = Number.parseInt(args.get('--limit') || '0', 10);
const offset = Number.parseInt(args.get('--offset') || '0', 10);
const concurrency = Number.parseInt(args.get('--concurrency') || '6', 10);
const fallbackOnly = args.has('--fallback-only');
const brokenOnly = args.has('--broken-only');
const dryRun = args.has('--dry-run');

if (!process.env.SPACES_ACCESS_KEY_ID || !process.env.SPACES_SECRET_ACCESS_KEY) {
  console.error('Missing SPACES_ACCESS_KEY_ID or SPACES_SECRET_ACCESS_KEY.');
  process.exit(1);
}

const s3 = new S3Client({
  region: SPACES_REGION,
  endpoint: SPACES_ENDPOINT,
  credentials: {
    accessKeyId: process.env.SPACES_ACCESS_KEY_ID,
    secretAccessKey: process.env.SPACES_SECRET_ACCESS_KEY,
  },
});

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function toObjectKey(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  } catch {
    return '';
  }
}

function stripSizeSuffixFromKey(key) {
  return key
    .replace(/-(?:\d+)(?:x|X|\*|Ã—)(?:\d+)-scaled(?=\.[a-z0-9]+$)/i, '')
    .replace(/-(?:\d+)(?:x|X|\*|Ã—)(?:\d+)(?=\.[a-z0-9]+$)/i, '')
    .replace(/-scaled(?=\.[a-z0-9]+$)/i, '');
}

function objectKeyToWpUrl(key) {
  return `https://lacuisinedebernard.com/${key}`;
}

function objectKeyToCdnUrl(key) {
  return `https://cdn.lacuisinedebernard.com/${key}`;
}

function encodeCopySource(bucket, key) {
  return `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

async function headObject(key) {
  try {
    await s3.send(
      new HeadObjectCommand({
        Bucket: SPACES_BUCKET,
        Key: key,
      }),
    );
    return true;
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    if (status === 404 || error?.name === 'NotFound') return false;
    throw error;
  }
}

async function copyObject(sourceKey, targetKey) {
  await s3.send(
    new CopyObjectCommand({
      Bucket: SPACES_BUCKET,
      Key: targetKey,
      CopySource: encodeCopySource(SPACES_BUCKET, sourceKey),
      ACL: 'public-read',
      CacheControl: 'public, max-age=31536000, immutable',
      MetadataDirective: 'COPY',
    }),
  );
}

async function fetchSource(url) {
  try {
    const response = await fetch(url, {
      headers: REQUEST_HEADERS,
      redirect: 'follow',
    });

    if (!response.ok) {
      if (response.body) {
        try {
          response.body.cancel();
        } catch {}
      }
      return {
        ok: false,
        status: response.status,
      };
    }

    const body = Buffer.from(await response.arrayBuffer());
    return {
      ok: true,
      status: response.status,
      body,
      contentType: response.headers.get('content-type') || 'application/octet-stream',
      cacheControl: response.headers.get('cache-control') || 'public, max-age=31536000, immutable',
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function uploadObject(targetKey, payload) {
  await s3.send(
    new PutObjectCommand({
      Bucket: SPACES_BUCKET,
      Key: targetKey,
      Body: payload.body,
      ContentType: payload.contentType,
      CacheControl: payload.cacheControl,
      ACL: 'public-read',
    }),
  );
}

function buildBrokenSourceCandidates(entry) {
  const urls = new Set();

  const seedUrls = [entry.originalUrl, entry.normalizedOriginalUrl, ...(entry.fallbackCandidates || [])];

  for (const rawUrl of seedUrls) {
    if (!rawUrl || typeof rawUrl !== 'string') continue;

    if (!rawUrl.includes('digitaloceanspaces.com')) {
      urls.add(rawUrl);
    }

    const key = toObjectKey(rawUrl);
    if (!key) continue;

    urls.add(objectKeyToWpUrl(key));
    urls.add(objectKeyToCdnUrl(key));

    const strippedKey = stripSizeSuffixFromKey(key);
    if (strippedKey && strippedKey !== key) {
      urls.add(objectKeyToWpUrl(strippedKey));
      urls.add(objectKeyToCdnUrl(strippedKey));
    }
  }

  return Array.from(urls);
}

async function mapWithConcurrency(items, task, size) {
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

  await Promise.all(Array.from({ length: Math.max(1, size) }, () => worker()));
  return results;
}

async function remediateFallback(entry) {
  const targetKey = toObjectKey(entry.normalizedOriginalUrl);
  const sourceKey = toObjectKey(entry.workingFallbackUrl);

  if (!targetKey || !sourceKey) {
    return { type: 'fallback', status: 'failed', entry, reason: 'missing_object_key' };
  }

  const exists = await headObject(targetKey);
  if (exists) {
    return { type: 'fallback', status: 'already-exists', entry, targetKey };
  }

  if (dryRun) {
    return { type: 'fallback', status: 'dry-run', entry, targetKey, sourceKey };
  }

  await copyObject(sourceKey, targetKey);
  return { type: 'fallback', status: 'copied', entry, targetKey, sourceKey };
}

async function remediateBroken(entry) {
  const targetKey = toObjectKey(entry.normalizedOriginalUrl);
  if (!targetKey) {
    return { type: 'broken', status: 'failed', entry, reason: 'missing_target_key' };
  }

  const exists = await headObject(targetKey);
  if (exists) {
    return { type: 'broken', status: 'already-exists', entry, targetKey };
  }

  const candidates = buildBrokenSourceCandidates(entry);
  const attempts = [];

  for (const candidate of candidates) {
    const fetched = await fetchSource(candidate);
    attempts.push({ candidate, status: fetched.status, error: fetched.error || null });

    if (!fetched.ok) continue;

    if (dryRun) {
      return {
        type: 'broken',
        status: 'dry-run',
        entry,
        targetKey,
        sourceUrl: candidate,
        attempts,
      };
    }

    await uploadObject(targetKey, fetched);
    return {
      type: 'broken',
      status: 'uploaded',
      entry,
      targetKey,
      sourceUrl: candidate,
      bytes: fetched.body.byteLength,
      attempts,
    };
  }

  return {
    type: 'broken',
    status: 'failed',
    entry,
    targetKey,
    attempts,
    reason: 'no_source_candidate_worked',
  };
}

async function main() {
  const reportFile = args.get('--report') || DEFAULT_BATCH_REPORT;
  const report = {
    generatedAt: new Date().toISOString(),
    dryRun,
    limit,
    offset,
    concurrency,
    fallback: { total: 0, copied: 0, exists: 0, failed: 0, dryRun: 0 },
    broken: { total: 0, uploaded: 0, exists: 0, failed: 0, dryRun: 0 },
    results: [],
  };

  const fallbackEntries = fallbackOnly ? loadJson(FALLBACK_FILE) : brokenOnly ? [] : loadJson(FALLBACK_FILE);
  const brokenEntries = brokenOnly ? loadJson(BROKEN_FILE) : fallbackOnly ? [] : loadJson(BROKEN_FILE);

  const sliceEntries = (entries) => {
    const sliced = entries.slice(offset);
    return limit > 0 ? sliced.slice(0, limit) : sliced;
  };

  const selectedFallback = sliceEntries(fallbackEntries);
  const selectedBroken = sliceEntries(brokenEntries);

  report.fallback.total = selectedFallback.length;
  report.broken.total = selectedBroken.length;

  console.log(`[REMEDIATE] Fallback entries: ${selectedFallback.length}`);
  console.log(`[REMEDIATE] Broken entries: ${selectedBroken.length}`);

  let processed = 0;
  const total = selectedFallback.length + selectedBroken.length;
  const partialResults = [];

  const tasks = [
    ...selectedFallback.map((entry) => ({ kind: 'fallback', entry })),
    ...selectedBroken.map((entry) => ({ kind: 'broken', entry })),
  ];

  const results = await mapWithConcurrency(
    tasks,
    async (task) => {
      const result =
        task.kind === 'fallback'
          ? await remediateFallback(task.entry)
          : await remediateBroken(task.entry);

      partialResults.push(result);
      processed += 1;
      if (processed % 100 === 0 || processed === total) {
        console.log(`[REMEDIATE] Progress ${processed}/${total}`);
        fs.writeFileSync(reportFile, JSON.stringify({ ...report, results: partialResults }, null, 2));
      }
      return result;
    },
    concurrency,
  );

  report.results = results;

  for (const result of results) {
    if (result.type === 'fallback') {
      if (result.status === 'copied') report.fallback.copied += 1;
      else if (result.status === 'already-exists') report.fallback.exists += 1;
      else if (result.status === 'dry-run') report.fallback.dryRun += 1;
      else report.fallback.failed += 1;
      continue;
    }

    if (result.status === 'uploaded') report.broken.uploaded += 1;
    else if (result.status === 'already-exists') report.broken.exists += 1;
    else if (result.status === 'dry-run') report.broken.dryRun += 1;
    else report.broken.failed += 1;
  }

  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  console.log(JSON.stringify({
    reportFile,
    fallback: report.fallback,
    broken: report.broken,
  }, null, 2));
}

main().catch((error) => {
  console.error('[REMEDIATE] Failed:', error);
  process.exit(1);
});
