import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function showCounts() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not set in .env');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const categories = db.collection('categories');

  const top = await categories.find({}, { projection: { name: 1, slug: 1, articleCount: 1 } }).sort({ articleCount: -1 }).limit(10).toArray();

  console.log('\nTop categories by articleCount:');
  top.forEach((c, i) => {
    console.log(`${i+1}. ${c.name || c.slug || c._id} — ${c.articleCount || 0}`);
  });

  const totalWith = await categories.countDocuments({ articleCount: { $gt: 0 } });
  const totalAll = await categories.countDocuments({});
  console.log(`\nCategories with articles: ${totalWith} / ${totalAll}`);

  await mongoose.disconnect();
}

showCounts().catch(err => { console.error(err); process.exit(1); });
