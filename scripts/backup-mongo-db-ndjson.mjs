import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { MongoClient, BSON } from 'mongodb';
import { once } from 'events';

const { EJSON } = BSON;

dotenv.config({ path: './payload-admin/.env' });

const uri = process.env.DATABASE_URL;
if (!uri) {
  throw new Error('DATABASE_URL missing in payload-admin/.env');
}

const dbName = process.argv[2] || 'lcdb';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(process.cwd(), 'tmp', 'db-backups', `${dbName}-${timestamp}-ndjson`);

await fs.mkdir(outDir, { recursive: true });

const client = new MongoClient(uri);
await client.connect();

const db = client.db(dbName);
const collections = await db.listCollections().toArray();
const manifest = [];

for (const { name } of collections) {
  const outPath = path.join(outDir, `${name}.ndjson`);
  const stream = createWriteStream(outPath, { encoding: 'utf8' });
  let count = 0;

  try {
    const cursor = db.collection(name).find({}).batchSize(100);
    for await (const doc of cursor) {
      if (!stream.write(`${EJSON.stringify(doc)}\n`)) {
        await once(stream, 'drain');
      }
      count += 1;
    }
  } finally {
    stream.end();
    await once(stream, 'finish');
  }

  manifest.push({ name, count, file: `${name}.ndjson` });
  console.log(`[backup-ndjson] ${name}: ${count}`);
}

await fs.writeFile(
  path.join(outDir, 'manifest.json'),
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      db: dbName,
      format: 'ndjson',
      collections: manifest,
    },
    null,
    2,
  ),
  'utf8',
);

await client.close();

console.log(`[backup-ndjson] completed: ${outDir}`);
