import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const preparedPath = path.join(process.cwd(), 'prepared-articles.json');
const newExportPath = path.join(process.cwd(), '.tmp', 'wp_export_new.json');
const outputPath = path.join(process.cwd(), '.tmp', 'wp_export_new-filtered.json');

function normalizeString(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Strip WPRM prefix from slug (e.g., "wprm-sorbet-aux-peches" -> "sorbet-aux-peches")
function stripWprmPrefix(slug) {
  if (!slug) return '';
  slug = String(slug);
  // Remove "wprm-" prefix if present
  if (slug.startsWith('wprm-')) {
    return slug.slice(5);
  }
  // Also handle "wprm_" underscore variant
  if (slug.startsWith('wprm_')) {
    return slug.slice(5);
  }
  return slug;
}

// Extract slug from permalink URL
function extractSlugFromPermalink(permalink) {
  if (!permalink) return '';
  try {
    const url = new URL(permalink);
    const pathname = url.pathname;
    // Remove trailing slash and get last segment
    const segments = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    return segments[segments.length - 1] || '';
  } catch {
    // Fallback: simple string extraction
    const match = permalink.match(/\/([^\/]+)\/?$/);
    return match ? match[1] : '';
  }
}

// Detect language from URL or assume default
function detectLanguage(permalink, post) {
  // Try to get from permalink subdomain or path
  if (permalink) {
    if (permalink.includes('/fr/') || permalink.includes('fr.')) return 'fr';
    if (permalink.includes('/en/') || permalink.includes('en.')) return 'en';
    if (permalink.includes('/es/') || permalink.includes('es.')) return 'es';
    if (permalink.includes('/ar/') || permalink.includes('ar.')) return 'ar';
    if (permalink.includes('/pt-') || permalink.includes('pt-br')) return 'pt-br';
  }
  // Check post_name or slug field if exists
  if (post?.post_name) {
    // Could have language prefix in post_name?
  }
  return 'fr'; // default
}

function transformWpExportToPrepared(post) {
  const permalink = post.permalink || '';
  const slug = extractSlugFromPermalink(permalink);
  const title = post.post_title || '';
  const content = post.post || '';
  const postId = post.id || post.ID || '';
  const lang = detectLanguage(permalink, post);
  
  // Extract featured image
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
  
  // Extract categories
  const categories = (post.terms?.category || []).map((cat) => ({
    id: (cat.term_id || cat.id || '').toString(),
    name: cat.name || cat.title || '',
    slug: cat.slug || '',
  })).filter(c => c.name);
  
  // Extract tags
  const tags = (post.terms?.post_tag || []).map((tag) => ({
    id: (tag.term_id || tag.id || '').toString(),
    name: tag.name || tag.title || '',
    slug: tag.slug || '',
  })).filter(t => t.name);
  
  // Date
  const date = post.post_modified || post.post_date || '';
  
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
    featuredImage: {
      url: featuredImage.url,
      alt: featuredImage.alt,
    },
    recipeBlocks: undefined, // Not in WP export
  };
}

function getArticleKey(article) {
  let slug = article.slug || '';
  // Strip WPRM prefix if present
  slug = stripWprmPrefix(slug);
  
  const title = article.title || '';
  const id = article._id || '';
  const lang = article.lang || 'fr';
  
  return {
    slug: normalizeString(slug),
    title: normalizeString(title),
    id: String(id || '').trim(),
    lang: normalizeString(lang),
  };
}

async function main() {
  console.log('Loading prepared-articles.json...');
  const prepared = JSON.parse(fs.readFileSync(preparedPath, 'utf8'));
  
  console.log('Loading wp_export_new.json...');
  const rawExport = JSON.parse(fs.readFileSync(newExportPath, 'utf8'));
  const newExportPosts = Array.isArray(rawExport.posts) ? rawExport.posts : [];
  
  console.log(`\nRaw counts:`);
  console.log(`  prepared-articles.json: ${prepared.length} articles`);
  console.log(`  wp_export_new.json: ${newExportPosts.length} posts`);
  
  // Transform new export to prepared format
  console.log('\nTransforming new export to prepared-articles format...');
  const transformed = newExportPosts.map(transformWpExportToPrepared);
  
  // Build sets from prepared
  const existingSlugLangs = new Set();
  const existingTitleLangs = new Set();
  const existingIds = new Set();
  
  for (const article of prepared) {
    const key = getArticleKey(article);
    if (key.slug && key.lang) existingSlugLangs.add(`${key.slug}|||${key.lang}`);
    if (key.title && key.lang) existingTitleLangs.add(`${key.title}|||${key.lang}`);
    if (key.id) existingIds.add(key.id);
  }
  
  console.log(`\nExisting keys in prepared-articles:`);
  console.log(`  Slug+Lang combos: ${existingSlugLangs.size}`);
  console.log(`  Title+Lang combos: ${existingTitleLangs.size}`);
  console.log(`  IDs: ${existingIds.size}`);
  
  // Filter transformed
  const filtered = [];
  const removedSlugLangs = [];
  const removedTitleLangs = [];
  const removedIds = [];
  
  for (const article of transformed) {
    const key = getArticleKey(article);
    const slugLangKey = `${key.slug}|||${key.lang}`;
    const titleLangKey = `${key.title}|||${key.lang}`;
    
    const slugLangMatch = existingSlugLangs.has(slugLangKey);
    const titleLangMatch = existingTitleLangs.has(titleLangKey);
    const idMatch = key.id && existingIds.has(key.id);
    
    if (idMatch || slugLangMatch || titleLangMatch) {
      if (slugLangMatch) removedSlugLangs.push(slugLangKey);
      if (titleLangMatch && !slugLangMatch) removedTitleLangs.push(titleLangKey);
      if (idMatch) removedIds.push(key.id);
    } else {
      filtered.push(article);
    }
  }
  
  console.log(`\nNew export transformed: ${transformed.length} articles`);
  console.log(`After removing duplicates: ${filtered.length} articles`);
  console.log(`Removed by slug+lang: ${removedSlugLangs.length}`);
  console.log(`Removed by title+lang: ${removedTitleLangs.length}`);
  console.log(`Removed by ID: ${removedIds.length}`);
  console.log(`Total removed: ${transformed.length - filtered.length}`);
  
  if (removedSlugLangs.length > 0) {
    console.log('\nSample removed (slug+lang):');
    removedSlugLangs.slice(0, 5).forEach(s => console.log(`  ${s}`));
  }
  
  // Save filtered result
  fs.writeFileSync(outputPath, JSON.stringify(filtered, null, 2), 'utf8');
  console.log(`\nSaved ${filtered.length} unique articles to:`);
  console.log(outputPath);
  
  // Also save a report
  const report = {
    totalInNewExport: newExportPosts.length,
    totalAfterTransform: transformed.length,
    duplicatesRemoved: transformed.length - filtered.length,
    remaining: filtered.length,
    removedBy: {
      slugLang: removedSlugLangs.length,
      titleLang: removedTitleLangs.length,
      id: removedIds.length,
    },
  };
  fs.writeFileSync(
    path.join(outputDir, 'wp_export_new-filtered-report.json'),
    JSON.stringify(report, null, 2),
    'utf8'
  );
  console.log(`Report saved to: ${path.join(outputDir, 'wp_export_new-filtered-report.json')}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
