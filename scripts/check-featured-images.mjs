import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function checkFeaturedImages() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const articlesCollection = db.collection('articles');

    // Check what fields are in articles
    console.log('\n📊 Checking articles collection...');
    const sampleArticle = await articlesCollection.findOne();
    
    if (sampleArticle) {
      console.log('\n🔎 Sample Article Fields:');
      console.log('ID:', sampleArticle._id);
      console.log('Title:', sampleArticle.title);
      console.log('Has featured_img_url:', !!sampleArticle.featured_img_url);
      console.log('featured_img_url value:', sampleArticle.featured_img_url?.substring(0, 100) || 'N/A');
      console.log('Has featured_image:', !!sampleArticle.featured_image);
      console.log('featured_image value:', sampleArticle.featured_image);
      console.log('\n🔑 All article keys:', Object.keys(sampleArticle).filter(k => !k.startsWith('_')));
    }

    // Count articles with featured_img_url
    const withFeaturedUrl = await articlesCollection.countDocuments({ featured_img_url: { $exists: true, $ne: null } });
    console.log(`\n📈 Articles with featured_img_url: ${withFeaturedUrl}`);

    // Count articles with featured_image
    const withFeaturedImage = await articlesCollection.countDocuments({ featured_image: { $exists: true, $ne: null } });
    console.log(`📈 Articles with featured_image: ${withFeaturedImage}`);

    // Show a few examples
    console.log('\n🎯 Sample featured_img_url values:');
    const samples = await articlesCollection.find({ featured_img_url: { $exists: true, $ne: null } }).limit(3).toArray();
    samples.forEach((article, i) => {
      console.log(`${i + 1}. ${article.title.substring(0, 50)}...`);
      console.log(`   URL: ${article.featured_img_url.substring(0, 80)}...`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Check complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkFeaturedImages();
