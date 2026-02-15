import mongoose from 'mongoose';
import { config } from 'dotenv';
import fs from 'fs';

// Load env variables
config();

async function mapCategoriesToArticles() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    console.log('🔌 Connecting to MongoDB...');
    const connection = await mongoose.connect(mongoUri, {
      dbName: 'lcdb'
    });
    console.log('✅ MongoDB connected');

    const db = connection.connection.db;
    if (!db) throw new Error('No database connection');

    const articlesCollection = db.collection('articles');
    const categoriesCollection = db.collection('categories');

    // Read the JSON file
    console.log('📖 Reading category mapping file...');
    const jsonData = JSON.parse(fs.readFileSync('./category/all_cat_with_articles.json', 'utf8'));

    // Get all categories from database
    console.log('📋 Loading categories from database...');
    const dbCategories = await categoriesCollection.find({}).toArray();
    const categoryMap = new Map();

    dbCategories.forEach(cat => {
      const name = cat.name || cat.title;
      if (name) {
        categoryMap.set(name.toLowerCase(), cat._id);
      }
    });

    console.log(`Found ${dbCategories.length} categories in database`);

    // Process each category from JSON
    let totalProcessed = 0;
    let totalUpdated = 0;

    for (const categoryData of jsonData.categories) {
      const categoryName = categoryData.category_name;
      const language = categoryData.language;
      const postCount = categoryData.post_count;

      console.log(`\n🔄 Processing category: ${categoryName} (${language}) - ${postCount} posts`);

      // Find the category ObjectId
      const categoryId = categoryMap.get(categoryName.toLowerCase());
      if (!categoryId) {
        console.log(`❌ Category "${categoryName}" not found in database`);
        continue;
      }

      console.log(`✅ Found category ID: ${categoryId}`);

      // Process each post in this category
      for (const post of categoryData.posts) {
        totalProcessed++;

        // URL-decode the slug
        const decodedSlug = decodeURIComponent(post.slug);
        console.log(`  📝 Processing post: "${post.title}" (slug: ${decodedSlug})`);

        // Find the article in MongoDB by slug
        const article = await articlesCollection.findOne({ slug: decodedSlug });

        if (!article) {
          console.log(`  ❌ Article not found for slug: ${decodedSlug}`);
          continue;
        }

        // Check if category is already assigned
        const currentCategories = article.categories || [];
        const hasCategory = currentCategories.some(catId =>
          catId.toString() === categoryId.toString()
        );

        if (hasCategory) {
          console.log(`  ⏭️  Category already assigned to article: ${article.title}`);
          continue;
        }

        // Add the category to the article
        const updatedCategories = [...currentCategories, categoryId];

        await articlesCollection.updateOne(
          { _id: article._id },
          { $set: { categories: updatedCategories } }
        );

        totalUpdated++;
        console.log(`  ✅ Added category "${categoryName}" to article: ${article.title}`);
      }
    }

    console.log(`\n🎉 Category mapping completed!`);
    console.log(`📊 Total posts processed: ${totalProcessed}`);
    console.log(`📈 Total articles updated: ${totalUpdated}`);

    // Verification: Count articles per category
    console.log(`\n🔍 Verification - Articles per category:`);
    for (const [catName, catId] of categoryMap) {
      const count = await articlesCollection.countDocuments({
        categories: catId
      });
      if (count > 0) {
        console.log(`${catName}: ${count} articles`);
      }
    }

  } catch (error) {
    console.error('❌ Error mapping categories:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

mapCategoriesToArticles();