import mongoose from 'mongoose';
import { config } from 'dotenv';

// Load env variables
config();

async function checkCategories() {
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
    const categories = await db.collection('categories').find({}).limit(10).toArray();

    console.log('Categories in MongoDB:');
    categories.forEach(cat => {
      console.log(`ID: ${cat._id}, Name: ${cat.name}, category_id: ${cat.category_id}, slug: ${cat.slug}`);
    });

    const total = await db.collection('categories').countDocuments();
    console.log(`Total categories: ${total}`);

    await connection.disconnect();
    console.log('🔌 Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkCategories();