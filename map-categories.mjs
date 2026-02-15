import mongoose from 'mongoose';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

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
    const jsonData = JSON.parse(readFileSync('./category/all_cat_with_articles.json', 'utf8'));

    console.log('📊 Processing categories from JSON...');

    // Find Sweet and Savory categories
    const sweetCategory = jsonData.categories.find((cat) =>
      cat.category_name === 'Sweet' && cat.language === 'en'
    );
    const savoryCategory = jsonData.categories.find((cat) =>
      cat.category_name === 'Savory' && cat.language === 'en'
    );

    console.log('Sweet category:', sweetCategory ? `${sweetCategory.category_name} (${sweetCategory.post_count} posts)` : 'Not found');
    console.log('Savory category:', savoryCategory ? `${savoryCategory.category_name} (${savoryCategory.post_count} posts)` : 'Not found');

    if (!sweetCategory || !savoryCategory) {
      console.log('❌ Required categories not found in JSON');
      return;
    }

    // Get MongoDB category IDs for Sweet and Savory
    const sweetMongoCat = await categoriesCollection.findOne({ name: 'Sweet' });
    const savoryMongoCat = await categoriesCollection.findOne({ name: 'Savory' });

    console.log('\n🔍 MongoDB Categories:');
    console.log('Sweet Mongo ID:', sweetMongoCat?._id?.toString());
    console.log('Savory Mongo ID:', savoryMongoCat?._id?.toString());

    // Count current articles in these categories
    if (sweetMongoCat) {
      const sweetCount = await articlesCollection.countDocuments({
        categories: sweetMongoCat._id
      });
      console.log(`\nSweet articles in MongoDB: ${sweetCount}`);
    }

    if (savoryMongoCat) {
      const savoryCount = await articlesCollection.countDocuments({
        categories: savoryMongoCat._id
      });
      console.log(`Savory articles in MongoDB: ${savoryCount}`);
    }

    // Show sample articles from JSON
    console.log('\n📋 Sample Sweet articles from JSON:');
    sweetCategory.posts.slice(0, 3).forEach((post) => {
      console.log(`- ${post.title} (${post.slug})`);
    });

    console.log('\n📋 Sample Savory articles from JSON:');
    savoryCategory.posts.slice(0, 3).forEach((post) => {
      console.log(`- ${post.title} (${post.slug})`);
    });

  } catch (error) {
    console.error('❌ Error mapping categories:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

mapCategoriesToArticles();