import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

// Simple script to watch changes and update counts (run manually if needed)
async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const articles = db.collection('articles');
  const categories = db.collection('categories');

  console.log('Listening to article changes...');
  const changeStream = articles.watch();
  changeStream.on('change', async (change) => {
    try {
      const docId = change.documentKey?._id;
      if (!docId) return;

      // Recalculate counts for simplicity
      const cursor = articles.find({}, { projection: { categories: 1 } });
      const counts = new Map();
      while (await cursor.hasNext()) {
        const d = await cursor.next();
        const cats = d.categories || [];
        for (const c of cats) {
          const id = (c._id || c).toString();
          counts.set(id, (counts.get(id) || 0) + 1);
        }
      }

      for (const [id, count] of counts) {
        try {
          await categories.updateOne({ _id: new ObjectId(id) }, { $set: { articleCount: count } });
        } catch (e) {
          await categories.updateOne({ _id: id }, { $set: { articleCount: count } });
        }
      }

      console.log('Updated category counts (change event)');
    } catch (e) {
      console.error('Error processing change:', e);
    }
  });
}

main().catch(console.error);
