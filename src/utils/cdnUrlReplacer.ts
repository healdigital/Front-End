/**
 * Utility function to replace CDN URLs for images
 * Replaces old CDN with new DigitalOcean Spaces CDN
 */

const DEFAULT_PAYLOAD_API_URL =
  (typeof process !== 'undefined' &&
    (process.env.PUBLIC_PAYLOAD_API_URL || process.env.PUBLIC_TRANSLATE_API_URL)) ||
  'https://admin.lacuisinedebernard.com/api';
const DIGITALOCEAN_SPACES_ORIGIN = 'https://lcdb.fra1.digitaloceanspaces.com';
const LEGACY_WP_UPLOADS_ORIGINS = [
  'https://lacuisinedebernard.com',
  'http://lacuisinedebernard.com',
  'https://www.lacuisinedebernard.com',
  'http://www.lacuisinedebernard.com',
  'https://cdn.lacuisinedebernard.com',
  'http://cdn.lacuisinedebernard.com',
];

const getPayloadOrigin = (): string => {
  try {
    return new URL(DEFAULT_PAYLOAD_API_URL).origin;
  } catch {
    return 'https://admin.lacuisinedebernard.com';
  }
};

export function replaceCdnUrl(url: string): string {
  if (!url) return url;

  if (typeof url !== 'string') return url;

  if (url.startsWith('/api/') || url.startsWith('/media/')) {
    return `${getPayloadOrigin()}${url}`;
  }

  if (url.startsWith('api/')) {
    return `${getPayloadOrigin()}/${url}`;
  }

  if (url.startsWith('media/')) {
    return `${getPayloadOrigin()}/${url}`;
  }

  let normalized = url;

  for (const legacyOrigin of LEGACY_WP_UPLOADS_ORIGINS) {
    if (normalized.startsWith(`${legacyOrigin}/wp-content/uploads/`)) {
      normalized = normalized.replace(`${legacyOrigin}/wp-content/uploads/`, `${DIGITALOCEAN_SPACES_ORIGIN}/wp-content/uploads/`);
      break;
    }
  }

  return normalized.replace(
    'https://cdn.lacuisinedebernard.com/',
    `${DIGITALOCEAN_SPACES_ORIGIN}/`
  );
}

/**
 * Build a smaller square variant URL for WordPress uploads.
 * Many imported assets include generated square derivatives (e.g. -500x500).
 */
export function buildWpSquareVariantUrl(url: string, size = 500): string {
  if (!url || typeof url !== 'string') return '';

  const normalized = replaceCdnUrl(url);
  if (!/\/wp-content\/uploads\//i.test(normalized)) return normalized;

  const match = normalized.match(/^(.+?)(\.(?:jpe?g|png|webp|avif))(?:\?([^#]+))?(?:#(.+))?$/i);
  if (!match) return normalized;

  const base = match[1];
  const ext = match[2];
  const query = match[3] ? `?${match[3]}` : '';
  const hash = match[4] ? `#${match[4]}` : '';

  // Keep explicit size variants as-is.
  if (/-\d+x\d+$/i.test(base)) {
    return `${base}${ext}${query}${hash}`;
  }

  // WordPress "-scaled" originals are usually very large; prefer square preview.
  const withoutScaled = base.replace(/-scaled$/i, '');
  return `${withoutScaled}-${size}x${size}${ext}${query}${hash}`;
}

/**
 * Build a portrait-friendly WordPress derivative URL (non-cropped).
 * For "-scaled" originals this prefers the common 797x1024 variant.
 */
export function buildWpPortraitVariantUrl(url: string, variant = '797x1024'): string {
  if (!url || typeof url !== 'string') return '';

  const normalized = replaceCdnUrl(url);
  if (!/\/wp-content\/uploads\//i.test(normalized)) return normalized;

  const match = normalized.match(/^(.+?)(\.(?:jpe?g|png|webp|avif))(?:\?([^#]+))?(?:#(.+))?$/i);
  if (!match) return normalized;

  const base = match[1];
  const ext = match[2];
  const query = match[3] ? `?${match[3]}` : '';
  const hash = match[4] ? `#${match[4]}` : '';

  // Keep explicit size variants as-is.
  if (/-\d+x\d+$/i.test(base)) {
    return `${base}${ext}${query}${hash}`;
  }

  const withoutScaled = base.replace(/-scaled$/i, '');
  return `${withoutScaled}-${variant}${ext}${query}${hash}`;
}

/**
 * Process article image URLs to use the new CDN
 */
export function processArticleImageUrl(article: any): string {
  if (!article) return '';

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
  ];

  // Find the first valid URL
  const imageUrl = possibleUrls.find(url => url && typeof url === 'string');

  if (!imageUrl) return '';

  // Replace CDN URL if needed
  return replaceCdnUrl(imageUrl);
}
