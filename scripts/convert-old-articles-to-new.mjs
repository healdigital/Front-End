import fs from 'fs/promises';
import path from 'path';

/**
 * Quick conversion from the old WordPress-export JSON format (old-article.json)
 * into the shape used by the “new” article JSON (single-article.json).
 *
 * This is meant to be a starting point: it keeps your legacy HTML in `content`
 * and creates a minimal `contentV2` structure so the new schema is satisfied.
 */

const inputPath = path.resolve(process.cwd(), 'old-article.json');
const outputPath = path.resolve(process.cwd(), 'old-article-converted.json');

function htmlToPlainText(html) {
  if (!html || typeof html !== 'string') return '';
  // Very basic cleanup; for best results use a proper HTML parser.
  const cleaned = html
    // Remove common social/share widget blocks that add noise
    .replace(/<div[^>]*class="[^"]*xs_social_share_widget[^"]*"[\s\S]*?<\/div>\s*/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();

  return cleaned;
}

function extractListItems(html, headerRegexes) {
  if (!html || typeof html !== 'string') return [];

  for (const regex of headerRegexes) {
    const match = html.match(regex);
    if (!match) continue;

    // Slice from the match end to find the next <ul> or <ol>
    const afterHeader = html.slice(match.index + match[0].length);
    const listMatch = afterHeader.match(/<\s*(ul|ol)[^>]*>([\s\S]*?)<\s*\/\s*\1\s*>/i);
    if (!listMatch) continue;

    const listHtml = listMatch[2];
    const items = [];
    let liMatch;
    const liRegex = /<\s*li[^>]*>([\s\S]*?)<\s*\/\s*li\s*>/gi;

    while ((liMatch = liRegex.exec(listHtml))) {
      const itemText = htmlToPlainText(liMatch[1]);
      if (itemText) items.push(itemText);
    }

    if (items.length) return items;
  }

  return [];
}

function makeLexicalParagraph(text) {
  return {
    type: 'paragraph',
    version: 1,
    children: [
      {
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
        text,
        type: 'text',
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    textFormat: 0,
    textStyle: '',
  };
}

function getRendered(field) {
  // WordPress JSON exports typically store HTML in { rendered: string }
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && typeof field.rendered === 'string') return field.rendered;
  return '';
}

function convertArticle(old) {
  const contentRendered = getRendered(old.content || old.excerpt || '');
  const plain = htmlToPlainText(contentRendered);

  // Attempt to extract ingredients and steps from HTML content.
  // This is heuristic and will work best when the HTML includes headings like
  // "Ingrédients" / "Ingredients" and "Instructions" / "Préparation".
  const ingredientLines = extractListItems(contentRendered, [
    /<h[1-6][^>]*>\s*Ingr[ée]dients?\s*<\/h[1-6]>/i,
    /<p[^>]*>\s*Ingr[ée]dients?\s*<\/p>/i,
    /<h[1-6][^>]*>\s*Ingredients?\s*<\/h[1-6]>/i,
  ]);

  const instructionLines = extractListItems(contentRendered, [
    /<h[1-6][^>]*>\s*(Instructions?|Préparation|Preparation)\s*<\/h[1-6]>/i,
    /<p[^>]*>\s*(Instructions?|Préparation|Preparation)\s*<\/p>/i,
  ]);

  return {
    // Standard meta fields used in the new schema
    title: getRendered(old.title) || '',
    slug: old.slug || '',
    excerpt: getRendered(old.excerpt) || '',
    date: old.date || new Date().toISOString(),
    updatedAt: old.updatedAt || old.modified || new Date().toISOString(),
    lang: old.lang || 'fr',

    // Legacy HTML is preserved in `content` (read-only in admin UI)
    content: contentRendered,

    // Minimal Lexical JSON for contentV2 (used by the editor)
    contentV2: {
      root: {
        type: 'root',
        version: 1,
        format: '',
        indent: 0,
        direction: null,
        text: '',
        children: [makeLexicalParagraph(plain)],
      },
    },

    // Keep existing category/tag objects (if any) in place
    categories: old.categories || [],
    tags: old.tags || [],

    // Keep the original author object if present (new schema stores a relation object)
    author: old.author || null,

    // Minimal recipeBlocks so the new schema validation passes
    recipeBlocks: [
      {
        blockType: 'recipeCard',
        title: getRendered(old.title) || 'Recipe card',
        preparationTimeMinutes: 0,
        cookingTimeMinutes: 0,
        servingsCount: 1,
        difficulty: 'medium',
        recipeType: 'other',
        dishType: '',
        cuisine: '',
        servings: '',
        ingredients: ingredientLines.length
          ? ingredientLines.map((item) => ({ quantity: '', item, notes: '', id: '' }))
          : [{ quantity: '', item: '', notes: '', id: '' }],
        steps: instructionLines.length
          ? instructionLines.map((step) => ({ instruction: step, id: '' }))
          : [{ instruction: '', id: '' }],
      },
    ],

    // Legacy feature-image object (kept for backward support)
    featuredImage: old.featuredImage ?? {},
    featuredMedia: old.featuredMedia ?? null,

    // Ensure the structure matches the new schema
    contentBlocks: old.contentBlocks || [],
    imageBlocks: old.imageBlocks || [],
    noIndex: old.noIndex ?? false,
    readyForPublication: old.readyForPublication ?? false,
    translationReviewStatus: old.translationReviewStatus ?? 'not_required',
    autoTranslateNow: old.autoTranslateNow ?? false,
    _status: old._status || 'published',
  };
}

async function main() {
  const raw = await fs.readFile(inputPath, 'utf-8');

  // Some legacy export JSON files may include trailing commas or other minor
  // syntax issues. Attempt to sanitize common problems before parsing.
  const sanitized = raw
    .replace(/,\s*\]/g, ']')
    .replace(/,\s*\}/g, '}');

  let parsed;
  try {
    parsed = JSON.parse(sanitized);
  } catch (err) {
    console.error('Failed to parse JSON after sanitization.');
    console.error(err);
    throw err;
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Expected an array of articles in old-article.json');
  }

  const converted = parsed.map(convertArticle);
  await fs.writeFile(outputPath, JSON.stringify(converted, null, 2), 'utf-8');
  console.log(`✅ Wrote converted file to ${outputPath} (entries: ${converted.length})`);
}

main().catch((err) => {
  console.error('❌ Conversion failed:', err);
  process.exit(1);
});
