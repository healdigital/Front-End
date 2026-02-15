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
