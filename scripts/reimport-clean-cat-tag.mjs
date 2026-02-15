import fs from 'fs';
import path from 'path';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: './payload-admin/.env' });

const dbUrl = process.env.DATABASE_URL || 'mongodb://localhost:27017/lcdb';
const client = new MongoClient(dbUrl);

// Decode URL-encoded strings properly
function decodeSlug(slug) {
  try {
    // Replace %XX with proper decoding
    return decodeURIComponent(slug);
  } catch (e) {
    return slug;
  }
}

async function cleanAndReimport() {
  try {
    await client.connect();
    console.log('✅ MongoDB connected\n');
    const db = client.db('lcdb');

    // 1. Clear collections
    console.log('🧹 Clearing collections...');
    await db.collection('categories').deleteMany({});
    console.log('  ✓ Cleared categories');
    await db.collection('tags').deleteMany({});
    console.log('  ✓ Cleared tags');
    
    // Reset article categories/tags
    await db.collection('articles').updateMany(
      {},
      { $set: { categories: [], tags: [] } }
    );
    console.log('  ✓ Reset article references\n');

    // 2. Read and prepare category/tag data
    console.log('📖 Reading cat_tag.json...');
    const catTagPath = './category/cat_tag.json';
    const catTagData = JSON.parse(fs.readFileSync(catTagPath, 'utf-8'));
    const { categories = [], tags = [] } = catTagData;

    console.log(`  Found ${categories.length} categories and ${tags.length} tags\n`);

    // 3. Import categories with decoded names
    console.log('📝 Importing categories...');
    const categoryMap = new Map(); // term_id -> MongoDB _id
    const categoryBySlug = new Map(); // slug -> MongoDB _id

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      
      // Decode slug and name
      const decodedSlug = decodeSlug(cat.slug);
      const decodedName = cat.name;

      const catDoc = {
        title: decodedName,
        slug: decodedSlug,
        term_id: cat.term_id,
        language: cat.language || 'en',
      };

      try {
        // Try upsert by term_id
        const result = await db.collection('categories').updateOne(
          { term_id: cat.term_id },
          { $set: catDoc },
          { upsert: true }
        );

        // Get the ID
        const doc = await db.collection('categories').findOne({ term_id: cat.term_id });
        if (doc) {
          categoryMap.set(cat.term_id, doc._id);
          categoryBySlug.set(decodedSlug.toLowerCase(), doc._id);
        }

        // Progress
        if ((i + 1) % 10 === 0 || i === categories.length - 1) {
          process.stdout.write(`\r  [${i + 1}/${categories.length}] categories imported`);
        }
      } catch (err) {
        console.error(`\n  ❌ Error importing category ${cat.name}:`, err.message);
      }
    }
    console.log(`\n  ✓ Imported ${categories.length} categories\n`);

    // 4. Import tags with decoded names
    console.log('📝 Importing tags...');
    const tagMap = new Map(); // term_id -> MongoDB _id
    const tagBySlug = new Map(); // slug -> MongoDB _id

    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      
      // Decode slug and name
      const decodedSlug = decodeSlug(tag.slug);
      const decodedName = tag.name;

      const tagDoc = {
        title: decodedName,
        slug: decodedSlug,
        term_id: tag.term_id,
        language: tag.language || 'en',
      };

      try {
        const result = await db.collection('tags').updateOne(
          { term_id: tag.term_id },
          { $set: tagDoc },
          { upsert: true }
        );

        const doc = await db.collection('tags').findOne({ term_id: tag.term_id });
        if (doc) {
          tagMap.set(tag.term_id, doc._id);
          tagBySlug.set(decodedSlug.toLowerCase(), doc._id);
        }

        if ((i + 1) % 10 === 0 || i === tags.length - 1) {
          process.stdout.write(`\r  [${i + 1}/${tags.length}] tags imported`);
        }
      } catch (err) {
        console.error(`\n  ❌ Error importing tag ${tag.name}:`, err.message);
      }
    }
    console.log(`\n  ✓ Imported ${tags.length} tags\n`);

    // 5. Link categories to articles
    console.log('🔗 Linking categories to articles...');
    const articles = await db.collection('articles').find({}).toArray();
    console.log(`  Processing ${articles.length} articles\n`);

    let articlesLinked = 0;
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];

      try {
        // Get categories from article if they exist
        let newCategories = [];
        
        // If article has post_categories field, map them
        if (article.post_categories && article.post_categories.length > 0) {
          for (const catId of article.post_categories) {
            if (categoryMap.has(catId)) {
              newCategories.push(categoryMap.get(catId));
            }
          }
        }

        // If article has tags field referencing category term_ids, map them
        if (article.categories && Array.isArray(article.categories)) {
          for (const cat of article.categories) {
            const catId = typeof cat === 'number' ? cat : cat;
            if (categoryMap.has(catId)) {
              const objId = categoryMap.get(catId);
              if (!newCategories.includes(objId)) {
                newCategories.push(objId);
              }
            }
          }
        }

        if (newCategories.length > 0) {
          await db.collection('articles').updateOne(
            { _id: article._id },
            { $set: { categories: newCategories } }
          );
          articlesLinked++;
        }

        // Progress bar
        const progress = Math.round((i / articles.length) * 100);
        const filled = Math.round(progress / 5);
        const empty = 20 - filled;
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        process.stdout.write(`\r  [${bar}] ${progress}% (${i}/${articles.length})`);
      } catch (err) {
        console.warn(`\n  ⚠️ Error linking article ${article._id}:`, err.message);
      }
    }
    console.log(`\n  ✓ Linked ${articlesLinked} articles to categories\n`);

    // 6. Show summary with counts
    console.log('📊 Final Summary:\n');
    
    const catWithCounts = await db.collection('categories').aggregate([
      {
        $lookup: {
          from: 'articles',
          localField: '_id',
          foreignField: 'categories',
          as: 'articles_in_category'
        }
      },
      {
        $project: {
          title: 1,
          slug: 1,
          count: { $size: '$articles_in_category' }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();

    const tagWithCounts = await db.collection('tags').aggregate([
      {
        $lookup: {
          from: 'articles',
          localField: '_id',
          foreignField: 'tags',
          as: 'articles_in_tag'
        }
      },
      {
        $project: {
          title: 1,
          slug: 1,
          count: { $size: '$articles_in_tag' }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();

    console.log('📂 Categories:');
    for (const cat of catWithCounts.slice(0, 15)) {
      const title = (cat.title || '<No Name>').padEnd(40);
      console.log(`  ${title} → ${cat.count} articles`);
    }
    if (catWithCounts.length > 15) {
      console.log(`  ... and ${catWithCounts.length - 15} more`);
    }

    console.log('\n🏷️  Top Tags:');
    for (const tag of tagWithCounts.slice(0, 10)) {
      const title = (tag.title || '<No Name>').padEnd(40);
      console.log(`  ${title} → ${tag.count} articles`);
    }
    if (tagWithCounts.length > 10) {
      console.log(`  ... and ${tagWithCounts.length - 10} more`);
    }

    const totalCats = await db.collection('categories').countDocuments();
    const totalTags = await db.collection('tags').countDocuments();
    const totalArticles = await db.collection('articles').countDocuments();

    console.log(`\n✅ Import completed successfully!`);
    console.log(`  Categories: ${totalCats}`);
    console.log(`  Tags: ${totalTags}`);
    console.log(`  Articles: ${totalArticles}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

cleanAndReimport();
