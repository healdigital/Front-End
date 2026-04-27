import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const wpExportPath = path.join(process.cwd(), '.tmp', 'wp_export_new.json');
const outputPath = path.join(process.cwd(), 'prepared-articles-FULL.json');

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
    // Fallback
    if (permalink.toLowerCase().includes('/en/')) return 'en';
    if (permalink.toLowerCase().includes('/es/')) return 'es';
    if (permalink.toLowerCase().includes('/ar/')) return 'ar';
    if (permalink.toLowerCase().includes('/pt-br/')) return 'pt-br';
  }
  return 'fr';
}

function parseWprmShortcodes(content) {
  // Extract WPRM recipe data from shortcode attributes
  const recipeBlocks = [];
  
  // Match [wprm-recipe-xxx ...] shortcodes
  const shortcodeRegex = /\[wprm-recipe-(.+?)\]/g;
  let match;
  
  while ((match = shortcodeRegex.exec(content)) !== null) {
    const shortcodeContent = match[0];
    const blockType = match[1];
    
    // Parse attributes
    const attrs = {};
    const attrRegex = /(\w+)=["']([^"']*)["']/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(shortcodeContent)) !== null) {
      attrs[attrMatch[1]] = attrMatch[2];
    }
    
    recipeBlocks.push({
      blockType: `wprm_${blockType}`,
      ...attrs,
    });
  }
  
  return recipeBlocks.length > 0 ? recipeBlocks : undefined;
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
  
  // Detect if WPRM recipe
  const postType = post.post?.post_type || '';
  const isWprm = postType === 'wprm_recipe';
  
  // For WPRM posts, try to extract recipe data from content or meta
  let recipeBlocks = undefined;
  if (isWprm) {
    recipeBlocks = parseWprmShortcodes(content);
    // If no shortcodes found, create minimal recipe block
    if (!recipeBlocks) {
      recipeBlocks = [{
        blockType: 'wprm_recipe',
        name: title,
        summary: post.post_excerpt || '',
      }];
    }
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
    _postType: postType, // Keep for reference
  };
}

async function main() {
  console.log('Loading wp_export_new.json...');
  const rawExport = JSON.parse(fs.readFileSync(wpExportPath, 'utf8'));
  const allPosts = Array.isArray(rawExport.posts) ? rawExport.posts : [];
  
  console.log(`Total posts: ${allPosts.length}`);
  
  // Separate by type
  const standardPosts = allPosts.filter(p => p.post?.post_type === 'post');
  const wprmPosts = allPosts.filter(p => p.post?.post_type === 'wprm_recipe');
  
  console.log(`  Standard (post): ${standardPosts.length}`);
  console.log(`  WPRM (wprm_recipe): ${wprmPosts.length}`);
  
  // Transform all to prepared format
  const transformedStandard = standardPosts.map(transformWpPostToPrepared);
  const transformedWprm = wprmPosts.map(transformWpPostToPrepared);
  
  // Merge all together (no deduplication against old prepared)
  const merged = [
    ...transformedStandard,
    ...transformedWprm,
  ];
  
  // Breakdown
  const finalStandard = merged.filter(a => !a.recipeBlocks || a.recipeBlocks.length === 0);
  const finalWprm = merged.filter(a => a.recipeBlocks && a.recipeBlocks.length > 0);
  
  console.log(`\nFinal prepared-articles.json would contain:`);
  console.log(`  Standard articles: ${finalStandard.length}`);
  console.log(`  WPRM recipes: ${finalWprm.length}`);
  console.log(`  Total: ${merged.length}`);
  
  // Count by language
  const byLang = {};
  for (const a of merged) {
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
  
  fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2), 'utf8');
  console.log(`\nSaved to: ${outputPath}`);
  console.log(`File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
