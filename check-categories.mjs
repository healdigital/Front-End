import mongoose from 'mongoose';
import { config } from 'dotenv';

// Load env variables
config();

async function checkCategoryCounts() {
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

    // Check articles with categories containing "sweet", "Savory", or "Receta"
    const categories = ['sweet', 'Savory', 'Receta'];

    console.log('📊 Category Article Counts:\n');

    for (const category of categories) {
      // Case-insensitive search in category arrays
      const count = await articlesCollection.countDocuments({
        categories: {
          $elemMatch: {
            $regex: category,
            $options: 'i'
          }
        }
      });

      console.log(`${category}: ${count} articles`);
    }

    // Also check total articles
    const totalCount = await articlesCollection.countDocuments({});
    console.log(`\n📈 Total articles in database: ${totalCount}`);

    const categoriesCollection = db.collection('categories');

    // First, let's see what categories exist
    console.log('\n📋 All categories in database:');
    const allCategories = await categoriesCollection.find({}).toArray();

    const categoryMap = {};
    allCategories.forEach(cat => {
      categoryMap[cat._id.toString()] = cat.name || cat.title || 'Unknown';
      console.log(`${cat._id}: ${cat.name || cat.title || 'Unknown'}`);
    });

    // Now check for the specific categories the user asked about
    console.log('\n🎯 Checking for specific categories:');

    const targetCategories = ['sweet', 'Savory', 'Receta'];
    for (const targetCat of targetCategories) {
      // Find categories with names containing the target (case-insensitive)
      const matchingCategories = allCategories.filter(cat => {
        const catName = (cat.name || cat.title || '').toLowerCase();
        return catName.includes(targetCat.toLowerCase());
      });

      if (matchingCategories.length > 0) {
        console.log(`\n${targetCat} categories found:`);
        let totalArticles = 0;

        for (const cat of matchingCategories) {
          const catId = cat._id;
          const articleCount = await articlesCollection.countDocuments({
            categories: catId
          });
          totalArticles += articleCount;
          console.log(`  ${cat.name || cat.title} (${catId}): ${articleCount} articles`);
        }

        console.log(`  Total for "${targetCat}": ${totalArticles} articles`);
      } else {
        console.log(`${targetCat}: No matching categories found`);
      }
    }

    // Also show the most common categories
    console.log('\n📊 Most common categories:');
    const categoryCounts = {};

    for (const cat of allCategories) {
      const catId = cat._id.toString();
      const count = await articlesCollection.countDocuments({
        categories: cat._id
      });
      categoryCounts[cat.name || cat.title || 'Unknown'] = count;
    }

    // Sort by count descending
    const sortedCategories = Object.entries(categoryCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

    sortedCategories.forEach(([name, count]) => {
      console.log(`${name}: ${count} articles`);
    });

  } catch (error) {
    console.error('❌ Error checking category counts:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkCategoryCounts();