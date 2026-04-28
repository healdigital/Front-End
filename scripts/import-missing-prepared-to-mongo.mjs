import fs from 'node:fs';
import path from 'node:path';
import { MongoClient } from 'mongodb';
import 'dotenv/config';

const argMap = new Map(
  process.argv.slice(2).map((entry) => {
    const [key, ...rest] = entry.split('=');
    return [key, rest.join('=')];
  }),
);

const hasArg = (key) => argMap.has(key);
const getArg = (key, fallback = '') => (argMap.has(key) ? String(argMap.get(key) || '') : fallback);

const inputPath = path.resolve(getArg('--input', path.join(process.cwd(), 'prepared-articles.json')));
const dryRun = !hasArg('--apply');
const previewPath = path.resolve(
  getArg('--preview', path.join(process.cwd(), '.tmp', 'missing-prepared-mongo-preview.json')),
);

const mongoUri =
  process.env.DATABASE_URL ||
  process.env.MONGODB_URI ||
  process.env.PAYLOAD_MONGO_URI ||
  '';

if (!mongoUri) {
  console.error('ERROR: missing DATABASE_URL / MONGODB_URI / PAYLOAD_MONGO_URI');
  process.exit(1);
}

const parseDbNameFromUri = (uri) => {
  try {
    const parsed = new URL(uri);
    const dbPath = parsed.pathname.replace(/^\/+/, '').trim();
    return dbPath ? dbPath.split('/')[0] : '';
  } catch {
    return '';
  }
};

const dbName = parseDbNameFromUri(mongoUri) || 'lcdb';

const toText = (value) => (value === null || value === undefined ? '' : String(value).trim());
const toLang = (value) => {
  const raw = toText(value).toLowerCase();
  if (raw === 'pt' || raw === 'pt_br' || raw === 'ptbr') return 'pt-br';
  return raw || 'fr';
};
const normalizeSlug = (value) => toText(value).replace(/^\/+|\/+$/g, '');
const humanizeSlug = (slug) =>
  normalizeSlug(slug)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
const toDate = (value, fallback = new Date()) => {
  const raw = toText(value);
  if (!raw) return fallback;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};
const cloneArray = (value) => (Array.isArray(value) ? structuredClone(value) : []);
const cloneObject = (value) => (value && typeof value === 'object' ? structuredClone(value) : null);

const buildPreparedMap = (items) => {
  const map = new Map();
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const slug = normalizeSlug(item.slug);
    const lang = toLang(item.lang || item.language || item.locale);
    if (!slug) continue;
    map.set(`${lang}::${slug}`, item);
  }
  return map;
};

const transformPreparedRecord = (source) => {
  const now = new Date();
  const slug = normalizeSlug(source.slug);
  const lang = toLang(source.lang || source.language || source.locale);
  const featuredImage = cloneObject(source.featuredImage) || cloneObject(source.featured_image);
  const featuredImageUrl =
    toText(source.featured_img_url) ||
    toText(source.featuredImageUrl) ||
    toText(featuredImage?.url) ||
    '';
  const createdAt = toDate(source.date, now);
  const numericPostId = Number(source.post_id ?? source.id ?? source._id);
  const safePostId = Number.isFinite(numericPostId) ? numericPostId : undefined;
  const title = toText(source.title) || humanizeSlug(slug);

  return {
    title,
    slug,
    excerpt: toText(source.excerpt),
    content: toText(source.content),
    categories: cloneArray(source.categories),
    tags: cloneArray(source.tags),
    author: cloneObject(source.author) || source.author || null,
    lang,
    date: toText(source.date) || createdAt.toISOString(),
    created_at: createdAt,
    updated_at: now,
    updatedAt: now,
    _status: 'published',
    post_id: safePostId,
    id: toText(source.id) || (safePostId ? String(safePostId) : ''),
    featured_image: cloneObject(source.featured_image) || featuredImage,
    featuredImage,
    featured_img_url: featuredImageUrl,
    featuredImageUrl: featuredImageUrl,
    featureImage: source.featureImage ?? featuredImageUrl,
    contentBlocks: cloneArray(source.contentBlocks),
    imageBlocks: cloneArray(source.imageBlocks),
    recipeBlocks: cloneArray(source.recipeBlocks),
    noIndex: Boolean(source.noIndex),
    readyForPublication: source.readyForPublication ?? true,
    autoTranslateNow: source.autoTranslateNow ?? false,
    seoDescription: toText(source.seoDescription),
    seoTitle: toText(source.seoTitle),
    canonicalURL: toText(source.canonicalURL),
    contentV2: source.contentV2 ?? null,
    featuredMedia: cloneObject(source.featuredMedia),
    seoImage: cloneObject(source.seoImage),
    translationReviewStatus: toText(source.translationReviewStatus),
    translationReviewedAt: source.translationReviewedAt ?? null,
    translationReviewedBy: source.translationReviewedBy ?? null,
    translationSourceArticle: source.translationSourceArticle ?? null,
    migrationStatus: 'prepared-json-missing-import',
    migrationNotes: `Inserted from prepared-articles.json because lang+slug was missing in Mongo on ${now.toISOString()}.`,
  };
};

const main = async () => {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const preparedRaw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  if (!Array.isArray(preparedRaw)) {
    throw new Error('prepared input must be a JSON array');
  }

  const preparedMap = buildPreparedMap(preparedRaw);

  const client = new MongoClient(mongoUri);
  await client.connect();

  try {
    const db = client.db(dbName);
    const collection = db.collection('articles');
    const mongoDocs = await collection.find({}, { projection: { slug: 1, lang: 1 } }).toArray();
    const existingKeys = new Set(
      mongoDocs.map((doc) => `${toLang(doc.lang)}::${normalizeSlug(doc.slug)}`).filter((key) => !key.endsWith('::')),
    );

    const missing = [];
    for (const [key, value] of preparedMap.entries()) {
      if (!existingKeys.has(key)) {
        missing.push(value);
      }
    }

    const preview = missing.map((item) => ({
      lang: toLang(item.lang || item.language || item.locale),
      slug: normalizeSlug(item.slug),
      title: toText(item.title) || humanizeSlug(item.slug),
      postType: toText(item._postType),
    }));

    fs.mkdirSync(path.dirname(previewPath), { recursive: true });
    fs.writeFileSync(previewPath, JSON.stringify(preview, null, 2));

    console.log(`Prepared unique records: ${preparedMap.size}`);
    console.log(`Mongo article records: ${mongoDocs.length}`);
    console.log(`Missing lang+slug records: ${missing.length}`);
    console.log(`Preview written: ${previewPath}`);

    if (dryRun) {
      console.log('Dry run only. Re-run with --apply to insert missing records.');
      return;
    }

    if (missing.length === 0) {
      console.log('Nothing to insert.');
      return;
    }

    const docsToInsert = missing.map((item) => transformPreparedRecord(item));
    const result = await collection.insertMany(docsToInsert, { ordered: false });

    console.log(`Inserted records: ${result.insertedCount}`);
  } finally {
    await client.close();
  }
};

main().catch((error) => {
  console.error('Import failed:', error);
  process.exit(1);
});
