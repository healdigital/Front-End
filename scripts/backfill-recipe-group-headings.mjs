import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config({ path: path.join(process.cwd(), 'payload-admin', '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const args = process.argv.slice(2);

const getArgValue = (flag, fallback = '') => {
  const index = args.indexOf(flag);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
};

const hasFlag = (flag) => args.includes(flag);

const dryRun = hasFlag('--dry-run');
const limitArg = Number(getArgValue('--limit', '0'));
const preparedArg = getArgValue('--prepared', 'prepared-articles.json');
const backupDirArg = getArgValue('--backup-dir', 'tmp/article-group-backups');

const preparedPath = path.resolve(process.cwd(), preparedArg);
const backupDir = path.resolve(process.cwd(), backupDirArg);
const mongoUrl = process.env.DATABASE_URL;

if (!mongoUrl) {
  console.error('DATABASE_URL is missing.');
  process.exit(1);
}

const NAMED_ENTITIES = {
  amp: '&',
  apos: "'",
  agrave: '\u00e0',
  auml: '\u00e4',
  ccedil: '\u00e7',
  ecirc: '\u00ea',
  egrave: '\u00e8',
  eacute: '\u00e9',
  gt: '>',
  hellip: '...',
  icirc: '\u00ee',
  laquo: '\u00ab',
  ldquo: '\u201c',
  lsquo: '\u2018',
  lt: '<',
  mdash: '-',
  nbsp: ' ',
  ndash: '-',
  oelig: '\u0153',
  raquo: '\u00bb',
  rdquo: '\u201d',
  quot: '"',
  rsquo: '\u2019',
  ucirc: '\u00fb',
  ugrave: '\u00f9',
};

const decodeHtmlEntities = (value) =>
  String(value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (_, name) => NAMED_ENTITIES[name.toLowerCase()] ?? `&${name};`);

const maybeRepairMojibake = (value) => {
  const text = String(value || '');
  if (!/[ÃƒÆ’Ãƒâ€šÃƒÂ¢Ãƒâ€¦]/.test(text)) return text;

  try {
    const repaired = Buffer.from(text, 'latin1').toString('utf8');
    return repaired.includes('\uFFFD') ? text : repaired;
  } catch {
    return text;
  }
};

const cleanText = (value) =>
  maybeRepairMojibake(
    decodeHtmlEntities(
      String(value || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]+>/g, ' '),
    ),
  )
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

const normalizeSentence = (value) => cleanText(value).replace(/\s+/g, ' ').trim();

const normalizeCompare = (value) =>
  normalizeSentence(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeGroupLabel = (value) =>
  normalizeSentence(value)
    .replace(/\s*:\s*$/, '')
    .replace(/^recette pour[^:]*:\s*/i, '')
    .trim();

const createObjectId = () =>
  `${Math.floor(Date.now() / 1000).toString(16)}${Math.random().toString(16).slice(2, 18)}`.slice(0, 24);

const clone = (value) => JSON.parse(JSON.stringify(value));

const extractIngredientGroupsFromHtml = (html) => {
  const groups = [];
  const groupRegex =
    /<div[^>]*class="[^"]*wprm-recipe-ingredient-group[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="[^"]*wprm-recipe-ingredient-group|<\/div>\s*<\/div>|$)/gi;

  let groupMatch;
  while ((groupMatch = groupRegex.exec(html))) {
    const groupHtml = groupMatch[1];
    const heading = normalizeGroupLabel(
      groupHtml.match(/wprm-recipe-ingredient-group-name[^>]*>([\s\S]*?)<\/h4>/i)?.[1] || '',
    );
    const items = [];

    const liRegex = /<li[^>]*class="[^"]*wprm-recipe-ingredient[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;
    while ((liMatch = liRegex.exec(groupHtml))) {
      const liHtml = liMatch[1];
      const quantity = normalizeSentence(liHtml.match(/wprm-recipe-ingredient-amount[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
      const unit = normalizeSentence(liHtml.match(/wprm-recipe-ingredient-unit[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
      const item = normalizeSentence(liHtml.match(/wprm-recipe-ingredient-name[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
      const notes = normalizeSentence(liHtml.match(/wprm-recipe-ingredient-notes[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
      if (!quantity && !unit && !item && !notes) continue;
      items.push({
        quantity: [quantity, unit].filter(Boolean).join(' ').trim(),
        item,
        notes,
      });
    }

    if (items.length > 0) {
      groups.push({ heading, items });
    }
  }

  return groups;
};

const extractStepGroupsFromHtml = (html) => {
  const groups = [];
  const groupRegex =
    /<div[^>]*class="[^"]*wprm-recipe-instruction-group[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="[^"]*wprm-recipe-instruction-group|<\/div>\s*<\/div>|$)/gi;

  let groupMatch;
  while ((groupMatch = groupRegex.exec(html))) {
    const groupHtml = groupMatch[1];
    const heading = normalizeGroupLabel(
      groupHtml.match(/wprm-recipe-instruction-group-name[^>]*>([\s\S]*?)<\/h4>/i)?.[1] || '',
    );
    const items = [];

    const stepRegex =
      /<li[^>]*class="[^"]*wprm-recipe-instruction[^"]*"[^>]*>[\s\S]*?<div[^>]*class="[^"]*wprm-recipe-instruction-text[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<\/li>/gi;
    let stepMatch;
    while ((stepMatch = stepRegex.exec(groupHtml))) {
      const instruction = normalizeSentence(stepMatch[1]);
      if (!instruction) continue;
      items.push({ instruction });
    }

    if (items.length > 0) {
      groups.push({ heading, items });
    }
  }

  return groups;
};

const stripHeadingRows = (rows) =>
  (Array.isArray(rows) ? rows : []).filter((row) => !row?.isGroupHeading);

const ingredientComparable = (row) =>
  normalizeCompare([row?.quantity || '', row?.item || '', row?.notes || ''].filter(Boolean).join(' | '));

const stepComparable = (row) => normalizeCompare(row?.instruction || '');

const canAlignGroups = (existingRows, groupedRows, getComparable) => {
  const flatItems = groupedRows.flatMap((group) => group.items);
  if (existingRows.length !== flatItems.length) return false;

  for (let i = 0; i < existingRows.length; i += 1) {
    const existing = getComparable(existingRows[i]);
    const parsed = getComparable(flatItems[i]);
    if (!existing || !parsed) return false;
    if (existing !== parsed) return false;
  }

  return true;
};

const buildGroupedIngredients = (existingRows, groupedRows) => {
  const next = [];
  let cursor = 0;

  for (const group of groupedRows) {
    if (group.heading) {
      next.push({
        id: createObjectId(),
        isGroupHeading: true,
        groupHeading: group.heading,
      });
    }

    for (let i = 0; i < group.items.length; i += 1) {
      next.push(clone(existingRows[cursor]));
      cursor += 1;
    }
  }

  return next;
};

const buildGroupedSteps = (existingRows, groupedRows) => {
  const next = [];
  let cursor = 0;

  for (const group of groupedRows) {
    if (group.heading) {
      next.push({
        id: createObjectId(),
        isGroupHeading: true,
        groupHeading: group.heading,
      });
    }

    for (let i = 0; i < group.items.length; i += 1) {
      next.push(clone(existingRows[cursor]));
      cursor += 1;
    }
  }

  return next;
};

const sameRows = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const getIdentity = (doc) => String(doc?._id || doc?.id || '').trim();

const getSlug = (doc) => String(doc?.slug || '').trim();

const ensurePreparedDocIds = (doc) => {
  const id = getIdentity(doc);
  return id
    ? {
        ...doc,
        id: doc.id || id,
        _id: doc._id || id,
      }
    : doc;
};

const upsertPrepared = (items, doc) => {
  const normalized = ensurePreparedDocIds(doc);
  const id = getIdentity(normalized);
  const slug = getSlug(normalized);

  let index = -1;
  if (id) {
    index = items.findIndex((item) => getIdentity(item) === id);
  }
  if (index === -1 && slug) {
    index = items.findIndex((item) => getSlug(item) === slug);
  }

  if (index >= 0) items[index] = normalized;
  else items.push(normalized);
};

const loadPrepared = () => {
  if (!fs.existsSync(preparedPath)) return [];
  const raw = fs.readFileSync(preparedPath, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
};

const writePrepared = (items) => {
  fs.writeFileSync(preparedPath, JSON.stringify(items, null, 2));
};

const saveBackup = (doc) => {
  fs.mkdirSync(backupDir, { recursive: true });
  const safeSlug = getSlug(doc) || getIdentity(doc);
  const backupPath = path.join(backupDir, `${safeSlug}-before-group-backfill.json`);
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, JSON.stringify(doc, null, 2));
  }
};

const main = async () => {
  const client = new MongoClient(mongoUrl);
  await client.connect();

  const dbName = new URL(mongoUrl).pathname.replace(/^\//, '') || 'lcdb';
  const db = client.db(dbName);
  const collection = db.collection('articles');

  const filter = {
    'recipeBlocks.0': { $exists: true },
    content: {
      $regex: 'wprm-recipe-(ingredient|instruction)-group-name',
      $options: 'i',
    },
  };

  const docs = await collection
    .find(filter)
    .project({
      title: 1,
      slug: 1,
      content: 1,
      recipeBlocks: 1,
      migrationStatus: 1,
      updatedAt: 1,
      date: 1,
      excerpt: 1,
      contentV2: 1,
      categories: 1,
      tags: 1,
      author: 1,
      featuredMedia: 1,
      featuredImage: 1,
      lang: 1,
      _status: 1,
      noIndex: 1,
      readyForPublication: 1,
    })
    .toArray();

  const limitedDocs = limitArg > 0 ? docs.slice(0, limitArg) : docs;
  const prepared = loadPrepared();

  const stats = {
    scanned: limitedDocs.length,
    candidatesWithIngredientGroups: 0,
    candidatesWithStepGroups: 0,
    ingredientUpdates: 0,
    stepUpdates: 0,
    updatedDocs: 0,
    skippedIngredientMismatch: 0,
    skippedStepMismatch: 0,
  };

  for (const doc of limitedDocs) {
    const recipeBlock = Array.isArray(doc.recipeBlocks)
      ? doc.recipeBlocks.find((block) => block?.blockType === 'recipeCard') || doc.recipeBlocks[0]
      : null;
    if (!recipeBlock) continue;

    const html = String(doc.content || '');
    const ingredientGroups = extractIngredientGroupsFromHtml(html);
    const stepGroups = extractStepGroupsFromHtml(html);

    if (ingredientGroups.length > 0) stats.candidatesWithIngredientGroups += 1;
    if (stepGroups.length > 0) stats.candidatesWithStepGroups += 1;

    const currentIngredientRows = stripHeadingRows(recipeBlock.ingredients);
    const currentStepRows = stripHeadingRows(recipeBlock.steps);

    let nextIngredients = recipeBlock.ingredients;
    let nextSteps = recipeBlock.steps;
    let changed = false;

    if (ingredientGroups.length > 1 || ingredientGroups.some((group) => group.heading)) {
      if (canAlignGroups(currentIngredientRows, ingredientGroups, ingredientComparable)) {
        const rebuiltIngredients = buildGroupedIngredients(currentIngredientRows, ingredientGroups);
        if (!sameRows(rebuiltIngredients, recipeBlock.ingredients || [])) {
          nextIngredients = rebuiltIngredients;
          stats.ingredientUpdates += 1;
          changed = true;
        }
      } else {
        stats.skippedIngredientMismatch += 1;
      }
    }

    if (stepGroups.length > 1 || stepGroups.some((group) => group.heading)) {
      if (canAlignGroups(currentStepRows, stepGroups, stepComparable)) {
        const rebuiltSteps = buildGroupedSteps(currentStepRows, stepGroups);
        if (!sameRows(rebuiltSteps, recipeBlock.steps || [])) {
          nextSteps = rebuiltSteps;
          stats.stepUpdates += 1;
          changed = true;
        }
      } else {
        stats.skippedStepMismatch += 1;
      }
    }

    if (!changed) continue;

    const updatedRecipeBlocks = (doc.recipeBlocks || []).map((block) => {
      if (block !== recipeBlock) return block;
      return {
        ...block,
        ingredients: nextIngredients,
        steps: nextSteps,
      };
    });

    const updatedDoc = {
      ...doc,
      recipeBlocks: updatedRecipeBlocks,
      updatedAt: new Date().toISOString(),
    };

    stats.updatedDocs += 1;

    if (!dryRun) {
      saveBackup(doc);
      await collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            recipeBlocks: updatedRecipeBlocks,
            updatedAt: updatedDoc.updatedAt,
          },
        },
      );
      upsertPrepared(prepared, updatedDoc);
    }
  }

  if (!dryRun) {
    writePrepared(prepared);
  }

  await client.close();
  console.log(JSON.stringify({ dryRun, ...stats }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
