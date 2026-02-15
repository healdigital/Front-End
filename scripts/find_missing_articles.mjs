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

async function run(){
  await mongoose.connect(MONGODB_URL);
  const db = mongoose.connection.db;
  const articlesDir = path.join(__dirname, '..', 'All Articles');
  const files = fs.readdirSync(articlesDir).filter(f=>f.startsWith('post-') && f.endsWith('.json'));
  const expected = new Set();
  for(const file of files){
    const content = JSON.parse(fs.readFileSync(path.join(articlesDir, file),'utf8'));
    const posts = content.posts||[];
    for(const p of posts) expected.add(p.id.toString().padEnd(24,'0'));
  }
  const dbIds = new Set();
  const cursor = db.collection('articles').find({}, { projection: {_id:1} });
  await cursor.forEach(doc=>{ dbIds.add(doc._id.toString()); });
  const missing = [];
  for(const id of expected){ if(!dbIds.has(id)) missing.push(id); }
  fs.writeFileSync(path.join(__dirname,'..','missing_articles.txt'), missing.join('\n'));
  console.log(`Total expected: ${expected.size}, in DB: ${dbIds.size}, missing: ${missing.length}`);
  await mongoose.disconnect();
}
run().catch(e=>{console.error(e); process.exit(1)});
