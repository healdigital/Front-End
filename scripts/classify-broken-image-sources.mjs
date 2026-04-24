import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, 'tmp');
const ARTICLES_DIR = path.join(ROOT, 'All Articles');
const PREPARED_ARTICLES_FILE = path.join(ROOT, 'prepared-articles.json');
const BROKEN_FILE = path.join(TMP_DIR, 'unique-broken-images.json');

const EXPORT_URL_REGEX =
  /https?:\/\/(?:cdn\.lacuisinedebernard\.com|(?:www\.)?lacuisinedebernard\.com)\/wp-content\/uploads\/[^"')\s<]+/gi;

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.split('=');
    return [key, value];
  }),
);

const concurrency = Number.parseInt(args.get('--concurrency') || '6', 10);
const limit = Number.parseInt(args.get('--limit') || '0', 10);

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

const exportUrlIndex = new Map();
const normalizedExportUrlIndex = new Map();

function addExportUrl(match) {
  const basename = basenameFromUrlOrKey(match);
  if (!basename) return;
  const list = exportUrlIndex.get(basename) || [];
  if (!list.includes(match)) list.push(match);
  exportUrlIndex.set(basename, list);

  const normalizedBasename = normalizeBasenameForMatching(basename);
  if (!normalizedBasename) return;
  const normalizedList = normalizedExportUrlIndex.get(normalizedBasename) || [];
  if (!normalizedList.includes(match)) normalizedList.push(match);
  normalizedExportUrlIndex.set(normalizedBasename, normalizedList);
}

function buildExportUrlIndex() {
  const files = fs.readdirSync(ARTICLES_DIR).filter((file) => file.endsWith('.json'));
  for (const file of files) {
    const raw = fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf8');
    const matches = raw.match(EXPORT_URL_REGEX) || [];
    for (const match of matches) addExportUrl(match);
  }

  if (fs.existsSync(PREPARED_ARTICLES_FILE)) {
    const raw = fs.readFileSync(PREPARED_ARTICLES_FILE, 'utf8');
    const matches = raw.match(EXPORT_URL_REGEX) || [];
    for (const match of matches) addExportUrl(match);
  }
}

function buildBrokenSourceCandidates(entry) {
  const urls = new Set();
  const exactBasename = basenameFromUrlOrKey(entry.normalizedOriginalUrl);
  const strippedBasename = basenameFromUrlOrKey(stripSizeSuffixFromKey(toObjectKey(entry.normalizedOriginalUrl)));
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

async function classifyEntry(entry) {
  const candidates = buildBrokenSourceCandidates(entry);
  const attempts = [];

  for (const candidate of candidates) {
    const result = await fetchHead(candidate);
    attempts.push(result);

    if (result.status === 200) {
      return {
        status: 'upstream-available',
        entry,
        sourceUrl: candidate,
        attempts,
      };
    }

    if (result.status === 403) {
      return {
        status: 'upstream-forbidden',
        entry,
        sourceUrl: candidate,
        attempts,
      };
    }
  }

  return {
    status: 'upstream-missing',
    entry,
    attempts,
  };
}

async function main() {
  buildExportUrlIndex();
  const entries = JSON.parse(fs.readFileSync(BROKEN_FILE, 'utf8'));
  const selected = limit > 0 ? entries.slice(0, limit) : entries;

  let processed = 0;
  const results = await mapWithConcurrency(selected, concurrency, async (entry) => {
    const result = await classifyEntry(entry);
    processed += 1;
    if (processed % 50 === 0 || processed === selected.length) {
      console.log(`[CLASSIFY] ${processed}/${selected.length}`);
    }
    return result;
  });

  const available = results.filter((item) => item.status === 'upstream-available');
  const forbidden = results.filter((item) => item.status === 'upstream-forbidden');
  const missing = results.filter((item) => item.status === 'upstream-missing');

  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(path.join(TMP_DIR, 'broken-images-upstream-available.json'), JSON.stringify(available, null, 2));
  fs.writeFileSync(path.join(TMP_DIR, 'broken-images-upstream-forbidden.json'), JSON.stringify(forbidden, null, 2));
  fs.writeFileSync(path.join(TMP_DIR, 'broken-images-upstream-missing.json'), JSON.stringify(missing, null, 2));
  fs.writeFileSync(
    path.join(TMP_DIR, 'broken-images-upstream-summary.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        total: selected.length,
        upstreamAvailable: available.length,
        upstreamForbidden: forbidden.length,
        upstreamMissing: missing.length,
      },
      null,
      2,
    ),
  );

  console.log(
    JSON.stringify(
      {
        total: selected.length,
        upstreamAvailable: available.length,
        upstreamForbidden: forbidden.length,
        upstreamMissing: missing.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error('[CLASSIFY] Failed:', error);
  process.exit(1);
});
