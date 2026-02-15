#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../payload-admin/.env') });
const MONGODB_URL = process.env.DATABASE_URL;
if (!MONGODB_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

async function run(){
  await mongoose.connect(MONGODB_URL);
  const db = mongoose.connection.db;
  const articlesDir = path.join(__dirname, '..', 'All Articles');
  const files = fs.readdirSync(articlesDir).filter(f=>f.startsWith('post-') && f.endsWith('.json'));

  const categories = new Map();
  const tags = new Map();

  for (const file of files) {
    const content = JSON.parse(fs.readFileSync(path.join(articlesDir, file), 'utf8'));
    const posts = content.posts || [];
    for (const post of posts) {
      const cats = post.categories || post.post_categories || [];
      const tgs = post.tags || post.post_tags || [];
      for (const c of cats) {
        const id = c.id.toString().padEnd(24, '0');
        if (!categories.has(id)) categories.set(id, { _id: new mongoose.Types.ObjectId(id), name: c.name || 'Uncategorized', slug: c.slug || (c.name||'').toLowerCase().replace(/\s+/g,'-') });
      }
      for (const t of tgs) {
        const id = t.id.toString().padEnd(24, '0');
        if (!tags.has(id)) tags.set(id, { _id: new mongoose.Types.ObjectId(id), name: t.name || 'Untagged', slug: t.slug || (t.name||'').toLowerCase().replace(/\s+/g,'-') });
      }
    }
  }

  console.log('Found', categories.size, 'categories and', tags.size, 'tags in JSON');

  // Upsert categories
  for (const [id, cat] of categories.entries()) {
    await db.collection('categories').updateOne({ _id: cat._id }, { $set: { name: cat.name, slug: cat.slug, updatedAt: new Date(), createdAt: new Date() } }, { upsert: true });
  }
  // Upsert tags
  for (const [id, tag] of tags.entries()) {
    await db.collection('tags').updateOne({ _id: tag._id }, { $set: { name: tag.name, slug: tag.slug, updatedAt: new Date(), createdAt: new Date() } }, { upsert: true });
  }

  console.log('Upserted categories and tags');

  // Update articles to reference categories/tags
  for (const file of files) {
    const content = JSON.parse(fs.readFileSync(path.join(articlesDir, file), 'utf8'));
    const posts = content.posts || [];
    for (const post of posts) {
      const aId = new mongoose.Types.ObjectId(post.id.toString().padEnd(24, '0'));
      const cats = (post.categories || post.post_categories || []).map(c => new mongoose.Types.ObjectId(c.id.toString().padEnd(24,'0')));
      const tgs = (post.tags || post.post_tags || []).map(t => new mongoose.Types.ObjectId(t.id.toString().padEnd(24,'0')));
      await db.collection('articles').updateOne({ _id: aId }, { $set: { categories: cats, tags: tgs } });
    }
  }

  console.log('Updated articles with category/tag references');
  await mongoose.disconnect();
}

run().catch(e=>{ console.error(e); process.exit(1); });
