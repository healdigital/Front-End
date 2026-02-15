import { buildConfig } from 'payload';
import { mongooseAdapter } from '@payloadcms/db-mongodb';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Articles } from './src/payload/collections/Articles';
import { Authors } from './src/payload/collections/Authors';
import { Comments } from './src/payload/collections/Comments';
import { Categories } from './src/payload/collections/Categories';
import { Tags } from './src/payload/collections/Tags';
import { Users } from './src/payload/collections/Users';
import { Media } from './src/payload/collections/Media';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use MongoDB for now (switching from PostgreSQL due to Neon connection issues)
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lcdb';
console.log('Using MongoDB URI:', mongoUri.substring(0, 50) + '...');

export default buildConfig({
  admin: {
    user: 'users',
    css: path.resolve(__dirname, 'src/admin/custom.css'),
  },
  editor: lexicalEditor({}),
  collections: [
    Users,
    Articles,
    Authors,
    Comments,
    Categories,
    Tags,
    Media,
  ],
  db: mongooseAdapter({
    url: mongoUri,
  }),
  secret: process.env.PAYLOAD_SECRET || 'your-secret-key-change-in-production',

  typescript: {
    outputFile: path.resolve(__dirname, 'payload-types.ts'),
  },
});
