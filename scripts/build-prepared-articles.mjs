import fs from 'fs';
import path from 'path';

async function run() {
  const dir = path.join(process.cwd(), 'All Articles');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const articles = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const data = JSON.parse(raw);
    const posts = Array.isArray(data.posts) ? data.posts : [];

    for (const p of posts) {
      const slug = typeof p.slug === 'string' ? p.slug : p.slug?.current || '';
      if (!slug) continue;

      articles.push({
        _id: p._id || p.id || undefined,
        slug,
        title: p.title,
        content: p.content,
        excerpt: p.excerpt,
        date: p.date || p.published_at || p.createdAt,
        updated: p.updated || p.updatedAt,
        author: p.author,
        categories: p.categories,
        tags: p.tags,
        featured_img_url: p.featured_img_url,
        featured_image: p.featured_image,
        featuredImageUrl: p.featuredImageUrl,
        lang: p.lang,
      });
    }
  }

  const seen = new Set();
  const deduped = [];
  for (const a of articles) {
    if (seen.has(a.slug)) continue;
    seen.add(a.slug);
    deduped.push(a);
  }

  fs.writeFileSync(path.join(process.cwd(), 'prepared-articles.json'), JSON.stringify(deduped, null, 2));
  console.log(`Wrote ${deduped.length} articles to prepared-articles.json`);
}

run();
