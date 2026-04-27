import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const wpExportPath = path.join(process.cwd(), '.tmp', 'wp_export_new.json');
const outputPath = path.join(process.cwd(), 'prepared-articles.json');

function normalizeString(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSlugFromPermalink(permalink) {
  if (!permalink) return '';
  try {
    const url = new URL(permalink);
    const segments = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    return segments[segments.length - 1] || '';
  } catch {
    const match = permalink.match(/\/([^\/]+)\/?$/);
    return match ? match[1] : '';
  }
}

function detectLanguage(permalink) {
  if (permalink) {
    try {
      const url = new URL(permalink);
      const path = url.pathname.toLowerCase();
      const firstSegment = path.split('/')[1] || '';
      if (firstSegment === 'en') return 'en';
      if (firstSegment === 'es') return 'es';
      if (firstSegment === 'ar') return 'ar';
      if (firstSegment === 'pt-br') return 'pt-br';
      if (firstSegment === 'fr' || path.includes('/fr/')) return 'fr';
    } catch {}
    if (permalink.toLowerCase().includes('/en/')) return 'en';
    if (permalink.toLowerCase().includes('/es/')) return 'es';
    if (permalink.toLowerCase().includes('/ar/')) return 'ar';
    if (permalink.toLowerCase().includes('/pt-br/')) return 'pt-br';
  }
  return 'fr';
}

function transformWpPostToPrepared(post) {
  const permalink = post.permalink || '';
  const slug = extractSlugFromPermalink(permalink);
  const title = post.post_title || '';
  const content = post.post?.post_content || '';
  const postId = post.id || post.ID || '';
  const lang = detectLanguage(permalink);
  
  // Featured image
  let featuredImage = { id: null, url: '', alt: '', width: null, height: null };
  if (post.featured?.url) {
    featuredImage = {
      id: post.featured.id || null,
      url: post.featured.url,
      alt: post.featured.alt || title,
      width: post.featured.width || null,
      height: post.featured.height || null,
    };
  }
  
  // Categories
  const categories = (post.terms?.category || []).map((cat) => ({
    id: (cat.term_id || cat.id || '').toString(),
    name: cat.name || cat.title || '',
    slug: cat.slug || '',
  })).filter(c => c.name);
  
  // Tags
  const tags = (post.terms?.post_tag || []).map((tag) => ({
    id: (tag.term_id || tag.id || '').toString(),
    name: tag.name || tag.title || '',
    slug: tag.slug || '',
  })).filter(t => t.name);
  
  const date = post.post_modified || post.post_date || '';
  
  // WPRM detection
  const postType = post.post?.post_type || '';
  const isWprm = postType === 'wprm_recipe';
  
  // For WPRM, we'll keep content as-is (it has embedded recipe)
  // The frontend will parse WPRM shortcodes from content
  let recipeBlocks = undefined;
  if (isWprm) {
    // Mark as WPRM recipe - actual recipe data will be extracted from HTML content
    recipeBlocks = [{
      blockType: 'wprm_recipe',
      source: 'wp_export',
    }];
  }
  
  return {
    _id: postId,
    slug,
    lang,
    title,
    content,
    excerpt: post.post_excerpt || '',
    date,
    author: post.author ? {
      id: post.author.id || '',
      name: post.author.display_name || 'Bernard Laurance',
      slug: '',
      email: post.author.user_email || '',
    } : { id: null, name: 'Bernard Laurance', slug: null, email: null },
    categories,
    tags,
    featured_image: featuredImage,
    featuredImage: { url: featuredImage.url, alt: featuredImage.alt },
    recipeBlocks,
    _postType: postType,
    _source: 'wp_export_new',
  };
}

function getSortKey(post) {
  // Prefer newer dates, then higher IDs (more recent)
  const date = new Date(post.date || post.post_modified || 0).getTime();
  const id = parseInt(post._id || '0', 10);
  return { date, id };
}

async function main() {
  console.log('Loading wp_export_new.json...');
  const rawExport = JSON.parse(fs.readFileSync(wpExportPath, 'utf8'));
  const allPosts = Array.isArray(rawExport.posts) ? rawExport.posts : [];
  
  console.log(`Total posts in export: ${allPosts.length}`);
  
  // Transform all
  const transformed = allPosts.map(transformWpPostToPrepared);
  
  console.log(`Transformed: ${transformed.length}`);
  
  // Deduplicate by slug+lang - keep only the most recent per slug+lang
  const seen = new Map();
  const duplicatesRemoved = [];
  
  for (const post of transformed) {
    const key = `${post.slug}|${post.lang}`;
    if (seen.has(key)) {
      duplicatesRemoved.push(post);
    } else {
      seen.set(key, post);
    }
  }
  
  const deduped = Array.from(seen.values());
  
  console.log(`\nDeduplication:`);
  console.log(`  Original: ${transformed.length}`);
  console.log(`  Duplicates removed: ${duplicatesRemoved.length}`);
  console.log(`  Final unique: ${deduped.length}`);
  
  // Breakdown by type
  const wprm = deduped.filter(a => a._postType === 'wprm_recipe');
  const standard = deduped.filter(a => a._postType === 'post');
  
  console.log(`\nFinal breakdown:`);
  console.log(`  Standard articles: ${standard.length}`);
  console.log(`  WPRM recipes: ${wprm.length}`);
  console.log(`  Total: ${deduped.length}`);
  
  // By language
  const byLang = {};
  for (const a of deduped) {
    const lang = a.lang || 'fr';
    byLang[lang] = (byLang[lang] || 0) + 1;
  }
  console.log(`\nBy language:`);
  for (const [lang, count] of Object.entries(byLang)) {
    console.log(`  ${lang}: ${count}`);
  }
  
  // Save
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  fs.writeFileSync(outputPath, JSON.stringify(deduped, null, 2), 'utf8');
  console.log(`\nSaved to: ${outputPath}`);
  console.log(`File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
  
  // Stats
  const withRecipeBlocks = deduped.filter(a => a.recipeBlocks && a.recipeBlocks.length > 0);
  const withContent = deduped.filter(a => a.content && a.content.length > 100);
  const withImage = deduped.filter(a => a.featured_image?.url);
  
  console.log(`\nContent stats:`);
  console.log(`  With recipeBlocks: ${withRecipeBlocks.length}`);
  console.log(`  With substantial content (>100 chars): ${withContent.length}`);
  console.log(`  With featured image: ${withImage.length}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
