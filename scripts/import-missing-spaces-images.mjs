import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const ROOT_DIR = process.cwd();
const DEFAULT_SCAN_ROOTS = ['src', 'public'];
const DEFAULT_SCAN_EXTENSIONS = new Set(['.astro', '.html', '.json', '.md', '.mjs', '.js', '.ts']);
const DEFAULT_SPACES_PUBLIC_BASE_URL =
  process.env.SPACES_PUBLIC_BASE_URL || 'https://lcdb.fra1.digitaloceanspaces.com';
const DEFAULT_WORDPRESS_UPLOADS_BASE_URL =
  process.env.WORDPRESS_UPLOADS_BASE_URL || 'https://lacuisinedebernard.com/wp-content/uploads/';

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.split('=');
    return [key, value];
  }),
);

const dryRun = args.has('--dry-run');
const limit = Number.parseInt(args.get('--limit') || '0', 10);
const reportFile =
  args.get('--report') || path.join(ROOT_DIR, 'tmp', 'missing-spaces-images-report.json');

const spacesBucket = process.env.SPACES_BUCKET;
const spacesRegion = process.env.SPACES_REGION || 'fra1';
const spacesEndpoint = process.env.SPACES_ENDPOINT || `https://${spacesRegion}.digitaloceanspaces.com`;
const spacesAccessKeyId = process.env.SPACES_ACCESS_KEY_ID;
const spacesSecretAccessKey = process.env.SPACES_SECRET_ACCESS_KEY;

if (!spacesBucket || !spacesAccessKeyId || !spacesSecretAccessKey) {
  console.error(
    [
      'Missing required env vars.',
      'Set SPACES_BUCKET, SPACES_ACCESS_KEY_ID, and SPACES_SECRET_ACCESS_KEY before running this script.',
    ].join(' '),
  );
  process.exit(1);
}

const s3 = new S3Client({
  region: spacesRegion,
  endpoint: spacesEndpoint,
  credentials: {
    accessKeyId: spacesAccessKeyId,
    secretAccessKey: spacesSecretAccessKey,
  },
});

const walk = async (dirPath) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    if (DEFAULT_SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const publicUploadsPattern = new RegExp(
  `${escapeRegExp(DEFAULT_SPACES_PUBLIC_BASE_URL)}\\/wp-content\\/uploads\\/[^"'()\\s]+`,
  'gi',
);
const originUploadsPattern = /https?:\/\/[^"'()\s]+\/wp-content\/uploads\/[^"'()\s]+/gi;

const collectCandidateUrls = async () => {
  const files = [];

  for (const relativeRoot of DEFAULT_SCAN_ROOTS) {
    const absoluteRoot = path.join(ROOT_DIR, relativeRoot);
    try {
      files.push(...(await walk(absoluteRoot)));
    } catch {
      // Ignore missing roots.
    }
  }

  const found = new Set();

  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf8');

    for (const match of content.match(publicUploadsPattern) || []) {
      found.add(match);
    }

    for (const match of content.match(originUploadsPattern) || []) {
      found.add(match);
    }
  }

  return [...found];
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

const ensureParentDir = async (filePath) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
};

const importMissingObject = async (objectKey) => {
  const originUrl = toOriginUrl(objectKey);
  const response = await fetch(originUrl, {
    headers: {
      'User-Agent': 'lcdb-astro-missing-image-import/1.0',
      Accept: '*/*',
    },
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

const run = async () => {
  const candidateUrls = await collectCandidateUrls();
  const uniqueKeys = [...new Set(candidateUrls.map(toObjectKey).filter(Boolean))];
  const selectedKeys = limit > 0 ? uniqueKeys.slice(0, limit) : uniqueKeys;

  const report = {
    scannedAt: new Date().toISOString(),
    dryRun,
    candidateUrlCount: candidateUrls.length,
    uniqueUploadKeys: uniqueKeys.length,
    checkedKeys: selectedKeys.length,
    uploaded: [],
    existing: [],
    failed: [],
  };

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

      const uploaded = await importMissingObject(objectKey);
      report.uploaded.push(uploaded);
      console.log(`[uploaded] ${objectKey}`);
    } catch (error) {
      report.failed.push({
        objectKey,
        message: error instanceof Error ? error.message : String(error),
      });
      console.warn(`[failed] ${objectKey}`, error);
    }
  }

  await ensureParentDir(reportFile);
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2), 'utf8');

  console.log(
    JSON.stringify(
      {
        reportFile,
        checked: report.checkedKeys,
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
