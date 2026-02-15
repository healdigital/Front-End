import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables
config();

async function mapCategoriesToArticles() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found');
    }

    console.log('🔌 Connecting to MongoDB...');
    const connection = await mongoose.connect(mongoUri, {
      dbName: 'lcdb'
    });

    const db = connection.connection.db;
    console.log('✅ Connected to MongoDB');

    // Read the JSON file
    const jsonData = JSON.parse(readFileSync('./category/all_cat_with_articles.json', 'utf8'));
    console.log(`📊 Processing ${jsonData.total_categories} categories across ${jsonData.total_languages} languages`);

    let totalArticlesUpdated = 0;
    let totalCategoriesProcessed = 0;

    // Process each category
    for (const category of jsonData.categories) {
      console.log(`\n🔄 Processing category: ${category.category_name} (${category.language}) - ${category.post_count} posts`);

      // Find the category in MongoDB by name and language (construct slug pattern)
      let slugPattern;
      if (category.language === 'en') {
        slugPattern = `${category.category_slug}-en`;
      } else if (category.language === 'fr') {
        slugPattern = category.category_slug;
      } else if (category.language === 'es') {
        slugPattern = `${category.category_slug}-es`;
      } else if (category.language === 'pt-br') {
        slugPattern = `${category.category_slug}-pt-br`;
      } else if (category.language === 'ar') {
        slugPattern = category.category_slug;
      }

      const mongoCategory = await db.collection('categories').findOne({
        name: category.category_name,
        slug: slugPattern
      });

      if (!mongoCategory) {
        console.log(`❌ Category not found in MongoDB: ${category.category_name} (expected slug: ${slugPattern})`);
        continue;
      }

      console.log(`✅ Found category in MongoDB: ${mongoCategory.name} (ObjectId: ${mongoCategory._id})`);

      // Process each post in the category
      for (const post of category.posts) {
        try {
          // Find the article by slug
          const article = await db.collection('articles').findOne({
            slug: post.slug
          });

          if (!article) {
            console.log(`❌ Article not found: ${post.title} (slug: ${post.slug})`);
            continue;
          }

          // Check if category is already assigned
          const hasCategory = article.categories?.some((catId) =>
            catId.toString() === mongoCategory._id.toString()
          );

          if (hasCategory) {
            console.log(`⏭️  Article already has category: ${post.title}`);
            continue;
          }

          // Update the article to include this category
          const currentCategories = article.categories || [];
          const updatedCategories = [...currentCategories, mongoCategory._id];

          await db.collection('articles').updateOne(
            { _id: article._id },
            { $set: { categories: updatedCategories } }
          );

          console.log(`✅ Updated article: ${post.title} - added category ${category.category_name}`);
          totalArticlesUpdated++;

        } catch (error) {
          console.error(`❌ Error processing article ${post.title}:`, error);
        }
      }

      totalCategoriesProcessed++;
      console.log(`📈 Category ${category.category_name} processed. Total articles updated so far: ${totalArticlesUpdated}`);
    }

    console.log(`\n🎉 Mapping complete!`);
    console.log(`📊 Categories processed: ${totalCategoriesProcessed}`);
    console.log(`📝 Articles updated: ${totalArticlesUpdated}`);

    await connection.disconnect();
    console.log('🔌 Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the script
mapCategoriesToArticles().catch(console.error);