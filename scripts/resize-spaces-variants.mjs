import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { Readable } from 'node:stream';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, 'tmp');
const DEFAULT_REPORT = path.join(TMP_DIR, 'spaces-resize-variants-report.json');

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

const urlsFile = args.get('--urls-file');
const singleUrl = args.get('--url');
const reportFile = args.get('--report') || DEFAULT_REPORT;
const concurrency = Number.parseInt(args.get('--concurrency') || '4', 10);

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

function getTargetSize(key) {
  const basename = key.split('/').pop() || '';
  const match = basename.match(/-(\d+)(?:x|X|\*)(\d+)(?:-scaled)?(?=\.[a-z0-9]+$)/i);
  if (!match) return null;
  return {
    width: Number.parseInt(match[1], 10),
    height: Number.parseInt(match[2], 10),
  };
}

function getExtension(key) {
  const match = key.match(/(\.[a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : '';
}

function getContentType(ext) {
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.avif':
      return 'image/avif';
    default:
      return 'application/octet-stream';
  }
}

async function streamToBuffer(body) {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (body instanceof Readable) {
    const chunks = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray());
  }
  return Buffer.from(await new Response(body).arrayBuffer());
}

async function headObject(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: SPACES_BUCKET, Key: key }));
    return true;
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    if (status === 404 || error?.name === 'NotFound') return false;
    throw error;
  }
}

async function getObjectBuffer(key) {
  const response = await s3.send(new GetObjectCommand({ Bucket: SPACES_BUCKET, Key: key }));
  return streamToBuffer(response.Body);
}

async function resizeImage(buffer, ext, size) {
  let pipeline = sharp(buffer).rotate().resize({
    width: size.width,
    height: size.height,
    fit: 'inside',
    withoutEnlargement: true,
  });

  switch (ext) {
    case '.jpg':
    case '.jpeg':
      pipeline = pipeline.jpeg({ quality: 82, mozjpeg: true, progressive: true });
      break;
    case '.png':
      pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, palette: true });
      break;
    case '.webp':
      pipeline = pipeline.webp({ quality: 82 });
      break;
    case '.avif':
      pipeline = pipeline.avif({ quality: 55 });
      break;
    default:
      break;
  }

  return pipeline.toBuffer();
}

async function putObject(key, body, ext) {
  await s3.send(
    new PutObjectCommand({
      Bucket: SPACES_BUCKET,
      Key: key,
      Body: body,
      ContentType: getContentType(ext),
      CacheControl: 'public, max-age=31536000, immutable',
      ACL: 'public-read',
    }),
  );
}

async function processUrl(url) {
  const targetKey = toObjectKey(url);
  if (!targetKey) return { status: 'failed', url, reason: 'invalid_target_url' };

  const size = getTargetSize(targetKey);
  if (!size) return { status: 'failed', url, targetKey, reason: 'missing_size_suffix' };

  const sourceKey = stripSizeSuffixFromKey(targetKey);
  if (!sourceKey || sourceKey === targetKey) {
    return { status: 'failed', url, targetKey, reason: 'missing_source_key' };
  }

  const sourceExists = await headObject(sourceKey);
  if (!sourceExists) {
    return { status: 'failed', url, targetKey, sourceKey, reason: 'source_missing' };
  }

  const sourceBuffer = await getObjectBuffer(sourceKey);
  const ext = getExtension(targetKey) || getExtension(sourceKey);
  const resizedBuffer = await resizeImage(sourceBuffer, ext, size);
  await putObject(targetKey, resizedBuffer, ext);

  return {
    status: 'resized',
    url,
    targetKey,
    sourceKey,
    width: size.width,
    height: size.height,
    bytes: resizedBuffer.byteLength,
  };
}

function loadUrls() {
  if (singleUrl) return [singleUrl];
  if (!urlsFile) return [];
  const fullPath = path.isAbsolute(urlsFile) ? urlsFile : path.join(ROOT, urlsFile);
  return fs
    .readFileSync(fullPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
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
  const urls = loadUrls();
  if (urls.length === 0) {
    throw new Error('Provide --url=... or --urls-file=...');
  }

  let processed = 0;
  const results = await mapWithConcurrency(urls, concurrency, async (url) => {
    const result = await processUrl(url);
    processed += 1;
    console.log(`${result.status.toUpperCase()} ${processed}/${urls.length} ${url}`);
    return result;
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    total: urls.length,
    resized: results.filter((item) => item.status === 'resized').length,
    failed: results.filter((item) => item.status === 'failed').length,
    results,
  };

  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(reportFile, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ reportFile, ...summary }, null, 2));
}

main().catch((error) => {
  console.error('[RESIZE-VARIANTS] Failed:', error);
  process.exit(1);
});
