import { payloadFetch } from '../lib/payload.client';
import { getAllArticlesFromMongo } from '../lib/mongo.server';
import { BUILD_ONLY_ARTICLE_PAGES } from '../utils/buildFlags';

export async function GET() {
  const baseUrl = import.meta.env.PUBLIC_SITE_URL || 'https://lacuisinedebernard.com';
  const urls = [];
  const today = new Date().toISOString().split('T')[0];
  const includeCategoryAndTagRoutes = !BUILD_ONLY_ARTICLE_PAGES;

  // Root home
  urls.push({
    loc: `${baseUrl}/`,
    priority: '1.0',
    changefreq: 'daily',
    lastmod: today,
  });

  // Search page
  urls.push({
    loc: `${baseUrl}/search`,
    priority: '0.8',
    changefreq: 'weekly',
    lastmod: today,
  });

  if (includeCategoryAndTagRoutes) {
    urls.push({
      loc: `${baseUrl}/categories`,
      priority: '0.9',
      changefreq: 'weekly',
      lastmod: today,
    });

    urls.push({
      loc: `${baseUrl}/tags`,
      priority: '0.9',
      changefreq: 'weekly',
      lastmod: today,
    });
  }

  // Fetch all articles (Mongo first, Payload fallback)
  let articles: any[] = [];
  try {
    articles = await getAllArticlesFromMongo();
  } catch (err) {
    console.warn('[SITEMAP] Mongo fetch failed, falling back to Payload', err);
  }

  if (!articles?.length) {
    try {
      const res: any = await payloadFetch({
        collection: 'articles',
        query: { depth: 1, limit: 6000 },
      });
      articles = res?.docs || res || [];
    } catch (err) {
      console.error('[SITEMAP] Payload fetch failed', err);
    }
  }

  if (Array.isArray(articles)) {
    articles.forEach((article: any) => {
      const slug = typeof article.slug === 'string' ? article.slug : article.slug?.current;
      if (!slug) return;
      urls.push({
        loc: `${baseUrl}/${slug}`,
        priority: '0.8',
        changefreq: 'weekly',
        lastmod: article.modified || article.updated || article.date || today,
      });
    });
  }

  if (includeCategoryAndTagRoutes) {
    // Fetch categories from Payload (optional)
    try {
      const catRes: any = await payloadFetch({
        collection: 'categories',
        query: { depth: 0, limit: 500 },
      });
      const categories = catRes?.docs || catRes || [];
      categories.forEach((cat: any) => {
        const slug = typeof cat.slug === 'string' ? cat.slug : cat.slug?.current;
        if (!slug) return;
        urls.push({
          loc: `${baseUrl}/categories/${slug}`,
          priority: '0.7',
          changefreq: 'weekly',
          lastmod: today,
        });
      });
    } catch (err) {
      console.warn('[SITEMAP] Categories fetch skipped', err);
    }

    // Fetch tags from Payload (optional)
    try {
      const tagRes: any = await payloadFetch({
        collection: 'tags',
        query: { depth: 0, limit: 500 },
      });
      const tags = tagRes?.docs || tagRes || [];
      tags.forEach((tag: any) => {
        const slug = typeof tag.slug === 'string' ? tag.slug : tag.slug?.current;
        if (!slug) return;
        urls.push({
          loc: `${baseUrl}/tags/${slug}`,
          priority: '0.7',
          changefreq: 'weekly',
          lastmod: today,
        });
      });
    } catch (err) {
      console.warn('[SITEMAP] Tags fetch skipped', err);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
