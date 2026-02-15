import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, ObjectId } from 'mongodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lcdb';
const DB_NAME = 'lcdb';

async function importDirectToMongoDB() {
  const client = new MongoClient(MONGODB_URI);

  try {
    console.log('🔗 Connecting to MongoDB...');
    await client.connect();
    const db = client.db(DB_NAME);
    
    console.log('✅ Connected to MongoDB');
    console.log(`📦 Database: ${DB_NAME}\n`);

    // Read all JSON files from All Articles folder
    const articlesDir = path.join(path.dirname(__dirname), 'All Articles');
    const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.json'));
    
    console.log(`📂 Found ${files.length} JSON files\n`);

    let allArticles = [];
    const authorsMap = {};
    const categoriesMap = {};
    const tagsMap = {};

    // Load all articles from JSON files
    for (const file of files) {
      const filePath = path.join(articlesDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (data.posts && Array.isArray(data.posts)) {
        allArticles.push(...data.posts);
      } else if (Array.isArray(data)) {
        allArticles.push(...data);
      } else {
        allArticles.push(data);
      }
    }

    console.log(`📊 Total articles loaded: ${allArticles.length}\n`);

    // Get or create author
    async function getOrCreateAuthor(authorName) {
      if (!authorName) return null;

      if (authorsMap[authorName]) {
        return authorsMap[authorName];
      }

      const existing = await db.collection('authors').findOne({ name: authorName });
      if (existing) {
        authorsMap[authorName] = existing._id;
        return existing._id;
      }

      const result = await db.collection('authors').insertOne({
        name: authorName,
        slug: authorName.toLowerCase().trim().replace(/\s+/g, '-'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      authorsMap[authorName] = result.insertedId;
      console.log(`  ✓ Created author: ${authorName}`);
      return result.insertedId;
    }

    // Get or create category
    async function getOrCreateCategory(categoryName) {
      if (!categoryName) return null;

      if (categoriesMap[categoryName]) {
        return categoriesMap[categoryName];
      }

      const existing = await db.collection('categories').findOne({ name: categoryName });
      if (existing) {
        categoriesMap[categoryName] = existing._id;
        return existing._id;
      }

      const result = await db.collection('categories').insertOne({
        name: categoryName,
        slug: categoryName.toLowerCase().trim().replace(/\s+/g, '-'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      categoriesMap[categoryName] = result.insertedId;
      console.log(`    ✓ Created category: ${categoryName}`);
      return result.insertedId;
    }

    // Get or create tag
    async function getOrCreateTag(tagName) {
      if (!tagName) return null;

      if (tagsMap[tagName]) {
        return tagsMap[tagName];
      }

      const existing = await db.collection('tags').findOne({ name: tagName });
      if (existing) {
        tagsMap[tagName] = existing._id;
        return existing._id;
      }

      const result = await db.collection('tags').insertOne({
        name: tagName,
        slug: tagName.toLowerCase().trim().replace(/\s+/g, '-'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      tagsMap[tagName] = result.insertedId;
      return result.insertedId;
    }

    // Import articles
    console.log('📖 Processing articles with relationships...\n');
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < allArticles.length; i++) {
      const article = allArticles[i];

      try {
        // Get author ID
        let authorId = null;
        if (article.author) {
          const authorName = typeof article.author === 'string' ? article.author : article.author.name;
          authorId = await getOrCreateAuthor(authorName);
        }

        // Get category IDs
        let categoryIds = [];
        if (article.categories && Array.isArray(article.categories)) {
          for (const cat of article.categories) {
            const catName = typeof cat === 'string' ? cat : cat.name;
            const catId = await getOrCreateCategory(catName);
            if (catId) categoryIds.push(catId);
          }
        }

        // Get tag IDs
        let tagIds = [];
        if (article.tags && Array.isArray(article.tags)) {
          for (const tag of article.tags) {
            const tagName = typeof tag === 'string' ? tag : tag.name;
            const tagId = await getOrCreateTag(tagName);
            if (tagId) tagIds.push(tagId);
          }
        }

        // Prepare article document
        const articleDoc = {
          title: article.title,
          slug: article.slug,
          language: article.lang || article.language || 'en',
          date: article.date ? new Date(article.date) : new Date(),
          excerpt: article.excerpt || '',
          content: article.content || '',
          featuredImage: article.featured_image || null,
          inlineImages: article.inline_images || [],
          author: authorId,
          categories: categoryIds.length > 0 ? categoryIds : [],
          tags: tagIds.length > 0 ? tagIds : [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Insert article
        const result = await db.collection('articles').updateOne(
          { slug: article.slug },
          { $set: articleDoc },
          { upsert: true }
        );

        successCount++;
        if ((i + 1) % 100 === 0) {
          console.log(`  [${i + 1}/${allArticles.length}] ✓`);
        }
      } catch (error) {
        errorCount++;
        console.error(`  ❌ Article ${i + 1}: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully imported: ${successCount} articles`);
    console.log(`❌ Failed: ${errorCount} articles`);
    console.log(`👤 Authors: ${Object.keys(authorsMap).length}`);
    console.log(`📁 Categories: ${Object.keys(categoriesMap).length}`);
    console.log(`🏷️  Tags: ${Object.keys(tagsMap).length}`);
    console.log('='.repeat(60));

    if (successCount === allArticles.length) {
      console.log('\n✨ All articles imported successfully!');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ MongoDB connection closed');
  }
}

console.log('\n' + '='.repeat(60));
console.log('🚀 DIRECT MONGODB IMPORT');
console.log('='.repeat(60) + '\n');

importDirectToMongoDB().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Import failed:', error);
  process.exit(1);
});
