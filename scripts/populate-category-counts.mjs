import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function populateCounts() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not set in .env');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const articles = db.collection('articles');
  const categories = db.collection('categories');

  // Build counts map
  const cursor = articles.find({}, { projection: { categories: 1 } });
  const counts = new Map();

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc) continue;
    const cats = doc.categories || [];
    for (const c of cats) {
      const id = (c._id || c).toString();
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  }

  // Update categories
  for (const [id, count] of counts) {
    try {
      await categories.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: { articleCount: count } });
    } catch (err) {
      // Some category entries might reference by id string
      await categories.updateOne({ _id: id }, { $set: { articleCount: count } });
    }
  }

  console.log('Category counts populated for', counts.size, 'categories');
  await mongoose.disconnect();
}

populateCounts().catch(err => { console.error(err); process.exit(1); });
