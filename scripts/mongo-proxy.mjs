import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, ObjectId } from 'mongodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}

const client = new MongoClient(MONGODB_URI);
const app = express();
app.use(express.json());

const PORT = 3001;

async function start() {
  await client.connect();
  const db = client.db('lcdb');

  app.get('/api/articles', async (req, res) => {
    try {
      const whereSlug = req.query['where[slug][equals]'];
      const limit = parseInt(req.query.limit) || 0;

      const q = {};
      if (whereSlug) q.slug = whereSlug;

      const cursor = db.collection('articles').find(q).sort({ date: -1 });
      if (limit > 0) cursor.limit(limit);
      const docs = await cursor.toArray();

      // Return in a similar shape to Payload: { docs: [...] }
      res.json({ docs });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/articles/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const doc = await db.collection('articles').findOne({ slug: id }) || await db.collection('articles').findOne({ _id: ObjectId.isValid(id) ? new ObjectId(id) : id });
      if (!doc) return res.status(404).json({ message: 'Not found' });
      res.json(doc);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Mongo proxy listening on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start proxy:', err);
  process.exit(1);
});
