import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  CopyObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, 'tmp');
const BROKEN_FILE = path.join(TMP_DIR, 'unique-broken-images.json');
const DEFAULT_REPORT = path.join(TMP_DIR, 'spaces-variant-backfill-report.json');

const SPACES_BUCKET = process.env.SPACES_BUCKET || 'lcdb';
const SPACES_REGION = process.env.SPACES_REGION || 'fra1';
const SPACES_ENDPOINT =
  process.env.SPACES_ENDPOINT || `https://${SPACES_REGION}.digitaloceanspaces.com`;

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.split('=');
    return [key, value];
  }),
);

const concurrency = Number.parseInt(args.get('--concurrency') || '10', 10);
const limit = Number.parseInt(args.get('--limit') || '0', 10);
const offset = Number.parseInt(args.get('--offset') || '0', 10);
const dryRun = args.has('--dry-run');
const reportFile = args.get('--report') || DEFAULT_REPORT;
const singleUrl = args.get('--url');

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

const allKeys = new Set();
const basenameIndex = new Map();
const strippedBasenameIndex = new Map();
const stemIndex = new Map();

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

function encodeCopySource(bucket, key) {
  return `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

function stripSizeSuffix(text) {
  return text
    .replace(/-(?:\d+)(?:x|X|\*|×)(?:\d+)-scaled(?=\.[a-z0-9]+$)/i, '')
    .replace(/-(?:\d+)(?:x|X|\*|×)(?:\d+)(?=\.[a-z0-9]+$)/i, '')
    .replace(/-scaled(?=\.[a-z0-9]+$)/i, '');
}

function stripSizeSuffixFromStem(text) {
  return text
    .replace(/-(?:\d+)(?:x|X|\*|×)(?:\d+)-scaled$/i, '')
    .replace(/-(?:\d+)(?:x|X|\*|×)(?:\d+)$/i, '')
    .replace(/-scaled$/i, '');
}

function splitDirAndFile(key) {
  const slashIndex = key.lastIndexOf('/');
  if (slashIndex === -1) return { dir: '', file: key };
  return {
    dir: key.slice(0, slashIndex + 1),
    file: key.slice(slashIndex + 1),
  };
}

function getBasename(key) {
  const { file } = splitDirAndFile(key);
  return file;
}

function getStem(fileName) {
  return fileName.replace(/\.[a-z0-9]+$/i, '');
}

function getExtension(fileName) {
  const match = fileName.match(/(\.[a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : '';
}

function getSizeFromStem(stem) {
  const match = stem.match(/-(\d+)(?:x|X|\*|×)(\d+)(?:-scaled)?$/i);
  if (!match) return null;
  return {
    width: Number.parseInt(match[1], 10),
    height: Number.parseInt(match[2], 10),
  };
}

function addToIndex(map, key, value) {
  const list = map.get(key) || [];
  list.push(value);
  map.set(key, list);
}

function indexKey(key) {
  allKeys.add(key);

  const basename = getBasename(key);
  const stem = getStem(basename);
  const strippedBasename = stripSizeSuffix(basename);
  const strippedStem = stripSizeSuffixFromStem(stem);

  addToIndex(basenameIndex, basename, key);
  addToIndex(strippedBasenameIndex, strippedBasename, key);
  addToIndex(stemIndex, strippedStem, key);
}

async function listBucketKeys() {
  let continuationToken;
  let page = 0;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: SPACES_BUCKET,
        Prefix: 'wp-content/uploads/',
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }),
    );

    for (const object of response.Contents || []) {
      if (object.Key) indexKey(object.Key);
    }

    page += 1;
    if (page % 25 === 0) {
      console.log(`[VARIANT] Indexed ${allKeys.size} bucket keys...`);
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);
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

function scoreCandidate(targetKey, sourceKey) {
  const { dir: targetDir, file: targetFile } = splitDirAndFile(targetKey);
  const { dir: sourceDir, file: sourceFile } = splitDirAndFile(sourceKey);

  const targetStem = getStem(targetFile);
  const sourceStem = getStem(sourceFile);
  const targetExt = getExtension(targetFile);
  const sourceExt = getExtension(sourceFile);
  const targetStrippedStem = stripSizeSuffixFromStem(targetStem);
  const sourceStrippedStem = stripSizeSuffixFromStem(sourceStem);
  const targetSize = getSizeFromStem(targetStem);
  const sourceSize = getSizeFromStem(sourceStem);

  let score = 0;

  if (sourceKey === stripSizeSuffix(targetKey)) score += 1000;
  if (targetDir === sourceDir) score += 300;
  if (targetExt === sourceExt) score += 100;
  if (targetStrippedStem === sourceStrippedStem) score += 200;
  if (!sourceSize) score += 50;
  if (sourceStem.includes('-scaled')) score += 25;

  if (targetSize && sourceSize) {
    const widthDiff = Math.abs(targetSize.width - sourceSize.width);
    const heightDiff = Math.abs(targetSize.height - sourceSize.height);
    score -= widthDiff + heightDiff;
  }

  return score;
}

function buildCandidateKeys(targetKey, entry) {
  const candidates = new Set();
  const strippedTargetKey = stripSizeSuffix(targetKey);
  const targetBasename = getBasename(targetKey);
  const strippedTargetBasename = stripSizeSuffix(targetBasename);
  const targetStem = getStem(targetBasename);
  const strippedTargetStem = stripSizeSuffixFromStem(targetStem);

  if (strippedTargetKey && strippedTargetKey !== targetKey) {
    candidates.add(strippedTargetKey);
  }

  for (const fallbackUrl of entry.fallbackCandidates || []) {
    const fallbackKey = toObjectKey(fallbackUrl);
    if (fallbackKey) candidates.add(fallbackKey);
  }

  for (const key of basenameIndex.get(targetBasename) || []) candidates.add(key);
  for (const key of strippedBasenameIndex.get(strippedTargetBasename) || []) candidates.add(key);
  for (const key of stemIndex.get(strippedTargetStem) || []) candidates.add(key);

  return Array.from(candidates)
    .filter((key) => key && key !== targetKey && allKeys.has(key))
    .sort((a, b) => scoreCandidate(targetKey, b) - scoreCandidate(targetKey, a));
}

async function remediateEntry(entry) {
  const targetKey = toObjectKey(entry.normalizedOriginalUrl || entry.url);
  if (!targetKey) {
    return { status: 'failed', reason: 'missing_target_key', entry };
  }

  if (allKeys.has(targetKey)) {
    return { status: 'already-exists', targetKey, entry };
  }

  const targetExists = await headObject(targetKey);
  if (targetExists) {
    allKeys.add(targetKey);
    return { status: 'already-exists', targetKey, entry };
  }

  const candidateKeys = buildCandidateKeys(targetKey, entry);

  if (candidateKeys.length === 0) {
    return { status: 'failed', reason: 'no_bucket_candidate', targetKey, entry };
  }

  const sourceKey = candidateKeys[0];

  if (dryRun) {
    return { status: 'dry-run', targetKey, sourceKey, entry };
  }

  await copyObject(sourceKey, targetKey);
  indexKey(targetKey);
  return { status: 'copied', targetKey, sourceKey, entry };
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

async function main() {
  const sourceEntries = singleUrl
    ? [{ url: singleUrl, normalizedOriginalUrl: singleUrl, fallbackCandidates: [] }]
    : loadJson(BROKEN_FILE).slice(offset, limit > 0 ? offset + limit : undefined);

  console.log('[VARIANT] Listing bucket keys...');
  await listBucketKeys();
  console.log(`[VARIANT] Indexed ${allKeys.size} existing bucket keys.`);
  console.log(`[VARIANT] Entries to process: ${sourceEntries.length}`);

  let processed = 0;
  const partialResults = [];
  const results = await mapWithConcurrency(
    sourceEntries,
    async (entry) => {
      const result = await remediateEntry(entry);
      partialResults.push(result);
      processed += 1;

      if (processed % 100 === 0 || processed === sourceEntries.length) {
        console.log(`[VARIANT] Progress ${processed}/${sourceEntries.length}`);
        fs.writeFileSync(
          reportFile,
          JSON.stringify(
            {
              generatedAt: new Date().toISOString(),
              dryRun,
              total: sourceEntries.length,
              processed,
              copied: partialResults.filter((item) => item.status === 'copied').length,
              exists: partialResults.filter((item) => item.status === 'already-exists').length,
              failed: partialResults.filter((item) => item.status === 'failed').length,
              dryRunMatches: partialResults.filter((item) => item.status === 'dry-run').length,
              results: partialResults,
            },
            null,
            2,
          ),
        );
      }

      return result;
    },
    concurrency,
  );

  const summary = {
    generatedAt: new Date().toISOString(),
    dryRun,
    total: sourceEntries.length,
    copied: results.filter((item) => item.status === 'copied').length,
    exists: results.filter((item) => item.status === 'already-exists').length,
    failed: results.filter((item) => item.status === 'failed').length,
    dryRunMatches: results.filter((item) => item.status === 'dry-run').length,
    results,
  };

  fs.writeFileSync(reportFile, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ reportFile, ...summary }, null, 2));
}

main().catch((error) => {
  console.error('[VARIANT] Failed:', error);
  process.exit(1);
});
