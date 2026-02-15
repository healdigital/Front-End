#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../payload-admin/.env') });
const MONGODB_URL = process.env.DATABASE_URL;
if (!MONGODB_URL) { console.error('DATABASE_URL not set'); process.exit(1); }
async function run(){
  await mongoose.connect(MONGODB_URL);
  const db = mongoose.connection.db;
  const names = ['articles','authors','categories','tags','comments','media'];
  for(const n of names){
    try{
      const c = await db.collection(n).countDocuments();
      console.log(`${n}: ${c}`);
    }catch(err){
      console.log(`${n}: error (${err.message})`);
    }
  }
  await mongoose.disconnect();
}
run().catch(e=>{console.error(e);process.exit(1)});
