import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ARTICLES_DIR = path.join(__dirname, '../All Articles');
const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL || 'http://localhost:3000/api';
const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY || '';

/**
 * Sanitize HTML content - convert HTML to plain text with markdown
 */
function sanitizeContent(htmlContent) {
  if (!htmlContent) return '';
  
  // Remove HTML tags but keep line breaks
  let text = htmlContent
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#039;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"');
  
  // Remove excessive whitespace
  text = text.replace(/\n\n+/g, '\n\n').trim();
  
  return text;
}

/**
 * Create article payload for Payload CMS
 */
function createArticlePayload(post, language = 'en') {
  // Extract categories
  let categories = [];
  if (post.categories && Array.isArray(post.categories)) {
    categories = post.categories
      .map(cat => (typeof cat === 'string' ? cat : cat.name))
      .filter(Boolean);
  }

  // Extract tags
  let tags = [];
  if (post.tags && Array.isArray(post.tags)) {
    tags = post.tags
      .map(tag => (typeof tag === 'string' ? tag : tag.name))
      .filter(Boolean);
  }

  return {
    title: post.title || 'Untitled',
    slug: post.slug || `post-${post.id}`,
    excerpt: sanitizeContent(post.excerpt).substring(0, 500),
    content: sanitizeContent(post.content),
    date: post.date ? new Date(post.date).toISOString() : new Date().toISOString(),
    language: language,
    featured_image_url: post.featured_image?.url || '',
    featured_image_alt: post.featured_image?.alt || 'Article featured image',
    status: 'published',
    author: post.author?.name || 'Bernard',
    categories: categories.length > 0 ? categories : undefined,
    tags: tags.length > 0 ? tags : undefined,
    source_url: post.link || '',
    published_at: post.date ? new Date(post.date).toISOString() : new Date().toISOString(),
  };
}

/**
 * Import articles from JSON files
 */
async function importArticles() {
  try {
    console.log('🚀 Starting article import to PayloadCMS...\n');
    
    // Read all JSON files
    const files = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.json'));
    console.log(`📁 Found ${files.length} JSON files in ${ARTICLES_DIR}\n`);
    
    let totalArticles = 0;
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Process each JSON file
    for (const file of files) {
      const filePath = path.join(ARTICLES_DIR, file);
      console.log(`📄 Processing ${file}...`);
      
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const posts = data.posts || [];
        
        console.log(`   Found ${posts.length} articles in ${file}`);
        totalArticles += posts.length;
        
        // Import each article
        for (const post of posts) {
          try {
            const articlePayload = createArticlePayload(post);
            
            // Determine language from lang field
            if (post.lang) {
              articlePayload.language = post.lang;
            }
            
            // Log import info (would make actual API call in production)
            console.log(`   ✓ Prepared: ${articlePayload.title.substring(0, 50)}...`);
            successCount++;
            
          } catch (error) {
            errorCount++;
            errors.push({
              file,
              article: post.title,
              error: error.message
            });
            console.error(`   ✗ Error importing article: ${error.message}`);
          }
        }
        
      } catch (error) {
        errorCount++;
        errors.push({
          file,
          error: error.message
        });
        console.error(`✗ Error reading ${file}: ${error.message}`);
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total articles found: ${totalArticles}`);
    console.log(`Successfully prepared: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\n❌ ERRORS:');
      errors.forEach(err => {
        console.log(`  - ${err.file}: ${err.error}`);
      });
    }
    
    console.log('\n✅ Import preparation complete!\n');
    
    // Save prepared data for manual import if needed
    const outputFile = path.join(__dirname, '../prepared-articles.json');
    const allArticles = [];
    
    for (const file of files) {
      const filePath = path.join(ARTICLES_DIR, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const posts = data.posts || [];
      
      for (const post of posts) {
        allArticles.push(createArticlePayload(post));
      }
    }
    
    fs.writeFileSync(outputFile, JSON.stringify(allArticles, null, 2));
    console.log(`💾 Prepared articles saved to: prepared-articles.json (${allArticles.length} articles)`);
    console.log('\n📝 Next steps:');
    console.log('1. Make sure PayloadCMS server is running: npm run payload');
    console.log('2. Visit: http://localhost:3000/admin');
    console.log('3. Manually import articles or use the REST API');
    console.log('4. Or run: npm run import:articles-payload');
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run import
importArticles();
