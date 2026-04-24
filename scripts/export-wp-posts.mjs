import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_BASE_URL = 'https://stagingapp15670.cloudwayssites.com';
const DEFAULT_LANGS = ['fr', 'en', 'es', 'pt-br', 'ar'];
const DEFAULT_REQUEST_PER_PAGE = 100;
const DEFAULT_OUTPUT_PER_FILE = 300;
const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_RETRIES = 3;
const CANONICAL_SITE_ORIGIN = 'https://lacuisinedebernard.com';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36';

const argMap = new Map(
  process.argv.slice(2).map((entry) => {
    const [key, ...rest] = entry.split('=');
    return [key, rest.join('=')];
  }),
);

const hasArg = (name) => argMap.has(name);
const getArg = (name, fallback = '') => (argMap.has(name) ? argMap.get(name) : fallback);

const baseUrl = String(getArg('--base-url', DEFAULT_BASE_URL)).replace(/\/+$/, '');
const langs = String(getArg('--langs', DEFAULT_LANGS.join(',')))
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const requestPerPage = Math.max(1, Number.parseInt(String(getArg('--request-per-page', DEFAULT_REQUEST_PER_PAGE)), 10) || DEFAULT_REQUEST_PER_PAGE);
const outputPerFile = Math.max(1, Number.parseInt(String(getArg('--output-per-file', DEFAULT_OUTPUT_PER_FILE)), 10) || DEFAULT_OUTPUT_PER_FILE);
const timeoutMs = Math.max(5000, Number.parseInt(String(getArg('--timeout-ms', DEFAULT_TIMEOUT_MS)), 10) || DEFAULT_TIMEOUT_MS);
const retries = Math.max(1, Number.parseInt(String(getArg('--retries', DEFAULT_RETRIES)), 10) || DEFAULT_RETRIES);
const maxPosts = Math.max(0, Number.parseInt(String(getArg('--max-posts', '0')), 10) || 0);
const dryRun = hasArg('--dry-run');
const skipBackup = hasArg('--no-backup');
const skipClean = hasArg('--no-clean');

const articlesDir = path.join(process.cwd(), 'All Articles');

const nowStamp = () => {
  const d = new Date();
  const pad = (v) => String(v).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

const decodeBasicEntities = (value) =>
  String(value || '')
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCodePoint(Number.parseInt(dec, 10));
      } catch {
        return _;
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCodePoint(Number.parseInt(hex, 16));
      } catch {
        return _;
      }
    })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"');

const stripHtml = (html) => decodeBasicEntities(String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

const normalizeSiteUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'stagingapp15670.cloudwayssites.com') {
      parsed.protocol = 'https:';
      parsed.hostname = 'lacuisinedebernard.com';
      parsed.port = '';
      return parsed.toString();
    }
    return parsed.toString();
  } catch {
    return String(url);
  }
};

const normalizeHtmlUrls = (html) =>
  String(html || '').replace(/https?:\/\/stagingapp15670\.cloudwayssites\.com/gi, CANONICAL_SITE_ORIGIN);

const uniqueByKey = (list, keyFn) => {
  const seen = new Set();
  const output = [];
  for (const item of list) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
};

const extractInlineImages = (html) => {
  const matches = String(html || '').match(/https?:\/\/[^"'\s)]+\/wp-content\/uploads\/[^"'\s)<]+/gi) || [];
  const normalized = matches.map((url) => normalizeSiteUrl(url));
  return [...new Set(normalized)];
};

async function fetchJson(url, attempt = 1) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    });

    const bodyText = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} :: ${bodyText.slice(0, 240)}`);
    }

    let data;
    try {
      data = JSON.parse(bodyText);
    } catch (error) {
      throw new Error(`Invalid JSON response :: ${error.message}`);
    }

    return { data, headers: response.headers };
  } catch (error) {
    if (attempt >= retries) throw error;
    const waitMs = Math.min(2000 * attempt, 6000);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return fetchJson(url, attempt + 1);
  } finally {
    clearTimeout(timer);
  }
}

function mapTerms(post) {
  const termBuckets = Array.isArray(post?._embedded?.['wp:term']) ? post._embedded['wp:term'] : [];
  const flatTerms = termBuckets.flat().filter((term) => term && typeof term === 'object');

  const categories = uniqueByKey(
    flatTerms
      .filter((term) => term.taxonomy === 'category')
      .map((term) => ({
        id: term.id ?? null,
        name: decodeBasicEntities(term.name || ''),
        slug: String(term.slug || ''),
      })),
    (term) => `${term.id ?? ''}:${term.slug}`,
  );

  const tags = uniqueByKey(
    flatTerms
      .filter((term) => term.taxonomy === 'post_tag')
      .map((term) => ({
        id: term.id ?? null,
        name: decodeBasicEntities(term.name || ''),
        slug: String(term.slug || ''),
      })),
    (term) => `${term.id ?? ''}:${term.slug}`,
  );

  return { categories, tags };
}

function mapPostToLegacyShape(post, lang) {
  const renderedTitle = post?.title?.rendered ?? '';
  const renderedExcerpt = post?.excerpt?.rendered ?? '';
  const renderedContent = post?.content?.rendered ?? '';

  const featuredMedia = Array.isArray(post?._embedded?.['wp:featuredmedia']) ? post._embedded['wp:featuredmedia'][0] : null;
  const embeddedAuthor = Array.isArray(post?._embedded?.author) ? post._embedded.author[0] : null;
  const { categories, tags } = mapTerms(post);

  const featuredImage = featuredMedia
    ? {
        id: featuredMedia.id ?? null,
        url: normalizeSiteUrl(featuredMedia.source_url || ''),
        width: featuredMedia.media_details?.width ?? null,
        height: featuredMedia.media_details?.height ?? null,
        alt: decodeBasicEntities(featuredMedia.alt_text || ''),
      }
    : null;

  return {
    id: post.id ?? null,
    lang,
    slug: String(post.slug || ''),
    date: post.date ? String(post.date).replace('T', ' ') : '',
    modified: post.modified ? String(post.modified).replace('T', ' ') : '',
    link: normalizeSiteUrl(post.link || ''),
    title: stripHtml(renderedTitle),
    excerpt: normalizeHtmlUrls(renderedExcerpt),
    content: normalizeHtmlUrls(renderedContent),
    author: embeddedAuthor
      ? {
          id: embeddedAuthor.id ?? null,
          name: decodeBasicEntities(embeddedAuthor.name || ''),
          slug: String(embeddedAuthor.slug || ''),
          email: '',
        }
      : null,
    featured_image: featuredImage,
    inline_images: extractInlineImages(renderedContent),
    categories,
    tags,
    comments: [],
    comment_count: 0,
    seo: {
      title: '',
      description: '',
      focus_kw: '',
    },
    meta: post.meta && typeof post.meta === 'object' ? post.meta : {},
  };
}

async function ensureDirectoryExists(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function backupExistingFiles(existingFiles) {
  if (skipBackup || existingFiles.length === 0 || dryRun) return null;
  const backupDir = path.join(articlesDir, `_backup-post-json-${nowStamp()}`);
  await ensureDirectoryExists(backupDir);
  for (const file of existingFiles) {
    await fs.copyFile(path.join(articlesDir, file), path.join(backupDir, file));
  }
  return backupDir;
}

async function cleanExistingFiles(existingFiles) {
  if (skipClean || dryRun) return;
  for (const file of existingFiles) {
    await fs.unlink(path.join(articlesDir, file));
  }
}

async function run() {
  console.log('='.repeat(72));
  console.log('WP -> All Articles Export (multilingual, legacy-compatible shape)');
  console.log('='.repeat(72));
  console.log(`Base URL          : ${baseUrl}`);
  console.log(`Languages         : ${langs.join(', ')}`);
  console.log(`Request per page  : ${requestPerPage}`);
  console.log(`Output per file   : ${outputPerFile}`);
  console.log(`Dry run           : ${dryRun ? 'yes' : 'no'}`);
  if (maxPosts > 0) console.log(`Max posts         : ${maxPosts}`);
  console.log('-'.repeat(72));

  await ensureDirectoryExists(articlesDir);
  const existingFiles = (await fs.readdir(articlesDir)).filter((name) => /^post-\d+\.json$/i.test(name));
  const backupDir = await backupExistingFiles(existingFiles);
  await cleanExistingFiles(existingFiles);

  if (backupDir) {
    console.log(`Backup created     : ${backupDir}`);
  } else if (existingFiles.length > 0 && skipBackup) {
    console.log('Backup skipped     : --no-backup');
  }

  if (existingFiles.length > 0 && !skipClean && !dryRun) {
    console.log(`Cleared old files  : ${existingFiles.length} (post-*.json)`);
  }

  let targetTotalPosts = 0;
  const firstPageCache = new Map();

  for (const lang of langs) {
    const firstUrl = `${baseUrl}/wp-json/wp/v2/posts?lang=${encodeURIComponent(lang)}&status=publish&orderby=date&order=desc&per_page=${requestPerPage}&page=1&_embed=1`;
    const { data, headers } = await fetchJson(firstUrl);
    const totalLangPosts = Number.parseInt(headers.get('x-wp-total') || '0', 10) || 0;
    const totalLangPages = Number.parseInt(headers.get('x-wp-totalpages') || '0', 10) || 0;
    firstPageCache.set(lang, { data, totalLangPosts, totalLangPages });
    targetTotalPosts += totalLangPosts;
    console.log(`[${lang}] total=${totalLangPosts}, pages=${totalLangPages}`);
  }

  if (maxPosts > 0) {
    targetTotalPosts = Math.min(targetTotalPosts, maxPosts);
  }

  const totalOutputPages = Math.max(1, Math.ceil(targetTotalPosts / outputPerFile));
  let outputPage = 1;
  let currentPosts = [];
  let writtenPosts = 0;
  let skippedNoSlug = 0;

  const flushCurrentPage = async () => {
    if (currentPosts.length === 0) return;
    const payload = {
      page: outputPage,
      per_page: outputPerFile,
      count: currentPosts.length,
      total_posts: targetTotalPosts,
      total_pages: totalOutputPages,
      has_more: outputPage < totalOutputPages,
      posts: currentPosts,
    };

    if (!dryRun) {
      const outputPath = path.join(articlesDir, `post-${outputPage}.json`);
      await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8');
    }

    console.log(`Wrote page ${outputPage}/${totalOutputPages} with ${currentPosts.length} posts`);
    outputPage += 1;
    currentPosts = [];
  };

  const consumePosts = async (posts, lang) => {
    for (const post of posts) {
      if (maxPosts > 0 && writtenPosts >= maxPosts) return true;

      const mapped = mapPostToLegacyShape(post, lang);
      if (!mapped.slug) {
        skippedNoSlug += 1;
        continue;
      }

      currentPosts.push(mapped);
      writtenPosts += 1;

      if (currentPosts.length >= outputPerFile) {
        await flushCurrentPage();
      }
    }
    return false;
  };

  for (const lang of langs) {
    const first = firstPageCache.get(lang);
    if (!first) continue;

    const { data: firstPageData, totalLangPages } = first;
    let shouldStop = await consumePosts(firstPageData, lang);
    if (shouldStop) break;

    for (let page = 2; page <= totalLangPages; page += 1) {
      if (maxPosts > 0 && writtenPosts >= maxPosts) {
        shouldStop = true;
        break;
      }

      const pageUrl = `${baseUrl}/wp-json/wp/v2/posts?lang=${encodeURIComponent(lang)}&status=publish&orderby=date&order=desc&per_page=${requestPerPage}&page=${page}&_embed=1`;
      const { data } = await fetchJson(pageUrl);
      shouldStop = await consumePosts(data, lang);
      if (shouldStop) break;

      if (page % 10 === 0 || page === totalLangPages) {
        console.log(`[${lang}] fetched page ${page}/${totalLangPages}, written=${writtenPosts}`);
      }
    }

    if (shouldStop) break;
  }

  if (currentPosts.length > 0) {
    await flushCurrentPage();
  }

  console.log('-'.repeat(72));
  console.log(`Export complete. written_posts=${writtenPosts}, skipped_no_slug=${skippedNoSlug}, output_pages=${outputPage - 1}`);
  console.log(`Target total_posts metadata=${targetTotalPosts}`);
  if (dryRun) {
    console.log('Dry run was enabled, no files were written.');
  } else {
    console.log(`Output directory: ${articlesDir}`);
  }
}

run().catch((error) => {
  console.error('Export failed:', error?.message || error);
  process.exit(1);
});
