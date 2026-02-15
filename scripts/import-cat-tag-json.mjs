import fs from 'fs';
import path from 'path';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

// Load env from payload-admin
dotenv.config({ path: './payload-admin/.env' });

const dbUrl = process.env.DATABASE_URL || 'mongodb://localhost:27017/lcdb';
const client = new MongoClient(dbUrl);

async function importCategoriesAndLink() {
  try {
    await client.connect();
    console.log('✅ MongoDB connected');
    const db = client.db('lcdb');

    // Read cat_tag.json
    const catTagPath = './category/cat_tag.json';
    const catTagData = JSON.parse(fs.readFileSync(catTagPath, 'utf-8'));
    const { categories = [] } = catTagData;

    console.log(`📦 Found ${categories.length} categories in cat_tag.json`);

    // Map to store category name -> ObjectId
    const categoryMap = new Map();

    // 1. Upsert categories into DB
    console.log('📝 Upserting categories...');
    for (const cat of categories) {
      // Make slug unique by appending language if needed
      let slug = cat.slug;
      if (cat.language && cat.language !== 'en') {
        slug = `${cat.slug}-${cat.language}`;
      }

      const catDoc = {
        title: cat.name,
        slug: slug,
        term_id: cat.term_id,
        language: cat.language || 'en',
      };

      try {
        const result = await db.collection('categories').updateOne(
          { term_id: cat.term_id },
          { $set: catDoc },
          { upsert: true }
        );
      } catch (err) {
        // If duplicate key on slug, try to find and update existing
        if (err.code === 11000) {
          const existing = await db.collection('categories').findOne({ slug });
          if (existing) {
            await db.collection('categories').updateOne(
              { slug },
              { $set: { ...catDoc, term_id: cat.term_id } }
            );
          }
        } else {
          throw err;
        }
      }

      // Get the inserted/updated doc ID
      const doc = await db.collection('categories').findOne({ term_id: cat.term_id });
      if (doc) {
        categoryMap.set(cat.name.toLowerCase(), doc._id);
        categoryMap.set(cat.slug.toLowerCase(), doc._id);
      }
    }

    const savedCategories = await db.collection('categories').countDocuments();
    console.log(`✅ Upserted ${savedCategories} categories\n`);

    // 2. Link categories to articles with progress bar
    console.log('🔗 Linking categories to articles...');
    const articles = await db.collection('articles').find({}).toArray();
    console.log(`📄 Processing ${articles.length} articles\n`);

    let articlesUpdated = 0;
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      
      // Progress bar
      const progress = Math.round((i / articles.length) * 100);
      const filled = Math.round(progress / 5);
      const empty = 20 - filled;
      const bar = '█'.repeat(filled) + '░'.repeat(empty);
      process.stdout.write(`\r[${bar}] ${progress}% (${i}/${articles.length}) - ${articlesUpdated} linked`);

      try {
        if (!article.categories || article.categories.length === 0) {
          continue; // Skip articles without categories
        }

        // article.categories is already an array of ObjectIds or category names
        const newCategories = [];
        for (const catRef of article.categories) {
          let catId = null;

          // If it's already an ObjectId, keep it
          if (typeof catRef === 'object' && catRef._id) {
            catId = catRef._id;
          } else if (typeof catRef === 'string') {
            // Try to parse as ObjectId, or look up by name
            try {
              catId = new ObjectId(catRef);
            } catch (e) {
              // Not an ObjectId, try lookup by name/slug
              catId = categoryMap.get(catRef.toLowerCase());
            }
          }

          if (catId) {
            newCategories.push(catId);
          }
        }

        if (newCategories.length > 0) {
          await db.collection('articles').updateOne(
            { _id: article._id },
            { $set: { categories: newCategories } }
          );
          articlesUpdated++;
        }
      } catch (err) {
        console.warn(`\n⚠️ Error processing article ${article._id}:`, err.message);
        // Continue with next article
      }
    }

    console.log(`\n✅ Linked categories to ${articlesUpdated} articles\n`);

    // 3. Count articles per category
    console.log('📊 Category counts:');
    const categoriesWithCounts = await db.collection('categories').aggregate([
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
          term_id: 1,
          count: { $size: '$articles_in_category' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]).toArray();

    const catCount = await db.collection('categories').countDocuments();
    console.log(`\nTotal categories: ${catCount}\n`);
    
    for (const cat of categoriesWithCounts) {
      const titleDisplay = cat.title || '<No Name>';
      console.log(`  ${titleDisplay.padEnd(40)} (${cat.slug}) → ${cat.count} articles`);
    }

    console.log('\n✅ Import completed successfully!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

importCategoriesAndLink();
