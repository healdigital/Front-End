import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE_URL = 'http://localhost:3000/api';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create or find author
async function getOrCreateAuthor(authorName) {
  try {
    if (!authorName || authorName.trim() === '') {
      return null;
    }

    // First try to find the author
    const searchResponse = await fetch(`${BASE_URL}/authors?where[name][equals]=${encodeURIComponent(authorName)}`);
    const searchData = await searchResponse.json();

    if (searchData.docs && searchData.docs.length > 0) {
      console.log(`  ✓ Found existing author: ${authorName}`);
      return searchData.docs[0].id;
    }

    // Create new author
    const authorPayload = {
      name: authorName,
      slug: authorName.toLowerCase().trim().replace(/\s+/g, '-'),
    };

    const createResponse = await fetch(`${BASE_URL}/authors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authorPayload),
    });

    if (createResponse.ok) {
      const authorData = await createResponse.json();
      console.log(`  ✓ Created new author: ${authorName}`);
      return authorData.id;
    } else {
      console.warn(`  ✗ Failed to create author: ${authorName}`);
      return null;
    }
  } catch (error) {
    console.error(`  ✗ Error with author "${authorName}":`, error.message);
    return null;
  }
}

// Create or find category
async function getOrCreateCategory(categoryName) {
  try {
    if (!categoryName || categoryName.trim() === '') {
      return null;
    }

    // First try to find the category
    const searchResponse = await fetch(`${BASE_URL}/categories?where[name][equals]=${encodeURIComponent(categoryName)}`);
    const searchData = await searchResponse.json();

    if (searchData.docs && searchData.docs.length > 0) {
      return searchData.docs[0].id;
    }

    // Create new category
    const categoryPayload = {
      name: categoryName,
      slug: categoryName.toLowerCase().trim().replace(/\s+/g, '-'),
    };

    const createResponse = await fetch(`${BASE_URL}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(categoryPayload),
    });

    if (createResponse.ok) {
      const categoryData = await createResponse.json();
      console.log(`    ✓ Created category: ${categoryName}`);
      return categoryData.id;
    } else {
      return null;
    }
  } catch (error) {
    console.error(`    ✗ Error with category "${categoryName}":`, error.message);
    return null;
  }
}

// Create or find tag
async function getOrCreateTag(tagName) {
  try {
    if (!tagName || tagName.trim() === '') {
      return null;
    }

    // First try to find the tag
    const searchResponse = await fetch(`${BASE_URL}/tags?where[name][equals]=${encodeURIComponent(tagName)}`);
    const searchData = await searchResponse.json();

    if (searchData.docs && searchData.docs.length > 0) {
      return searchData.docs[0].id;
    }

    // Create new tag
    const tagPayload = {
      name: tagName,
      slug: tagName.toLowerCase().trim().replace(/\s+/g, '-'),
    };

    const createResponse = await fetch(`${BASE_URL}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tagPayload),
    });

    if (createResponse.ok) {
      const tagData = await createResponse.json();
      return tagData.id;
    } else {
      return null;
    }
  } catch (error) {
    console.error(`    ✗ Error with tag "${tagName}":`, error.message);
    return null;
  }
}

// Process articles with relationships
async function importArticlesWithRelationships() {
  try {
    console.log('📖 Loading articles from All Articles folder...\n');
    
    // Read all JSON files from All Articles folder
    const articlesDir = path.join(path.dirname(__dirname), 'All Articles');
    const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.json'));
    
    console.log(`📂 Found ${files.length} JSON files to import\n`);
    
    let allArticles = [];
    
    // Load all JSON files
    for (const file of files) {
      try {
        const filePath = path.join(articlesDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Check if it's the posts array or single article
        if (data.posts && Array.isArray(data.posts)) {
          allArticles.push(...data.posts);
        } else if (Array.isArray(data)) {
          allArticles.push(...data);
        } else {
          allArticles.push(data);
        }
        console.log(`✓ Loaded: ${file}`);
      } catch (error) {
        console.error(`✗ Error loading ${file}:`, error.message);
      }
    }
    
    console.log(`\n📊 Total articles to process: ${allArticles.length}\n`);

    let successCount = 0;
    let errorCount = 0;
    const authorCache = {};
    const categoryCache = {};
    const tagCache = {};

    // Process articles with batching
    const BATCH_SIZE = 10;
    const BATCH_DELAY = 500; // 500ms between batches

    for (let i = 0; i < allArticles.length; i++) {
      const article = allArticles[i];

      try {
        // Get or create author
        let authorId = null;
        if (article.author) {
          const authorName = typeof article.author === 'string' ? article.author : article.author.name;
          if (authorName && !authorCache[authorName]) {
            authorCache[authorName] = await getOrCreateAuthor(authorName);
          }
          authorId = authorName ? authorCache[authorName] : null;
        }

        // Get or create categories
        let categoryIds = [];
        if (article.categories && Array.isArray(article.categories)) {
          for (const cat of article.categories) {
            const catName = typeof cat === 'string' ? cat : cat.name;
            if (catName && !categoryCache[catName]) {
              categoryCache[catName] = await getOrCreateCategory(catName);
            }
            if (catName && categoryCache[catName]) {
              categoryIds.push(categoryCache[catName]);
            }
          }
        }

        // Get or create tags
        let tagIds = [];
        if (article.tags && Array.isArray(article.tags)) {
          for (const tag of article.tags) {
            const tagName = typeof tag === 'string' ? tag : tag.name;
            if (tagName && !tagCache[tagName]) {
              tagCache[tagName] = await getOrCreateTag(tagName);
            }
            if (tagName && tagCache[tagName]) {
              tagIds.push(tagCache[tagName]);
            }
          }
        }

        // Prepare article with relationships - use slug from JSON
        const articlePayload = {
          title: article.title,
          slug: article.slug, // Use slug from JSON directly
          language: article.lang || article.language || 'en',
          date: article.date,
          excerpt: article.excerpt,
          content: article.content,
          featured_image: article.featured_image,
          inline_images: article.inline_images,
          author: authorId || undefined,
          categories: categoryIds.length > 0 ? categoryIds : undefined,
          tags: tagIds.length > 0 ? tagIds : undefined,
        };

        // Remove undefined fields
        Object.keys(articlePayload).forEach(
          key => articlePayload[key] === undefined && delete articlePayload[key]
        );

        // Send to API
        const response = await fetch(`${BASE_URL}/articles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(articlePayload),
        });

        if (response.ok) {
          successCount++;
          if ((i + 1) % 10 === 0) {
            process.stdout.write(`\r[${i + 1}/${allArticles.length}] ✓`);
          }
        } else {
          errorCount++;
          const error = await response.text();
          console.error(`\n❌ Article ${i + 1} (${article.slug}) failed:`, error.substring(0, 100));
        }

        // Rate limiting - delay after every 10 articles
        if ((i + 1) % BATCH_SIZE === 0 && i + 1 < allArticles.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }

      } catch (error) {
        errorCount++;
        console.error(`\n❌ Error processing article ${i + 1}:`, error.message);
      }
    }

    console.log('\n\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY WITH RELATIONSHIPS');
    console.log('='.repeat(60));
    console.log(`✅ Successfully imported: ${successCount} articles`);
    console.log(`❌ Failed: ${errorCount} articles`);
    console.log(`👤 Authors created/found: ${Object.keys(authorCache).length}`);
    console.log(`📁 Categories created/found: ${Object.keys(categoryCache).length}`);
    console.log(`🏷️  Tags created/found: ${Object.keys(tagCache).length}`);
    console.log('='.repeat(60));
    
    if (successCount === allArticles.length) {
      console.log('\n✨ All articles imported successfully with relationships!');
    }

  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the import
console.log('\n' + '='.repeat(60));
console.log('🚀 IMPORTING ARTICLES WITH AUTHOR/CATEGORY/TAG RELATIONSHIPS');
console.log('='.repeat(60) + '\n');

importArticlesWithRelationships().then(() => {
  console.log('\n✅ Import process completed!\n');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Import failed:', error);
  process.exit(1);
});
