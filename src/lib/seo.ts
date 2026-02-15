export interface SEOMetadata {
  title: string;
  description: string;
  image?: string;
  url?: string;
  author?: string;
  keywords?: string[];
}

export function generateSeoMetadata(data: SEOMetadata): SEOMetadata {
  return {
    title: data.title,
    description: data.description,
    image: data.image,
    url: data.url,
    author: data.author,
    keywords: data.keywords || []
  };
}

export function buildUrl(path: string, baseUrl: string = ''): string {
  if (!baseUrl) return path;
  return new URL(path, baseUrl).toString();
}

export function sanitizeDescription(text: string, maxLength: number = 160): string {
  return text.substring(0, maxLength).trim() + (text.length > maxLength ? '...' : '');
}
