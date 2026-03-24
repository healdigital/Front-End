/**
 * Utility function to replace CDN URLs for images
 * Replaces old CDN with new DigitalOcean Spaces CDN
 */

const DEFAULT_PAYLOAD_API_URL =
  (typeof process !== 'undefined' &&
    (process.env.PUBLIC_PAYLOAD_API_URL || process.env.PUBLIC_TRANSLATE_API_URL)) ||
  'https://admin.lacuisinedebernard.com/api';

const WP_UPLOAD_PATH_PATTERN = /\/wp-content\/uploads\//i;
const WP_IMAGE_URL_PATTERN =
  /^(.+?)(\.(?:jpe?g|png|webp|avif|gif))(?:\?([^#]+))?(?:#(.+))?$/i;
const WP_SIZE_SUFFIX_PATTERN = /-(?:\d+)(?:x|X|\*|×)(?:\d+)(?:-scaled)?$/i;

const getPayloadOrigin = (): string => {
  try {
    return new URL(DEFAULT_PAYLOAD_API_URL).origin;
  } catch {
    return 'https://admin.lacuisinedebernard.com';
  }
};

export function replaceCdnUrl(url: string): string {
  if (!url) return url;

  if (typeof url === 'string') {
    if (url.startsWith('/api/') || url.startsWith('/media/')) {
      return `${getPayloadOrigin()}${url}`;
    }

    if (url.startsWith('api/')) {
      return `${getPayloadOrigin()}/${url}`;
    }

    if (url.startsWith('media/')) {
      return `${getPayloadOrigin()}/${url}`;
    }
  }

  return url
    .replace(
      /^https?:\/\/cdn\.lacuisinedebernard\.com\//i,
      'https://lcdb.fra1.digitaloceanspaces.com/',
    )
    .replace(
      /^https?:\/\/(?:www\.)?lacuisinedebernard\.com\/wp-content\/uploads\//i,
      'https://lcdb.fra1.digitaloceanspaces.com/wp-content/uploads/',
    );
}

function splitWpUploadUrl(url: string) {
  const normalized = replaceCdnUrl(url);
  if (!WP_UPLOAD_PATH_PATTERN.test(normalized)) return null;

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

function normalizeWpUploadBase(base: string): string {
  return base
    .replace(/-(?:\d+)(?:x|X|\*|×)(?:\d+)-scaled$/i, '')
    .replace(/-(?:\d+)(?:x|X|\*|×)(?:\d+)$/i, '')
    .replace(/-scaled$/i, '');
}

function buildFromParts(base: string, ext: string, query = '', hash = '') {
  return `${base}${ext}${query}${hash}`;
}

export function normalizeWordPressUploadUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  return replaceCdnUrl(url);
}

export function stripWordPressImageSizeSuffix(url: string): string {
  const parts = splitWpUploadUrl(url);
  if (!parts) return replaceCdnUrl(url);

  return buildFromParts(
    normalizeWpUploadBase(parts.base),
    parts.ext,
    parts.query,
    parts.hash,
  );
}

export function buildWordPressImageFallbackCandidates(url: string): string[] {
  if (!url || typeof url !== 'string') return [];

  const parts = splitWpUploadUrl(url);
  if (!parts) return [replaceCdnUrl(url)];

  const strippedBase = normalizeWpUploadBase(parts.base);
  const candidates = new Set<string>();

  candidates.add(parts.normalized);
  candidates.add(buildFromParts(strippedBase, parts.ext, parts.query, parts.hash));

  if (!WP_SIZE_SUFFIX_PATTERN.test(parts.base)) {
    candidates.add(buildFromParts(`${strippedBase}-1593x2048`, parts.ext, parts.query, parts.hash));
    candidates.add(buildFromParts(`${strippedBase}-797x1024`, parts.ext, parts.query, parts.hash));
    candidates.add(buildFromParts(`${strippedBase}-585x585`, parts.ext, parts.query, parts.hash));
    candidates.add(buildFromParts(`${strippedBase}-587x587`, parts.ext, parts.query, parts.hash));
    candidates.add(buildFromParts(`${strippedBase}-500x500`, parts.ext, parts.query, parts.hash));
  }

  return Array.from(candidates).filter(Boolean);
}

/**
 * Build a smaller square variant URL for WordPress uploads.
 * Many imported assets include generated square derivatives (e.g. -500x500).
 */
export function buildWpSquareVariantUrl(url: string, size = 500): string {
  if (!url || typeof url !== 'string') return '';

  const parts = splitWpUploadUrl(url);
  if (!parts) return replaceCdnUrl(url);

  return buildFromParts(
    `${normalizeWpUploadBase(parts.base)}-${size}x${size}`,
    parts.ext,
    parts.query,
    parts.hash,
  );
}

/**
 * Build a portrait-friendly WordPress derivative URL (non-cropped).
 * For "-scaled" originals this prefers the common 797x1024 variant.
 */
export function buildWpPortraitVariantUrl(url: string, variant = '797x1024'): string {
  if (!url || typeof url !== 'string') return '';

  const parts = splitWpUploadUrl(url);
  if (!parts) return replaceCdnUrl(url);

  return buildFromParts(
    `${normalizeWpUploadBase(parts.base)}-${variant}`,
    parts.ext,
    parts.query,
    parts.hash,
  );
}

/**
 * Process article image URLs to use the new CDN
 */
export function processArticleImageUrl(article: any): string {
  if (!article) return '';

  const extractFromHtml = (html?: string): string => {
    if (!html || typeof html !== 'string') return '';
    const match =
      html.match(/<img[^>]+src=["']([^"']+)["']/i) ||
      html.match(/<img[^>]+data-src=["']([^"']+)["']/i);
    if (!match) return '';
    return match[1] || '';
  };

  const possibleUrls = [
    article.featuredMedia?.sizes?.articleHero?.url,
    article.featuredMedia?.sizes?.gallery?.url,
    article.featuredMedia?.url,
    article.featuredMedia?.value?.url,
    article.featuredImage?.sizes?.articleHero?.url,
    article.featuredImage?.sizes?.gallery?.url,
    article.featured_image?.asset?.url,
    article.featured_image?.url,
    article.featured_image_url,
    article.featured_img_url,
    article.featureImage,
    article.featuredImage?.url,
    article.featuredImageUrl,
    extractFromHtml(article.content),
    extractFromHtml(article.contentV2),
  ];

  const imageUrl = possibleUrls.find((url) => url && typeof url === 'string');
  if (!imageUrl) return '';

  return replaceCdnUrl(imageUrl);
}
