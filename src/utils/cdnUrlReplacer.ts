/**
 * Utility function to replace CDN URLs for images
 * Replaces old CDN with new DigitalOcean Spaces CDN
 */

const DEFAULT_PAYLOAD_API_URL =
  (typeof process !== 'undefined' &&
    (process.env.PUBLIC_PAYLOAD_API_URL || process.env.PUBLIC_TRANSLATE_API_URL)) ||
  'https://admin.lacuisinedebernard.com/api';

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
      'https://lcdb.fra1.digitaloceanspaces.com/'
    )
    .replace(
      /^https?:\/\/(?:www\.)?lacuisinedebernard\.com\/wp-content\/uploads\//i,
      'https://lcdb.fra1.digitaloceanspaces.com/wp-content/uploads/'
    );
}

const WP_UPLOAD_PATH_PATTERN = /\/wp-content\/uploads\//i;
const WP_IMAGE_URL_PATTERN =
  /^(.+?)(\.(?:jpe?g|png|webp|avif|gif))(?:\?([^#]+))?(?:#(.+))?$/i;

function normalizeWpUploadBase(base: string): string {
  return base.replace(/-\d+x\d+$/i, '').replace(/-scaled$/i, '');
}

export function normalizeWordPressUploadUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';

  const normalized = replaceCdnUrl(url);
  if (!WP_UPLOAD_PATH_PATTERN.test(normalized)) return normalized;

  const match = normalized.match(WP_IMAGE_URL_PATTERN);
  if (!match) return normalized;

  const base = normalizeWpUploadBase(match[1]);
  const ext = match[2];
  const query = match[3] ? `?${match[3]}` : '';
  const hash = match[4] ? `#${match[4]}` : '';

  return `${base}${ext}${query}${hash}`;
}

/**
 * Build a smaller square variant URL for WordPress uploads.
 * Many imported assets include generated square derivatives (e.g. -500x500).
 */
export function buildWpSquareVariantUrl(url: string, size = 500): string {
  if (!url || typeof url !== 'string') return '';

  const normalized = normalizeWordPressUploadUrl(url);
  if (!WP_UPLOAD_PATH_PATTERN.test(normalized)) return normalized;

  const match = normalized.match(WP_IMAGE_URL_PATTERN);
  if (!match) return normalized;

  const base = match[1];
  const ext = match[2];
  const query = match[3] ? `?${match[3]}` : '';
  const hash = match[4] ? `#${match[4]}` : '';

  return `${base}-${size}x${size}${ext}${query}${hash}`;
}

/**
 * Build a portrait-friendly WordPress derivative URL (non-cropped).
 * For "-scaled" originals this prefers the common 797x1024 variant.
 */
export function buildWpPortraitVariantUrl(url: string, variant = '797x1024'): string {
  if (!url || typeof url !== 'string') return '';

  const normalized = normalizeWordPressUploadUrl(url);
  if (!WP_UPLOAD_PATH_PATTERN.test(normalized)) return normalized;

  const match = normalized.match(WP_IMAGE_URL_PATTERN);
  if (!match) return normalized;

  const base = match[1];
  const ext = match[2];
  const query = match[3] ? `?${match[3]}` : '';
  const hash = match[4] ? `#${match[4]}` : '';

  return `${base}-${variant}${ext}${query}${hash}`;
}

/**
 * Process article image URLs to use the new CDN
 */
export function processArticleImageUrl(article: any): string {
  if (!article) return '';

  const extractFromHtml = (html?: string): string => {
    if (!html || typeof html !== 'string') return '';
    // Try src or data-src first
    const match =
      html.match(/<img[^>]+src=["']([^"']+)["']/i) ||
      html.match(/<img[^>]+data-src=["']([^"']+)["']/i);
    if (!match) return '';
    return match[1] || '';
  };

  // Check various possible image URL fields
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
    extractFromHtml(article.contentV2)
  ];

  // Find the first valid URL
  const imageUrl = possibleUrls.find(url => url && typeof url === 'string');

  if (!imageUrl) return '';

  // Replace CDN URL if needed
  return normalizeWordPressUploadUrl(imageUrl);
}
