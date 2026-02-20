/**
 * Utility function to replace CDN URLs for images
 * Replaces old CDN with new DigitalOcean Spaces CDN
 */

export function replaceCdnUrl(url: string): string {
  if (!url) return url;

  // Replace the old CDN URL with the new DigitalOcean Spaces URL
  return url.replace(
    'https://cdn.lacuisinedebernard.com/',
    'https://lcdb.fra1.digitaloceanspaces.com/'
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
    article.featuredMedia?.url,
    article.featuredMedia?.value?.url,
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
  return replaceCdnUrl(imageUrl);
}
