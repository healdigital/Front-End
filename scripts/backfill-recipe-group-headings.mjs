import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

const args = process.argv.slice(2);

const getArgValue = (flag, fallback = '') => {
  const index = args.indexOf(flag);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
};

const hasFlag = (flag) => args.includes(flag);

const envArg = getArgValue('--env', 'payload-admin/.env');
const preparedArg = getArgValue('--prepared', 'prepared-articles.json');
const backupDirArg = getArgValue('--backup-dir', 'tmp/article-group-backups');
const langArg = getArgValue('--lang', '');
const slugArg = getArgValue('--slug', '');
const idArg = getArgValue('--id', '');
const limitArg = Number(getArgValue('--limit', '0'));
const apply = hasFlag('--apply');
const updatePrepared = apply && !hasFlag('--no-prepared-sync');

dotenv.config({ path: path.resolve(process.cwd(), envArg) });

const mongoUrl = process.env.DATABASE_URL;
if (!mongoUrl) {
  console.error('DATABASE_URL not found.');
  process.exit(1);
}

const preparedPath = path.resolve(process.cwd(), preparedArg);
const backupDir = path.resolve(process.cwd(), backupDirArg);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = path.resolve(
  process.cwd(),
  'tmp',
  `recipe-group-backfill-report-${timestamp}.json`,
);

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

const normalizeGroupLabel = (value) =>
  normalizeSentence(value)
    .replace(/\s*:\s*$/, '')
    .replace(/^recette pour[^:]*:\s*/i, '')
    .trim();

const createObjectId = () =>
  `${Math.floor(Date.now() / 1000).toString(16)}${Math.random().toString(16).slice(2, 18)}`.slice(0, 24);

const sanitizeHeadingText = (value) => normalizeGroupLabel(value).replace(/\s+/g, ' ').trim();

const stripGroupingFields = (row) => {
  const next = { ...(row || {}) };
  delete next.isGroupHeading;
  delete next.groupHeading;
  if (next.image === null) delete next.image;
  return next;
};

const groupStructureSignature = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .map((row) => (row?.isGroupHeading ? `H:${sanitizeHeadingText(row.groupHeading)}` : 'R'))
    .join('|');

const extractIngredientGroupsFromContent = (html) => {
  const content = String(html || '');
  const groups = [];
  const groupRegex =
    /<h4[^>]*class="[^"]*wprm-recipe-ingredient-group-name[^"]*"[^>]*>([\s\S]*?)<\/h4>\s*<ul[^>]*class="[^"]*wprm-recipe-ingredients[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi;

  let groupMatch;
  while ((groupMatch = groupRegex.exec(content))) {
    const label = sanitizeHeadingText(groupMatch[1]);
    const listHtml = groupMatch[2];
    const itemCount = [...listHtml.matchAll(/<li[^>]*class="[^"]*wprm-recipe-ingredient[^"]*"[^>]*>/gi)].length;
    if (itemCount > 0) {
      groups.push({ label, count: itemCount });
    }
  }

  return groups;
};

const extractInstructionGroupsFromContent = (html) => {
  const content = String(html || '');
  const groups = [];
  const groupRegex =
    /<div[^>]*class="[^"]*wprm-recipe-instruction-group[^"]*"[^>]*>\s*<h4[^>]*class="[^"]*wprm-recipe-instruction-group-name[^"]*"[^>]*>([\s\S]*?)<\/h4>\s*<(?:ul|ol)[^>]*class="[^"]*wprm-recipe-instructions[^"]*"[^>]*>([\s\S]*?)<\/(?:ul|ol)>\s*<\/div>/gi;

  let groupMatch;
  while ((groupMatch = groupRegex.exec(content))) {
    const label = sanitizeHeadingText(groupMatch[1]);
    const listHtml = groupMatch[2];
    const itemCount = [...listHtml.matchAll(/<li[^>]*class="[^"]*wprm-recipe-instruction[^"]*"[^>]*>/gi)].length;
    if (itemCount > 0) {
      groups.push({ label, count: itemCount });
    }
  }

  return groups;
};

const rebuildRowsWithGroups = (rows, parsedGroups, options = {}) => {
  const currentRows = Array.isArray(rows) ? rows : [];
  const nonHeadingRows = currentRows.filter((row) => !Boolean(row?.isGroupHeading));
  const groups = Array.isArray(parsedGroups) ? parsedGroups.filter((group) => group?.count > 0) : [];
  const allowLeadingUngrouped = Boolean(options.allowLeadingUngrouped);

  if (!groups.length) {
    return { changed: false, reason: 'no-groups' };
  }

  const parsedLabelCount = groups.filter((group) => sanitizeHeadingText(group.label)).length;
  if (!parsedLabelCount) {
    return { changed: false, reason: 'no-meaningful-headings' };
  }

  const expectedCount = groups.reduce((sum, group) => sum + group.count, 0);
  const canUseLeadingUngroupedFallback =
    allowLeadingUngrouped &&
    nonHeadingRows.length > expectedCount;

  if (expectedCount !== nonHeadingRows.length && !canUseLeadingUngroupedFallback) {
    return {
      changed: false,
      reason: 'count-mismatch',
      expectedCount,
      currentCount: nonHeadingRows.length,
    };
  }

  const nextRows = [];
  let cursor = 0;

  if (canUseLeadingUngroupedFallback) {
    const leadingCount = nonHeadingRows.length - expectedCount;
    for (let index = 0; index < leadingCount; index += 1) {
      nextRows.push(stripGroupingFields(nonHeadingRows[cursor]));
      cursor += 1;
    }
  }

  for (const group of groups) {
    const heading = sanitizeHeadingText(group.label);
    if (heading) {
      nextRows.push({
        isGroupHeading: true,
        groupHeading: heading,
        id: createObjectId(),
      });
    }

    for (let index = 0; index < group.count; index += 1) {
      const row = stripGroupingFields(nonHeadingRows[cursor]);
      nextRows.push(row);
      cursor += 1;
    }
  }

  const currentSignature = groupStructureSignature(currentRows);
  const nextSignature = groupStructureSignature(nextRows);

  if (currentSignature === nextSignature) {
    return { changed: false, reason: 'already-grouped' };
  }

  return { changed: true, rows: nextRows };
};

const loadPreparedArticles = () => {
  if (!updatePrepared) return null;
  if (!fs.existsSync(preparedPath)) {
    throw new Error(`Prepared JSON not found: ${preparedPath}`);
  }
  const raw = fs.readFileSync(preparedPath, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
};

const backupPreparedArticles = () => {
  if (!updatePrepared || !fs.existsSync(preparedPath)) return null;
  fs.mkdirSync(path.dirname(preparedPath), { recursive: true });
  fs.mkdirSync(path.resolve(process.cwd(), 'tmp'), { recursive: true });
  const backupPath = path.resolve(
    process.cwd(),
    'tmp',
    `prepared-articles-group-backup-${timestamp}.json`,
  );
  fs.copyFileSync(preparedPath, backupPath);
  return backupPath;
};

const findPreparedIndex = (items, doc) => {
  const docId = String(doc?._id || doc?.id || '');
  const slug = String(doc?.slug || '').trim();
  return items.findIndex((item) => {
    const itemId = String(item?._id || item?.id || '');
    if (docId && itemId === docId) return true;
    if (slug && String(item?.slug || '').trim() === slug) return true;
    return false;
  });
};

const allCandidates = hasFlag('--all-candidates');

const filterQuery = allCandidates
  ? {
      'recipeBlocks.0': { $exists: true },
      content: {
        $regex: 'wprm-recipe-(ingredient|instruction)-group-name',
        $options: 'i',
      },
    }
  : {
      'recipeBlocks.0': { $exists: true },
      $or: [
        {
          content: {
            $regex: 'wprm-recipe-ingredient-group-name',
            $options: 'i',
          },
          'recipeBlocks.0.ingredients.isGroupHeading': { $ne: true },
        },
        {
          content: {
            $regex: 'wprm-recipe-instruction-group-name',
            $options: 'i',
          },
          'recipeBlocks.0.steps.isGroupHeading': { $ne: true },
        },
      ],
    };

if (langArg) filterQuery.lang = langArg;
if (slugArg) filterQuery.slug = slugArg;
if (idArg) filterQuery._id = idArg;

const client = new MongoClient(mongoUrl);

const run = async () => {
  await client.connect();
  const dbName = new URL(mongoUrl).pathname.replace(/^\//, '') || 'lcdb';
  const db = client.db(dbName);
  const collection = db.collection('articles');

  const cursor = collection.find(filterQuery, {
    projection: {
      slug: 1,
      lang: 1,
      title: 1,
      content: 1,
      recipeBlocks: 1,
      updatedAt: 1,
    },
  });

  if (limitArg > 0) cursor.limit(limitArg);
  const docs = await cursor.toArray();

  const preparedItems = loadPreparedArticles();
  const preparedBackupPath = apply ? backupPreparedArticles() : null;
  fs.mkdirSync(backupDir, { recursive: true });

  const stats = {
    scanned: docs.length,
    ingredientCandidates: 0,
    ingredientUpdated: 0,
    ingredientSkipped: 0,
    stepCandidates: 0,
    stepUpdated: 0,
    stepSkipped: 0,
    docsChanged: 0,
    preparedUpdated: 0,
  };

  const skipped = [];

  for (const doc of docs) {
    const recipeBlocks = Array.isArray(doc.recipeBlocks) ? [...doc.recipeBlocks] : [];
    const firstBlock = recipeBlocks[0];
    if (!firstBlock) continue;

    const content = String(doc.content || '');
    const ingredientGroups = extractIngredientGroupsFromContent(content);
    const stepGroups = extractInstructionGroupsFromContent(content);

    if (ingredientGroups.length) stats.ingredientCandidates += 1;
    if (stepGroups.length) stats.stepCandidates += 1;

    const ingredientResult = rebuildRowsWithGroups(firstBlock.ingredients, ingredientGroups);
    const stepResult = rebuildRowsWithGroups(firstBlock.steps, stepGroups, {
      allowLeadingUngrouped: true,
    });

    if (ingredientGroups.length && !ingredientResult.changed && ingredientResult.reason !== 'already-grouped') {
      stats.ingredientSkipped += 1;
    }
    if (stepGroups.length && !stepResult.changed && stepResult.reason !== 'already-grouped') {
      stats.stepSkipped += 1;
    }

    if (!ingredientResult.changed && !stepResult.changed) {
      if (
        (ingredientGroups.length && ingredientResult.reason !== 'already-grouped') ||
        (stepGroups.length && stepResult.reason !== 'already-grouped')
      ) {
        skipped.push({
          slug: doc.slug,
          lang: doc.lang,
          ingredientReason: ingredientResult.reason,
          ingredientExpected: ingredientResult.expectedCount,
          ingredientCurrent: ingredientResult.currentCount,
          stepReason: stepResult.reason,
          stepExpected: stepResult.expectedCount,
          stepCurrent: stepResult.currentCount,
        });
      }
      continue;
    }

    const nextBlock = {
      ...firstBlock,
      ...(ingredientResult.changed ? { ingredients: ingredientResult.rows } : {}),
      ...(stepResult.changed ? { steps: stepResult.rows } : {}),
    };

    recipeBlocks[0] = nextBlock;
    if (ingredientResult.changed) stats.ingredientUpdated += 1;
    if (stepResult.changed) stats.stepUpdated += 1;
    stats.docsChanged += 1;

    if (apply) {
      const backupFile = path.join(
        backupDir,
        `${doc.slug || doc._id}-${doc.lang || 'na'}-${timestamp}-before.json`,
      );
      fs.writeFileSync(backupFile, JSON.stringify(doc, null, 2));

      await collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            recipeBlocks,
            updatedAt: new Date(),
          },
        },
      );

      if (preparedItems) {
        const index = findPreparedIndex(preparedItems, doc);
        if (index >= 0) {
          const currentPrepared = preparedItems[index];
          preparedItems[index] = {
            ...currentPrepared,
            recipeBlocks,
          };
          stats.preparedUpdated += 1;
        }
      }
    }
  }

  if (apply && preparedItems) {
    fs.writeFileSync(preparedPath, JSON.stringify(preparedItems, null, 2));
  }

  const report = {
    dryRun: !apply,
    preparedBackupPath,
    reportPath,
    stats,
    skipped: skipped.slice(0, 50),
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.close().catch(() => undefined);
  });
