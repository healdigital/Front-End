import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const preparedPath = path.join(process.cwd(), 'prepared-articles.json');
const newExportPath = path.join(process.cwd(), '.tmp', 'wp_export_new.json');
const outputPath = path.join(process.cwd(), '.tmp', 'merged-articles.json');

function normalizeString(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripWprmPrefix(slug) {
  if (!slug) return '';
  slug = String(slug);
  if (slug.startsWith('wprm-')) return slug.slice(5);
  if (slug.startsWith('wprm_')) return slug.slice(5);
  return slug;
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
    // Check URL path segments for language code
    try {
      const url = new URL(permalink);
      const path = url.pathname.toLowerCase();
      // Check first path segment after leading slash
      const firstSegment = path.split('/')[1] || '';
      if (firstSegment === 'en') return 'en';
      if (firstSegment === 'es') return 'es';
      if (firstSegment === 'ar') return 'ar';
      if (firstSegment === 'pt-br') return 'pt-br';
      // Default to fr if path starts with /fr/ or no match
      if (firstSegment === 'fr' || path.includes('/fr/')) return 'fr';
    } catch {
      // Fallback to string matching
      if (permalink.toLowerCase().includes('/en/')) return 'en';
      if (permalink.toLowerCase().includes('/es/')) return 'es';
      if (permalink.toLowerCase().includes('/ar/')) return 'ar';
      if (permalink.toLowerCase().includes('/pt-br/')) return 'pt-br';
    }
  }
  return 'fr';
}

// Not used - using post_type directly
function isWprmRecipe(post) {
  return post.post?.post_type === 'wprm_recipe';
}

function transformWpPostToPrepared(post) {
  const permalink = post.permalink || '';
  const slug = extractSlugFromPermalink(permalink);
  const title = post.post_title || '';
  // post.post is the full WP post object; content is in post_content
  const content = post.post?.post_content || '';
  const postId = post.id || post.ID || '';
  const lang = detectLanguage(permalink);
  
  // Featured image
  let featuredImage = { id: null, url: '', alt: '' };
  if (post.featured?.url) {
    featuredImage = {
      id: post.featured.id || null,
      url: post.featured.url,
      alt: post.featured.alt || title,
    };
  }
  
  // Categories & tags
  const categories = (post.terms?.category || []).map((cat) => ({
    id: (cat.term_id || cat.id || '').toString(),
    name: cat.name || cat.title || '',
    slug: cat.slug || '',
  })).filter(c => c.name);
  
  const tags = (post.terms?.post_tag || []).map((tag) => ({
    id: (tag.term_id || tag.id || '').toString(),
    name: tag.name || tag.title || '',
    slug: tag.slug || '',
  })).filter(t => t.name);
  
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
    featuredImage: { url: featuredImage.url, alt: featuredImage.alt },
    recipeBlocks: isWprmRecipe(post) ? [] : undefined, // Placeholder - will be filled if WPRM
    _wprmRaw: isWprmRecipe(post) ? content : undefined, // Store raw WPRM content for later parsing
  };
}

function getArticleKey(article) {
  let slug = article.slug || '';
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
  const newPosts = Array.isArray(rawExport.posts) ? rawExport.posts : [];
  
  console.log(`\nInitial counts:`);
  console.log(`  prepared-articles.json: ${prepared.length} articles`);
  console.log(`  wp_export_new.json: ${newPosts.length} posts`);
  
  // Categorize by post_type (not by shortcode)
  const standardPosts = newPosts.filter(p => p.post?.post_type === 'post');
  const wprmPosts = newPosts.filter(p => p.post?.post_type === 'wprm_recipe');
  
  console.log(`\nNew export breakdown (by post_type):`);
  console.log(`  Standard posts (type='post'): ${standardPosts.length}`);
  console.log(`  WPRM recipes (type='wprm_recipe'): ${wprmPosts.length}`);
  
  // Transform ALL new posts to prepared format
  const transformedStandard = standardPosts.map(transformWpPostToPrepared);
  const transformedWprm = wprmPosts.map(transformWpPostToPrepared);
  
  // Build existing keys from prepared (excluding WPRM-only entries)
  const existingSlugLangs = new Set();
  const existingTitleLangs = new Set();
  const existingIds = new Set();
  
  for (const article of prepared) {
    const key = getArticleKey(article);
    if (key.slug && key.lang) existingSlugLangs.add(`${key.slug}|||${key.lang}`);
    if (key.title && key.lang) existingTitleLangs.add(`${key.title}|||${key.lang}`);
    if (key.id) existingIds.add(key.id);
  }
  
  console.log(`\nExisting keys (from prepared-articles):`);
  console.log(`  Slug+Lang combos: ${existingSlugLangs.size}`);
  console.log(`  Title+Lang combos: ${existingTitleLangs.size}`);
  console.log(`  IDs: ${existingIds.size}`);
  
  // Filter standard posts (remove duplicates with prepared)
  const filteredStandard = [];
  let removedStdSlugLang = 0, removedStdTitleLang = 0, removedStdId = 0;
  
  for (const article of transformedStandard) {
    const key = getArticleKey(article);
    const slugLangKey = `${key.slug}|||${key.lang}`;
    const titleLangKey = `${key.title}|||${key.lang}`;
    
    const slugLangMatch = existingSlugLangs.has(slugLangKey);
    const titleLangMatch = existingTitleLangs.has(titleLangKey);
    const idMatch = key.id && existingIds.has(key.id);
    
    if (idMatch || slugLangMatch || titleLangMatch) {
      if (slugLangMatch) removedStdSlugLang++;
      if (titleLangMatch && !slugLangMatch) removedStdTitleLang++;
      if (idMatch) removedStdId++;
    } else {
      filteredStandard.push(article);
    }
  }
  
  console.log(`\nStandard articles filter:`);
  console.log(`  Total: ${transformedStandard.length}`);
  console.log(`  Removed (duplicates): ${transformedStandard.length - filteredStandard.length}`);
  console.log(`    By slug+lang: ${removedStdSlugLang}`);
  console.log(`    By title+lang: ${removedStdTitleLang}`);
  console.log(`    By ID: ${removedStdId}`);
  console.log(`  Remaining: ${filteredStandard.length}`);
  
  // For WPRM recipes: check duplicates based on slug+lang and ID
  const filteredWprm = [];
  let removedWprmSlugLang = 0, removedWprmId = 0;
  
  for (const article of transformedWprm) {
    const key = getArticleKey(article);
    const slugLangKey = `${key.slug}|||${key.lang}`;
    
    const slugLangMatch = existingSlugLangs.has(slugLangKey);
    const idMatch = key.id && existingIds.has(key.id);
    
    if (idMatch || slugLangMatch) {
      if (slugLangMatch) removedWprmSlugLang++;
      if (idMatch) removedWprmId++;
    } else {
      filteredWprm.push(article);
    }
  }
  
  console.log(`\nWPRM recipes filter:`);
  console.log(`  Total: ${transformedWprm.length}`);
  console.log(`  Removed (duplicates): ${transformedWprm.length - filteredWprm.length}`);
  console.log(`    By slug+lang: ${removedWprmSlugLang}`);
  console.log(`    By ID: ${removedWprmId}`);
  console.log(`  Remaining: ${filteredWprm.length}`);
  
  // Merge: prepared + filteredStandard + filteredWprm
  const merged = [
    ...prepared,
    ...filteredStandard,
    ...filteredWprm,
  ];
  
  console.log(`\nFinal merge:`);
  console.log(`  From prepared-articles: ${prepared.length}`);
  console.log(`  + New standard articles: ${filteredStandard.length}`);
  console.log(`  + New WPRM recipes: ${filteredWprm.length}`);
  console.log(`  = Total: ${merged.length}`);
  
  // Verify breakdown
  const finalStandard = merged.filter(a => !a._wprmRaw);
  const finalWprm = merged.filter(a => !!a._wprmRaw);
  console.log(`\nFinal breakdown:`);
  console.log(`  Standard articles: ${finalStandard.length}`);
  console.log(`  WPRM recipes: ${finalWprm.length}`);
  console.log(`  Total: ${merged.length}`);
  
  // Save merged
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2), 'utf8');
  console.log(`\nMerged file saved to:`);
  console.log(outputPath);
  
  // Save report
  const report = {
    preparedCount: prepared.length,
    newExportTotal: newPosts.length,
    newStandard: standardPosts.length,
    newWprm: wprmPosts.length,
    addedStandard: filteredStandard.length,
    addedWprm: filteredWprm.length,
    removedStandardDuplicate: transformedStandard.length - filteredStandard.length,
    removedWprmDuplicate: transformedWprm.length - filteredWprm.length,
    finalTotal: merged.length,
    finalStandard: finalStandard.length,
    finalWprm: finalWprm.length,
  };
  
  fs.writeFileSync(
    path.join(outputDir, 'merge-report.json'),
    JSON.stringify(report, null, 2),
    'utf8'
  );
  console.log(`Report saved to: ${path.join(outputDir, 'merge-report.json')}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
