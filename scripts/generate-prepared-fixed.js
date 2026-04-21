#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const DESKTOP = process.env.HOME || process.env.USERPROFILE || process.env.USERPROFILE;
const OUTPUT_DIR = path.join(DESKTOP, 'Desktop', 'LCDB-Prepared-JSON');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'prepared-articles-FIXED.json');

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log('Created folder:', OUTPUT_DIR);
  }

  if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in .env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();
  const collection = db.collection('articles');

  console.log('Fetching all published articles from MongoDB...');
  const articles = await collection
    .find({ _status: 'published' })
    .sort({ date: -1 })
    .toArray();

  console.log(`Found ${articles.length} articles`);

  const toText = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val !== null) {
      if (Array.isArray(val)) {
        return val.map(toText).join(' ');
      }
      if (val.children) {
        return toText(val.children);
      }
      if (val.text) return val.text;
      return JSON.stringify(val);
    }
    return String(val);
  };

  const normalizeSlug = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val !== null) {
      return val.current || val.raw || val.default || JSON.stringify(val);
    }
    return String(val);
  };

  const getImageUrl = (article) => {
    const candidates = [
      article.featuredMedia?.url,
      article.featuredMedia?.sizes?.articleHero?.url,
      article.featuredMedia?.sizes?.gallery?.url,
      article.featuredImage?.url,
      article.featuredImage?.sizes?.articleHero?.url,
      article.featuredImage?.sizes?.gallery?.url,
      article.featured_image?.url,
      article.featured_image_url,
      article.featuredImageUrl,
    ];
    for (const c of candidates) {
      if (c && typeof c === 'string' && c.trim()) return c.trim();
    }
    return '';
  };

  const repairDeepStrings = (obj) => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') {
      let s = obj;
      try { s = decodeURIComponent(s); } catch {}
      return s
        .replace(/\uFFFD/g, '')
        .replace(/[\u0000-\u001F]+/g, '')
        .replace(/\uFFE8/g, '\n')
        .replace(/\uFFE9/g, '\n')
        .replace(/\\u00([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    }
    if (typeof obj === 'object') {
      if (Array.isArray(obj)) return obj.map(repairDeepStrings);
      const result = {};
      for (const [k, v] of Object.entries(obj)) {
        try { result[k] = repairDeepStrings(v); } catch { result[k] = v; }
      }
      return result;
    }
    return obj;
  };

  const output = articles.map((a) => {
    const slug = normalizeSlug(a.slug);
    const title = toText(a.title);
    const content = toText(a.content);
    const excerpt = toText(a.excerpt);
    const imageUrl = getImageUrl(a);

    return repairDeepStrings({
      _id: a._id?.toString(),
      slug,
      lang: a.lang || a.language || 'fr',
      title,
      content,
      excerpt,
      date: a.date || a.createdAt,
      author: a.author ? {
        id: typeof a.author === 'object' && a.author !== null ? (a.author.id || a.author._id?.toString()) : a.author,
        name: typeof a.author === 'object' && a.author !== null ? (a.author.name || 'Bernard Laurance') : 'Bernard Laurance',
        slug: typeof a.author === 'object' && a.author !== null ? (a.author.slug || null) : null,
        email: typeof a.author === 'object' && a.author !== null ? (a.author.email || null) : null,
      } : { id: null, name: 'Bernard Laurance', slug: null, email: null },
      categories: Array.isArray(a.categories) ? a.categories.map(c => ({
        id: typeof c === 'object' && c !== null ? (c.id || c._id?.toString() || c.value) : c,
        name: typeof c === 'object' && c !== null ? (c.name || c.title || c.label) : c,
        slug: typeof c === 'object' && c !== null ? normalizeSlug(c.slug || c.value) : c,
      })) : [],
      tags: Array.isArray(a.tags) ? a.tags.map(t => ({
        id: typeof t === 'object' && t !== null ? (t.id || t._id?.toString() || t.value) : t,
        name: typeof t === 'object' && t !== null ? (t.name || t.title || t.label) : t,
        slug: typeof t === 'object' && t !== null ? normalizeSlug(t.slug || t.value) : t,
      })) : [],
      featured_image: imageUrl ? {
        id: a.featuredMedia?.id || a.featuredImage?.id || null,
        url: imageUrl,
        width: a.featuredMedia?.width || a.featuredImage?.width || null,
        height: a.featuredMedia?.height || a.featuredImage?.height || null,
        alt: toText(a.featuredMedia?.alt || a.featuredImage?.alt || title) || title,
      } : { id: null, url: '', width: null, height: null, alt: '' },
      featuredImage: a.featuredMedia ? {
        url: a.featuredMedia.url,
        sizes: a.featuredMedia.sizes,
        alt: toText(a.featuredMedia.alt),
      } : {},
      recipeBlocks: Array.isArray(a.recipeBlocks) ? a.recipeBlocks : undefined,
    });
  });

  const outputJson = JSON.stringify(output, null, 2);
  fs.writeFileSync(OUTPUT_PATH, outputJson, 'utf8');

  console.log(`\nDone! Wrote ${output.length} articles to:`);
  console.log(OUTPUT_PATH);
  console.log(`File size: ${(fs.statSync(OUTPUT_PATH).size / 1024 / 1024).toFixed(2)} MB`);

  const withContent = output.filter(a => a.content && a.content.length > 50);
  const withRecipe = output.filter(a => a.recipeBlocks && a.recipeBlocks.length > 0);
  const withImage = output.filter(a => a.featured_image?.url);

  console.log(`\nStats:`);
  console.log(`  With content (>50 chars): ${withContent.length}`);
  console.log(`  With recipeBlocks: ${withRecipe.length}`);
  console.log(`  With image: ${withImage.length}`);

  await client.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});