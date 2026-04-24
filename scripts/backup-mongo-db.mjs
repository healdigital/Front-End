import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { MongoClient, BSON } from 'mongodb';

const { EJSON } = BSON;

dotenv.config({ path: './payload-admin/.env' });

const uri = process.env.DATABASE_URL;
if (!uri) {
  throw new Error('DATABASE_URL missing in payload-admin/.env');
}

const dbName = process.argv[2] || 'lcdb';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(process.cwd(), 'tmp', 'db-backups', `${dbName}-${timestamp}`);

await fs.mkdir(outDir, { recursive: true });

const client = new MongoClient(uri);
await client.connect();

const db = client.db(dbName);
const collections = await db.listCollections().toArray();
const manifest = [];

for (const { name } of collections) {
  const outPath = path.join(outDir, `${name}.json`);
  const handle = await fs.open(outPath, 'w');
  let count = 0;

  try {
    await handle.write('[\n');
    const cursor = db.collection(name).find({});
    let first = true;

    for await (const doc of cursor) {
      const serialized = EJSON.stringify(doc, null, 2);
      if (!first) {
        await handle.write(',\n');
      }
      await handle.write(serialized);
      first = false;
      count += 1;
    }

    await handle.write('\n]\n');
    manifest.push({ name, count, file: `${name}.json` });
    console.log(`[backup] ${name}: ${count}`);
  } finally {
    await handle.close();
  }
}

await fs.writeFile(
  path.join(outDir, 'manifest.json'),
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      db: dbName,
      collections: manifest,
    },
    null,
    2,
  ),
  'utf8',
);

await client.close();

console.log(`[backup] completed: ${outDir}`);
