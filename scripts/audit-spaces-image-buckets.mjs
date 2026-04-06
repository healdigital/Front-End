import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, 'tmp');
const ARTICLES_DIR = path.join(ROOT, 'All Articles');
const PREPARED_ARTICLES_FILE = path.join(ROOT, 'prepared-articles.json');
const SEARCH_INDEX_FILE = path.join(ROOT, 'public', 'search-index.json');
const HOME_RECIPES_INDEX_FILE = path.join(ROOT, 'public', 'home-recipes-index.json');

const SPACES_HOST = 'lcdb.fra1.digitaloceanspaces.com';
const SPACES_BUCKET = process.env.SPACES_BUCKET || 'lcdb';
const SPACES_REGION = process.env.SPACES_REGION || 'fra1';
const SPACES_ENDPOINT =
  process.env.SPACES_ENDPOINT || `https://${SPACES_REGION}.digitaloceanspaces.com`;

const SPACES_URL_REGEX =
  /https?:\/\/lcdb\.fra1\.digitaloceanspaces\.com\/wp-content\/uploads\/[^"')\s<]+/gi;
const EXPORT_URL_REGEX =
  /https?:\/\/(?:cdn\.lacuisinedebernard\.com|(?:www\.)?lacuisinedebernard\.com)\/wp-content\/uploads\/[^"')\s<]+/gi;

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.split('=');
    return [key, value];
  }),
);

const concurrency = Number.parseInt(args.get('--concurrency') || '8', 10);
const urlsFile = args.get('--urls-file');

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

const exportUrlIndex = new Map();
const normalizedExportUrlIndex = new Map();

function readIfExists(filePath) {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8');
}

function extractMatches(raw, regex) {
  return raw.match(regex) || [];
}

function basenameFromUrlOrKey(value) {
  if (!value || typeof value !== 'string') return '';
  try {
    const parsed = new URL(value);
    const pathname = decodeURIComponent(parsed.pathname);
    return pathname.split('/').pop() || '';
  } catch {
    const parts = value.split('/');
    return parts[parts.length - 1] || '';
  }
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
    .replace(/-(?:\d+)(?:x|X|\*)(?:\d+)-scaled(?=\.[a-z0-9]+$)/i, '')
    .replace(/-(?:\d+)(?:x|X|\*)(?:\d+)(?=\.[a-z0-9]+$)/i, '')
    .replace(/-scaled(?=\.[a-z0-9]+$)/i, '');
}

function decodeSafe(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function normalizeBasenameForMatching(text) {
  return decodeSafe(text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/e2809[89]/g, '')
    .replace(/e2809c|e2809d/g, '')
    .replace(/cc8[0-9a-f]/g, '')
    .replace(/c3[a-f0-9]{2}/g, '')
    .replace(/captur(?:ed?)?[^a-z0-9]*e[^a-z0-9]*cran/g, 'capturedecran')
    .replace(/capture[^a-z0-9]*de[^a-z0-9]*cran/g, 'capturedecran')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function objectKeyToWpUrl(key) {
  return `https://lacuisinedebernard.com/${key}`;
}

function objectKeyToCdnUrl(key) {
  return `https://cdn.lacuisinedebernard.com/${key}`;
}

function addExportUrl(match) {
  const basename = basenameFromUrlOrKey(match);
  if (!basename) return;

  const exactList = exportUrlIndex.get(basename) || [];
  if (!exactList.includes(match)) exactList.push(match);
  exportUrlIndex.set(basename, exactList);

  const normalizedBasename = normalizeBasenameForMatching(basename);
  if (!normalizedBasename) return;
  const normalizedList = normalizedExportUrlIndex.get(normalizedBasename) || [];
  if (!normalizedList.includes(match)) normalizedList.push(match);
  normalizedExportUrlIndex.set(normalizedBasename, normalizedList);
}

function buildExportUrlIndex() {
  const articleFiles = fs.existsSync(ARTICLES_DIR)
    ? fs.readdirSync(ARTICLES_DIR).filter((file) => file.endsWith('.json'))
    : [];

  for (const file of articleFiles) {
    const raw = fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf8');
    const matches = extractMatches(raw, EXPORT_URL_REGEX);
    for (const match of matches) addExportUrl(match);
  }

  for (const raw of [
    readIfExists(PREPARED_ARTICLES_FILE),
    readIfExists(SEARCH_INDEX_FILE),
    readIfExists(HOME_RECIPES_INDEX_FILE),
  ]) {
    const matches = extractMatches(raw, EXPORT_URL_REGEX);
    for (const match of matches) addExportUrl(match);
  }
}

function collectReferencedSpacesUrls() {
  const urls = new Set();
  const rawSources = [];

  if (fs.existsSync(ARTICLES_DIR)) {
    const articleFiles = fs.readdirSync(ARTICLES_DIR).filter((file) => file.endsWith('.json'));
    for (const file of articleFiles) {
      rawSources.push(fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf8'));
    }
  }

  rawSources.push(readIfExists(PREPARED_ARTICLES_FILE));
  rawSources.push(readIfExists(SEARCH_INDEX_FILE));
  rawSources.push(readIfExists(HOME_RECIPES_INDEX_FILE));

  for (const raw of rawSources) {
    const matches = extractMatches(raw, SPACES_URL_REGEX);
    for (const match of matches) urls.add(match);
  }

  return Array.from(urls);
}

function loadInputUrls() {
  if (!urlsFile) return collectReferencedSpacesUrls();
  const fullPath = path.isAbsolute(urlsFile) ? urlsFile : path.join(ROOT, urlsFile);
  return fs
    .readFileSync(fullPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function headSpacesKey(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: SPACES_BUCKET, Key: key }));
    return true;
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    if (status === 404 || error?.name === 'NotFound') return false;
    throw error;
  }
}

async function fetchHead(url) {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      redirect: 'follow',
    });
    return {
      ok: response.ok,
      status: response.status,
      url,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      url,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildSourceCandidates(spacesUrl) {
  const urls = new Set();
  const key = toObjectKey(spacesUrl);
  const exactBasename = basenameFromUrlOrKey(spacesUrl);
  const strippedBasename = basenameFromUrlOrKey(stripSizeSuffixFromKey(key));
  const normalizedBasenames = new Set(
    [exactBasename, strippedBasename].map((value) => normalizeBasenameForMatching(value)).filter(Boolean),
  );

  for (const basename of [exactBasename, strippedBasename]) {
    if (!basename) continue;
    const relatedUrls = exportUrlIndex.get(basename) || [];
    for (const relatedUrl of relatedUrls) urls.add(relatedUrl);
  }

  for (const normalizedBasename of normalizedBasenames) {
    const relatedUrls = normalizedExportUrlIndex.get(normalizedBasename) || [];
    for (const relatedUrl of relatedUrls) urls.add(relatedUrl);
  }

  urls.add(objectKeyToWpUrl(key));
  urls.add(objectKeyToCdnUrl(key));

  const strippedKey = stripSizeSuffixFromKey(key);
  if (strippedKey && strippedKey !== key) {
    urls.add(objectKeyToWpUrl(strippedKey));
    urls.add(objectKeyToCdnUrl(strippedKey));
  }

  return Array.from(urls);
}

async function classifyUrl(url) {
  const key = toObjectKey(url);
  const existsOnSpaces = await headSpacesKey(key);
  if (existsOnSpaces) {
    return {
      status: 'ok-on-spaces',
      url,
      key,
    };
  }

  const strippedKey = stripSizeSuffixFromKey(key);
  if (strippedKey && strippedKey !== key) {
    const baseExistsOnSpaces = await headSpacesKey(strippedKey);
    if (baseExistsOnSpaces) {
      return {
        status: 'recoverable-from-spaces-base',
        url,
        key,
        sourceKey: strippedKey,
      };
    }
  }

  const attempts = [];
  for (const candidate of buildSourceCandidates(url)) {
    const result = await fetchHead(candidate);
    attempts.push(result);

    if (result.status === 200) {
      return {
        status: 'recoverable-from-upstream',
        url,
        key,
        sourceUrl: candidate,
        attempts,
      };
    }

    if (result.status === 403) {
      return {
        status: 'upstream-forbidden',
        url,
        key,
        sourceUrl: candidate,
        attempts,
      };
    }
  }

  return {
    status: 'upstream-missing',
    url,
    key,
    attempts,
  };
}

async function mapWithConcurrency(items, size, task) {
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
  buildExportUrlIndex();
  const urls = loadInputUrls();

  let processed = 0;
  const results = await mapWithConcurrency(urls, concurrency, async (url) => {
    const result = await classifyUrl(url);
    processed += 1;
    if (processed % 250 === 0 || processed === urls.length) {
      console.log(`[AUDIT-SPACES] ${processed}/${urls.length}`);
    }
    return result;
  });

  const okOnSpaces = results.filter((item) => item.status === 'ok-on-spaces');
  const recoverable = results.filter(
    (item) => item.status === 'recoverable-from-spaces-base' || item.status === 'recoverable-from-upstream',
  );
  const upstreamForbidden = results.filter((item) => item.status === 'upstream-forbidden');
  const upstreamMissing = results.filter((item) => item.status === 'upstream-missing');
  const spacesBaseRecoverableUrls = recoverable
    .filter((item) => item.status === 'recoverable-from-spaces-base')
    .map((item) => item.url);

  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(path.join(TMP_DIR, 'spaces-images-ok-on-spaces.json'), JSON.stringify(okOnSpaces, null, 2));
  fs.writeFileSync(path.join(TMP_DIR, 'spaces-images-recoverable.json'), JSON.stringify(recoverable, null, 2));
  fs.writeFileSync(
    path.join(TMP_DIR, 'spaces-images-upstream-forbidden.json'),
    JSON.stringify(upstreamForbidden, null, 2),
  );
  fs.writeFileSync(path.join(TMP_DIR, 'spaces-images-upstream-missing.json'), JSON.stringify(upstreamMissing, null, 2));
  fs.writeFileSync(
    path.join(TMP_DIR, 'spaces-images-recoverable-from-spaces-base.txt'),
    spacesBaseRecoverableUrls.join('\n'),
  );
  fs.writeFileSync(
    path.join(TMP_DIR, 'spaces-images-buckets-summary.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalReferencedSpacesUrls: urls.length,
        okOnSpaces: okOnSpaces.length,
        recoverable: recoverable.length,
        recoverableFromSpacesBase: spacesBaseRecoverableUrls.length,
        recoverableFromUpstream: recoverable.filter((item) => item.status === 'recoverable-from-upstream').length,
        upstreamForbidden: upstreamForbidden.length,
        upstreamMissing: upstreamMissing.length,
      },
      null,
      2,
    ),
  );

  console.log(
    JSON.stringify(
      {
        totalReferencedSpacesUrls: urls.length,
        okOnSpaces: okOnSpaces.length,
        recoverable: recoverable.length,
        recoverableFromSpacesBase: spacesBaseRecoverableUrls.length,
        recoverableFromUpstream: recoverable.filter((item) => item.status === 'recoverable-from-upstream').length,
        upstreamForbidden: upstreamForbidden.length,
        upstreamMissing: upstreamMissing.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error('[AUDIT-SPACES] Failed:', error);
  process.exit(1);
});
