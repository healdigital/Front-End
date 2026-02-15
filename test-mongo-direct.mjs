import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function testDirectMongoDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const articles = db.collection('articles');
    
    // Get one article with featured_img_url
    const article = await articles.findOne({ featured_img_url: { $exists: true } });
    
    if (article) {
      console.log('\n📊 MongoDB Document:');
      console.log('Title:', article.title);
      console.log('featured_img_url:', article.featured_img_url?.substring(0, 100) + '...');
      console.log('\nAll fields:', Object.keys(article).filter(k => !k.startsWith('_')));
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

testDirectMongoDB();
