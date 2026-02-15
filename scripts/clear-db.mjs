#!/usr/bin/env node
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from payload-admin
dotenv.config({ path: path.resolve(__dirname, '../payload-admin/.env') });

const MONGODB_URL = process.env.DATABASE_URL;
if (!MONGODB_URL) {
  console.error('DATABASE_URL not set in .env');
  process.exit(1);
}

async function run() {
  try {
    await mongoose.connect(MONGODB_URL, { autoIndex: false });
    console.log('MongoDB connected');
    const db = mongoose.connection.db;
    const toDrop = ['articles','authors','categories','tags','comments','media','payload-kvs','payload-migrations','payload-locked-documents','payload-preferences'];
    const existing = await db.listCollections().toArray();
    const existingNames = existing.map(c => c.name);
    for (const name of toDrop) {
      if (existingNames.includes(name)) {
        try {
          await db.collection(name).drop();
          console.log(`Dropped ${name}`);
        } catch (err) {
          console.error(`Error dropping ${name}:`, err.message);
        }
      } else {
        console.log(`${name} not found`);
      }
    }
    console.log('Done');
    process.exit(0);
  } catch (err) {
    console.error('Connection error:', err.message);
    process.exit(1);
  }
}

run();
