import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const ROOT_DIR = process.cwd();
const DEFAULT_SITE_ORIGIN = process.env.WORDPRESS_SITE_ORIGIN || 'https://lacuisinedebernard.com';
const DEFAULT_SPACES_PUBLIC_BASE_URL =
  process.env.SPACES_PUBLIC_BASE_URL || 'https://lcdb.fra1.digitaloceanspaces.com';
const DEFAULT_WORDPRESS_UPLOADS_BASE_URL =
  process.env.WORDPRESS_UPLOADS_BASE_URL || `${DEFAULT_SITE_ORIGIN}/wp-content/uploads/`;
const DEFAULT_SITEMAPS = [
  process.env.WORDPRESS_SITEMAP_URL || `${DEFAULT_SITE_ORIGIN}/sitemap.xml`,
  `${DEFAULT_SITE_ORIGIN}/sitemap_index.xml`,
];

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.split('=');
    return [key, value];
  }),
);

const discoverOnly = args.has('--discover-only');
const dryRun = args.has('--dry-run');
const pageLimit = Number.parseInt(args.get('--page-limit') || '0', 10);
const imageLimit = Number.parseInt(args.get('--image-limit') || '0', 10);
const concurrency = Math.max(1, Number.parseInt(args.get('--concurrency') || '6', 10));
const reportFile =
  args.get('--report') || path.join(ROOT_DIR, 'tmp', 'wp-spaces-import-report.json');
const includeRepoScan = !args.has('--no-repo-scan');

const spacesBucket = process.env.SPACES_BUCKET;
const spacesRegion = process.env.SPACES_REGION || 'fra1';
const spacesEndpoint = process.env.SPACES_ENDPOINT || `https://${spacesRegion}.digitaloceanspaces.com`;
const spacesAccessKeyId = process.env.SPACES_ACCESS_KEY_ID;
const spacesSecretAccessKey = process.env.SPACES_SECRET_ACCESS_KEY;

const requiresSpacesCredentials = !discoverOnly;
if (
  requiresSpacesCredentials &&
  (!spacesBucket || !spacesAccessKeyId || !spacesSecretAccessKey)
) {
  console.error(
    [
      'Missing required env vars.',
      'Set SPACES_BUCKET, SPACES_ACCESS_KEY_ID, and SPACES_SECRET_ACCESS_KEY before running this script.',
      'You can use --discover-only without Spaces credentials to get the total discovered image count.',
    ].join(' '),
  );
  process.exit(1);
}

const s3 =
  requiresSpacesCredentials
    ? new S3Client({
        region: spacesRegion,
        endpoint: spacesEndpoint,
        credentials: {
          accessKeyId: spacesAccessKeyId,
          secretAccessKey: spacesSecretAccessKey,
        },
      })
    : null;

const WP_UPLOAD_URL_PATTERN =
  /https?:\/\/[^"'()\s]+\/wp-content\/uploads\/[^"'()\s]+/gi;
const WP_SRCSET_SPLIT_PATTERN = /\s+\d+w$/i;
const REPO_SCAN_ROOTS = ['src', 'public'];
const REPO_SCAN_EXTENSIONS = new Set([
  '.astro',
  '.html',
  '.json',
  '.md',
  '.mjs',
  '.js',
  '.ts',
  '.css',
]);

const requestHeaders = {
  'User-Agent': 'Mozilla/5.0 (compatible; LCDBImageImporter/1.0)',
  Accept: '*/*',
};

const normalizeUrl = (rawUrl) => {
  try {
    const parsed = new URL(String(rawUrl || '').trim());
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return '';
  }
};

const toObjectKey = (rawUrl) => {
  try {
    const parsed = new URL(rawUrl);
    const pathname = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
    return pathname.startsWith('wp-content/uploads/') ? pathname : null;
  } catch {
    return null;
  }
};

const toOriginUrl = (objectKey) => {
  const relativePath = objectKey.replace(/^wp-content\/uploads\//, '');
  return new URL(relativePath, DEFAULT_WORDPRESS_UPLOADS_BASE_URL).toString();
};

const ensureParentDir = async (filePath) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
};

const headObject = async (objectKey) => {
  try {
    await s3.send(
      new HeadObjectCommand({
        Bucket: spacesBucket,
        Key: objectKey,
      }),
    );
    return true;
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    if (status === 404 || error?.name === 'NotFound') {
      return false;
    }
    throw error;
  }
};

const putMissingObject = async (objectKey) => {
  const originUrl = toOriginUrl(objectKey);
  const response = await fetch(originUrl, {
    headers: requestHeaders,
  });

  if (!response.ok) {
    throw new Error(`origin_fetch_http_${response.status}: ${originUrl}`);
  }

  const body = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const cacheControl = response.headers.get('cache-control') || 'public, max-age=31536000, immutable';

  await s3.send(
    new PutObjectCommand({
      Bucket: spacesBucket,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
      ACL: 'public-read',
    }),
  );

  return {
    objectKey,
    originUrl,
    bytes: body.byteLength,
    contentType,
  };
};

const fetchText = async (url) => {
  const response = await fetch(url, { headers: requestHeaders, redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`http_${response.status}: ${url}`);
  }
  return response.text();
};

const decodeXmlEntities = (value) =>
  String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const extractLocsFromXml = (xml) => {
  const matches = xml.match(/<loc>(.*?)<\/loc>/gi) || [];
  return matches
    .map((match) => match.replace(/<\/?loc>/gi, '').trim())
    .map((loc) => decodeXmlEntities(loc))
    .map((loc) => normalizeUrl(loc))
    .filter(Boolean);
};

const collectSitemapUrls = async () => {
  const queue = [...DEFAULT_SITEMAPS];
  const visited = new Set();
  const pages = new Set();

  while (queue.length > 0) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || visited.has(sitemapUrl)) continue;
    visited.add(sitemapUrl);

    try {
      const xml = await fetchText(sitemapUrl);
      const locs = extractLocsFromXml(xml);
      for (const loc of locs) {
        if (loc.endsWith('.xml')) {
          if (!visited.has(loc)) queue.push(loc);
          continue;
        }
        if (loc.startsWith(DEFAULT_SITE_ORIGIN)) {
          pages.add(loc);
        }
      }
    } catch (error) {
      console.warn(`[sitemap-failed] ${sitemapUrl}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const allPages = [...pages];
  return pageLimit > 0 ? allPages.slice(0, pageLimit) : allPages;
};

const walk = async (dirPath) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    if (REPO_SCAN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
};

const collectImageUrlsFromRepo = async () => {
  const found = new Set();

  for (const relativeRoot of REPO_SCAN_ROOTS) {
    const absoluteRoot = path.join(ROOT_DIR, relativeRoot);
    try {
      const files = await walk(absoluteRoot);
      for (const filePath of files) {
        const content = await fs.readFile(filePath, 'utf8');
        const imageUrls = collectUploadUrlsFromHtml(content);
        for (const imageUrl of imageUrls) {
          found.add(imageUrl);
        }
      }
    } catch {
      // Ignore missing roots.
    }
  }

  return [...found];
};

const collectUploadUrlsFromHtml = (html) => {
  const found = new Set();
  const rawMatches = html.match(WP_UPLOAD_URL_PATTERN) || [];

  for (const rawMatch of rawMatches) {
    const parts = rawMatch.split(',');
    for (const part of parts) {
      const cleaned = part.replace(WP_SRCSET_SPLIT_PATTERN, '').trim();
      const normalized = normalizeUrl(cleaned);
      if (normalized && normalized.includes('/wp-content/uploads/')) {
        found.add(normalized);
      }
    }
  }

  return [...found];
};

const mapWithConcurrency = async (items, worker, workerConcurrency) => {
  const results = [];
  let index = 0;

  const runners = Array.from({ length: workerConcurrency }, async () => {
    while (true) {
      const currentIndex = index++;
      if (currentIndex >= items.length) break;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
  return results;
};

const collectImageUrlsFromPages = async (pageUrls) => {
  const found = new Set();
  const pageResults = await mapWithConcurrency(
    pageUrls,
    async (pageUrl) => {
      try {
        const html = await fetchText(pageUrl);
        const imageUrls = collectUploadUrlsFromHtml(html);
        return { pageUrl, imageUrls, error: null };
      } catch (error) {
        return {
          pageUrl,
          imageUrls: [],
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    concurrency,
  );

  for (const result of pageResults) {
    for (const imageUrl of result.imageUrls) {
      found.add(imageUrl);
    }
  }

  return {
    imageUrls: [...found],
    pageResults,
  };
};

const run = async () => {
  const report = {
    scannedAt: new Date().toISOString(),
    siteOrigin: DEFAULT_SITE_ORIGIN,
    discoverOnly,
    dryRun,
    pageLimit,
    imageLimit,
    sitemapsSeeded: DEFAULT_SITEMAPS,
    totalPagesDiscovered: 0,
    pagesScanned: 0,
    repoReferencedImageUrlCount: 0,
    imageUrlCount: 0,
    objectKeyCount: 0,
    uploaded: [],
    existing: [],
    failed: [],
    pageFailures: [],
  };

  const pageUrls = await collectSitemapUrls();
  report.totalPagesDiscovered = pageUrls.length;
  report.pagesScanned = pageUrls.length;

  const { imageUrls: pageImageUrls, pageResults } = await collectImageUrlsFromPages(pageUrls);
  const repoImageUrls = includeRepoScan ? await collectImageUrlsFromRepo() : [];
  report.pageFailures = pageResults.filter((result) => result.error);
  report.repoReferencedImageUrlCount = repoImageUrls.length;

  const imageUrls = [...new Set([...pageImageUrls, ...repoImageUrls])];
  report.imageUrlCount = imageUrls.length;

  const objectKeys = [...new Set(imageUrls.map(toObjectKey).filter(Boolean))];
  const selectedKeys = imageLimit > 0 ? objectKeys.slice(0, imageLimit) : objectKeys;
  report.objectKeyCount = selectedKeys.length;

  if (!discoverOnly) {
    for (const objectKey of selectedKeys) {
      try {
        const exists = await headObject(objectKey);
        if (exists) {
          report.existing.push({ objectKey });
          continue;
        }

        if (dryRun) {
          report.uploaded.push({
            objectKey,
            originUrl: toOriginUrl(objectKey),
            dryRun: true,
          });
          continue;
        }

        const uploaded = await putMissingObject(objectKey);
        report.uploaded.push(uploaded);
        console.log(`[uploaded] ${objectKey}`);
      } catch (error) {
        report.failed.push({
          objectKey,
          message: error instanceof Error ? error.message : String(error),
        });
        console.warn(`[failed] ${objectKey}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  await ensureParentDir(reportFile);
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2), 'utf8');

  console.log(
    JSON.stringify(
      {
        reportFile,
        totalPagesDiscovered: report.totalPagesDiscovered,
        pagesFailed: report.pageFailures.length,
        repoReferencedImageUrlCount: report.repoReferencedImageUrlCount,
        imageUrlCount: report.imageUrlCount,
        objectKeyCount: report.objectKeyCount,
        existing: report.existing.length,
        uploaded: report.uploaded.length,
        failed: report.failed.length,
      },
      null,
      2,
    ),
  );
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
