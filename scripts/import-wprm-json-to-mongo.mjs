import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import 'dotenv/config';

const DEFAULT_INPUT_PATH = path.join(
  process.cwd(),
  '.tmp',
  'wprm_json',
  'wprm_json_export_2026-04-17',
  'WPRM Recipe Export.full.json',
);

const RAW_MONGO_URI =
  process.env.DATABASE_URL ||
  process.env.MONGODB_URI ||
  process.env.PAYLOAD_MONGO_URI ||
  '';

const argMap = new Map(
  process.argv.slice(2).map((entry) => {
    const [key, ...rest] = entry.split('=');
    return [key, rest.join('=')];
  }),
);

const hasArg = (key) => argMap.has(key);
const getArg = (key, fallback = '') => (argMap.has(key) ? String(argMap.get(key) || '') : fallback);

const inputPath = path.resolve(getArg('--input', DEFAULT_INPUT_PATH));
const wpOrigin = String(getArg('--wp-origin', 'https://stagingapp15670.cloudwayssites.com')).replace(/\/+$/g, '');
const dryRun = hasArg('--dry-run');
const keepDraft = hasArg('--keep-draft');
const overrideDbName = String(getArg('--db-name', '')).trim();

if (!RAW_MONGO_URI) {
  console.error('ERROR: DATABASE_URL or MONGODB_URI is required.');
  process.exit(1);
}

const parseDbNameFromUri = (uri) => {
  try {
    const parsed = new URL(uri);
    const dbPath = parsed.pathname.replace(/^\/+/, '').trim();
    if (!dbPath) return '';
    return dbPath.split('/')[0];
  } catch {
    return '';
  }
};

const dbName = overrideDbName || parseDbNameFromUri(RAW_MONGO_URI) || 'lcdb';

const decodeHtmlEntities = (value) =>
  String(value || '')
    .replace(/&#(\d+);/g, (_, dec) => {
      const codePoint = Number.parseInt(dec, 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const codePoint = Number.parseInt(hex, 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
    })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"');

const stripHtml = (value) =>
  decodeHtmlEntities(String(value || ''))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeLanguage = (value) => {
  const raw = String(value || 'fr')
    .trim()
    .toLowerCase();
  if (raw === 'pt' || raw === 'pt_br' || raw === 'ptbr') return 'pt-br';
  if (['fr', 'en', 'es', 'pt-br', 'ar'].includes(raw)) return raw;
  return 'fr';
};

const normalizeSlug = (value) =>
  String(value || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');

const toWpPath = (lang, slug) => {
  if (!slug) return '';
  if (lang === 'fr') return slug;
  return `${lang}/recipe/${slug}`;
};

const toWpLink = (lang, slug) => {
  const pathName = toWpPath(lang, slug);
  return pathName ? `${wpOrigin}/${pathName}/` : '';
};

const slugify = (value) =>
  decodeHtmlEntities(String(value || ''))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);

const toPositiveNumber = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(',', '.').replace(/[^0-9.+-]/g, ''));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

const toDate = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return new Date();
  const normalized = raw.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : new Date();
};

const normalizeStatus = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'draft' || raw === 'pending') return 'draft';
  return 'published';
};

const inferRecipeType = (recipe) => {
  const categoryTags = Array.isArray(recipe?.tags?.category) ? recipe.tags.category : [];
  const postTags = Array.isArray(recipe?.tags?.post_tag) ? recipe.tags.post_tag : [];
  const text = [...categoryTags, ...postTags]
    .map((item) => stripHtml(item))
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (/\b(sucre|sucree|sucrees|sweet|dessert)\b/.test(text)) return 'sweet';
  if (/\b(sale|salee|salees|savory|savoury)\b/.test(text)) return 'savory';
  return 'other';
};

const parseIngredientRows = (recipe) => {
  const rows = Array.isArray(recipe?.ingredients_flat)
    ? recipe.ingredients_flat
    : Object.values(recipe?.ingredients_flat || {});
  const output = [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const type = String(row.type || '').toLowerCase();

    if (type === 'group') {
      const heading = stripHtml(row.name);
      if (!heading) continue;
      output.push({
        id: randomUUID(),
        isGroupHeading: true,
        groupHeading: heading,
        quantity: '',
        item: '',
        notes: '',
      });
      continue;
    }

    const amount = stripHtml(row.amount);
    const unit = stripHtml(row.unit);
    const quantity = `${amount}${amount && unit ? ' ' : ''}${unit}`.trim();
    const item = stripHtml(row.name);
    const notes = stripHtml(row.notes);
    if (!quantity && !item && !notes) continue;

    output.push({
      id: randomUUID(),
      isGroupHeading: false,
      groupHeading: '',
      quantity,
      item,
      notes,
    });
  }

  if (output.length === 0) {
    output.push({
      id: randomUUID(),
      isGroupHeading: false,
      groupHeading: '',
      quantity: '',
      item: 'Voir contenu de la recette',
      notes: '',
    });
  }

  return output;
};

const parseStepRows = async (recipe, resolveMediaIdFromUrl) => {
  const rows = Array.isArray(recipe?.instructions_flat)
    ? recipe.instructions_flat
    : Object.values(recipe?.instructions_flat || {});

  const output = [];
  let lastStepImageId = null;

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const type = String(row.type || '').toLowerCase();

    if (type === 'group') {
      const heading = stripHtml(row.name);
      if (!heading) continue;
      output.push({
        id: randomUUID(),
        isGroupHeading: true,
        groupHeading: heading,
      });
      continue;
    }

    const instruction = stripHtml(row.text || row.name || '');
    const imageUrl = String(row.image_url || '').trim();
    if (!instruction && !imageUrl) continue;

    const step = {
      id: randomUUID(),
      isGroupHeading: false,
      instruction,
    };

    if (imageUrl) {
      const mediaId = await resolveMediaIdFromUrl(imageUrl);
      if (mediaId) {
        step.image = mediaId;
        lastStepImageId = mediaId;
      } else {
        step.imageUrl = imageUrl;
      }
    }

    output.push(step);
  }

  if (output.length === 0) {
    output.push({
      id: randomUUID(),
      isGroupHeading: false,
      instruction: 'Voir le contenu complet de la recette.',
    });
  }

  return { steps: output, lastStepImageId };
};

const pickArray = (value) => (Array.isArray(value) ? value : []);

const uniqueNames = (items) => {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const normalized = stripHtml(item);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
};

const readWprmRecords = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  if (Array.isArray(data)) return data;
  return Object.keys(data || {})
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => data[key])
    .filter(Boolean);
};

const run = async () => {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const records = readWprmRecords(inputPath);
  if (!records.length) {
    throw new Error('No WPRM records found in input file.');
  }

  const client = new MongoClient(RAW_MONGO_URI);
  await client.connect();
  const db = client.db(dbName);

  try {
    const now = new Date();
    const authors = db.collection('authors');
    const categories = db.collection('categories');
    const tags = db.collection('tags');
    const media = db.collection('media');
    const articles = db.collection('articles');

    const authorCache = new Map();
    const categoryCache = new Map();
    const tagCache = new Map();
    const mediaCache = new Map();

    const getOrCreateAuthor = async (name) => {
      const cleanName = stripHtml(name || 'Bernard Laurance') || 'Bernard Laurance';
      const key = cleanName.toLowerCase();
      if (authorCache.has(key)) return authorCache.get(key);

      const existing = await authors.findOne({ name: cleanName }, { projection: { _id: 1 } });
      if (existing?._id) {
        authorCache.set(key, existing._id);
        return existing._id;
      }

      const doc = {
        name: cleanName,
        createdAt: now,
        updatedAt: now,
      };

      if (dryRun) {
        const fakeId = `dryrun-author-${key}`;
        authorCache.set(key, fakeId);
        return fakeId;
      }

      const created = await authors.insertOne(doc);
      authorCache.set(key, created.insertedId);
      return created.insertedId;
    };

    const getOrCreateCategory = async (name) => {
      const cleanName = stripHtml(name);
      if (!cleanName) return null;
      const cleanSlug = slugify(cleanName);
      if (!cleanSlug) return null;
      if (categoryCache.has(cleanSlug)) return categoryCache.get(cleanSlug);

      const existing = await categories.findOne({ slug: cleanSlug }, { projection: { _id: 1 } });
      if (existing?._id) {
        categoryCache.set(cleanSlug, existing._id);
        return existing._id;
      }

      const doc = {
        name: cleanName,
        slug: cleanSlug,
        description: '',
        createdAt: now,
        updatedAt: now,
      };

      if (dryRun) {
        const fakeId = `dryrun-category-${cleanSlug}`;
        categoryCache.set(cleanSlug, fakeId);
        return fakeId;
      }

      const created = await categories.insertOne(doc);
      categoryCache.set(cleanSlug, created.insertedId);
      return created.insertedId;
    };

    const getOrCreateTag = async (name) => {
      const cleanName = stripHtml(name);
      if (!cleanName) return null;
      const cleanSlug = slugify(cleanName);
      if (!cleanSlug) return null;
      if (tagCache.has(cleanSlug)) return tagCache.get(cleanSlug);

      const existing = await tags.findOne({ slug: cleanSlug }, { projection: { _id: 1 } });
      if (existing?._id) {
        tagCache.set(cleanSlug, existing._id);
        return existing._id;
      }

      const doc = {
        name: cleanName,
        slug: cleanSlug,
        description: '',
        createdAt: now,
        updatedAt: now,
      };

      if (dryRun) {
        const fakeId = `dryrun-tag-${cleanSlug}`;
        tagCache.set(cleanSlug, fakeId);
        return fakeId;
      }

      const created = await tags.insertOne(doc);
      tagCache.set(cleanSlug, created.insertedId);
      return created.insertedId;
    };

    const resolveMediaIdFromUrl = async (rawUrl) => {
      const input = String(rawUrl || '').trim();
      if (!input) return null;
      if (mediaCache.has(input)) return mediaCache.get(input);

      let variants = [input];
      variants = variants.concat([
        input.replace(/^http:\/\//i, 'https://'),
        input.replace(/^https?:\/\/stagingapp15670\.cloudwayssites\.com/i, 'https://lacuisinedebernard.com'),
      ]);
      variants = Array.from(new Set(variants.filter(Boolean)));

      const fileName = (() => {
        try {
          const parsed = new URL(input);
          return path.basename(parsed.pathname || '');
        } catch {
          return path.basename(input);
        }
      })();

      const existing = await media.findOne(
        {
          $or: [
            { url: { $in: variants } },
            ...(fileName ? [{ filename: fileName }] : []),
          ],
        },
        { projection: { _id: 1 } },
      );

      const found = existing?._id || null;
      mediaCache.set(input, found);
      return found;
    };

    const stats = {
      total: records.length,
      skipped: 0,
      upserted: 0,
      modified: 0,
      matched: 0,
      withFeaturedMedia: 0,
      byLanguage: {},
    };

    for (const record of records) {
      const language = normalizeLanguage(record.language);
      const baseSlug = normalizeSlug(record.slug);
      const recipeId = Number.parseInt(String(record.id || ''), 10);

      if (!baseSlug || !Number.isFinite(recipeId)) {
        stats.skipped += 1;
        continue;
      }

      stats.byLanguage[language] = (stats.byLanguage[language] || 0) + 1;

      const routeSlug = toWpPath(language, baseSlug);
      const link = toWpLink(language, baseSlug);

      const authorId = await getOrCreateAuthor(record.author_name || record.author_display || 'Bernard Laurance');

      const categoryNames = uniqueNames([
        ...pickArray(record?.tags?.category),
      ]);
      const tagNames = uniqueNames([
        ...pickArray(record?.tags?.post_tag),
        ...pickArray(record?.tags?.keyword),
      ]);

      const categoryIds = (
        await Promise.all(categoryNames.map((name) => getOrCreateCategory(name)))
      ).filter(Boolean);
      const tagIds = (await Promise.all(tagNames.map((name) => getOrCreateTag(name)))).filter(Boolean);

      const featuredImageUrl = String(record.image_url || '').trim();
      const featuredMediaId = featuredImageUrl ? await resolveMediaIdFromUrl(featuredImageUrl) : null;
      if (featuredMediaId) stats.withFeaturedMedia += 1;

      const { steps, lastStepImageId } = await parseStepRows(record, resolveMediaIdFromUrl);
      const recipeBlock = {
        blockType: 'recipeCard',
        title: 'Recipe card',
        preparationTimeMinutes: toPositiveNumber(record.prep_time) ?? 0,
        cookingTimeMinutes: toPositiveNumber(record.cook_time) ?? 0,
        servingsCount: toPositiveNumber(record.servings) ?? null,
        difficulty: 'medium',
        recipeType: inferRecipeType(record),
        dishType: uniqueNames(pickArray(record?.tags?.course))[0] || '',
        cuisine: uniqueNames(pickArray(record?.tags?.cuisine))[0] || '',
        servings: stripHtml(
          `${record.servings ?? ''}${record.servings_unit ? ` ${record.servings_unit}` : ''}`.trim(),
        ),
        ingredients: parseIngredientRows(record),
        steps,
        nutrition: {
          caloriesKcal: toPositiveNumber(record?.nutrition?.calories),
          proteinGrams: toPositiveNumber(record?.nutrition?.protein),
          carbohydratesGrams: toPositiveNumber(record?.nutrition?.carbohydrates),
          fatGrams: toPositiveNumber(record?.nutrition?.fat),
          fiberGrams: toPositiveNumber(record?.nutrition?.fiber),
          sugarGrams: toPositiveNumber(record?.nutrition?.sugar),
          sodiumMg: toPositiveNumber(record?.nutrition?.sodium),
        },
      };

      if (lastStepImageId) {
        recipeBlock.finalStepImage = lastStepImageId;
      }

      const status = normalizeStatus(record.post_status);

      const articleDoc = {
        title: stripHtml(record.name || 'Untitled Recipe'),
        slug: routeSlug,
        lang: language,
        date: toDate(record.date),
        modified: toDate(record.date),
        excerpt: String(record.summary || '').trim(),
        content: String(record.notes || '').trim(),
        link,
        _status: keepDraft ? 'draft' : status,
        author: authorId || null,
        categories: categoryIds,
        tags: tagIds,
        featuredMedia: featuredMediaId || null,
        ...(featuredMediaId || !featuredImageUrl
          ? {}
          : {
              featuredImage: {
                url: featuredImageUrl,
                alt: stripHtml(record.name || ''),
              },
            }),
        featured_img_url: featuredImageUrl || '',
        recipeBlocks: [recipeBlock],
        readyForPublication: true,
        translationReviewStatus: language === 'fr' ? 'not_required' : 'pending_review',
        source: 'wprm-json',
        wprmId: recipeId,
        wprmSlug: baseSlug,
        wprmLanguage: language,
        updatedAt: now,
      };

      if (!dryRun) {
        const result = await articles.updateOne(
          { wprmId: recipeId, wprmLanguage: language },
          {
            $set: articleDoc,
            $setOnInsert: { createdAt: now },
          },
          { upsert: true },
        );

        if (result.upsertedCount) stats.upserted += result.upsertedCount;
        if (result.modifiedCount) stats.modified += result.modifiedCount;
        if (result.matchedCount) stats.matched += result.matchedCount;
      }
    }

    console.log('\nWPRM import summary');
    console.log('-------------------');
    console.log(`Input file     : ${inputPath}`);
    console.log(`Total records  : ${stats.total}`);
    console.log(`Skipped        : ${stats.skipped}`);
    console.log(`Dry run        : ${dryRun ? 'yes' : 'no'}`);
    console.log(`With media hit : ${stats.withFeaturedMedia}`);
    console.log(`By language    : ${JSON.stringify(stats.byLanguage)}`);
    if (!dryRun) {
      console.log(`Upserted       : ${stats.upserted}`);
      console.log(`Modified       : ${stats.modified}`);
      console.log(`Matched        : ${stats.matched}`);
    }
  } finally {
    await client.close();
  }
};

run().catch((error) => {
  console.error('\nERROR: WPRM import failed.');
  console.error(error);
  process.exit(1);
});
