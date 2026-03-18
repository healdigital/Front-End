import fs from 'fs/promises';
import path from 'path';

const inputArg = process.argv[2] || 'payload-admin/legcy.html';
const outputArg = process.argv[3] || 'tmp/legacy-article-parsed.json';
const titleArg = process.argv[4] || 'Legacy Article Test';
const slugArg = process.argv[5] || 'legacy-article-test';

const inputPath = path.resolve(process.cwd(), inputArg);
const outputPath = path.resolve(process.cwd(), outputArg);

const NAMED_ENTITIES = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

const decodeHtmlEntities = (value) =>
  String(value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (_, name) => NAMED_ENTITIES[name.toLowerCase()] ?? `&${name};`);

const stripTags = (html) =>
  decodeHtmlEntities(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

const makeLexicalParagraph = (text) => ({
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
  type: 'paragraph',
  version: 1,
});

const buildLexicalRoot = (paragraphs) => ({
  root: {
    children: paragraphs.map(makeLexicalParagraph),
    direction: null,
    format: '',
    indent: 0,
    text: '',
    type: 'root',
    version: 1,
  },
});

const cleanText = (value) =>
  stripTags(value)
    .replace(/\s+/g, ' ')
    .trim();

const extractSection = (html, startRegex, endRegex) => {
  const startMatch = startRegex.exec(html);
  if (!startMatch || startMatch.index === undefined) return '';

  const startIndex = startMatch.index;
  const afterStart = html.slice(startIndex + startMatch[0].length);
  const endMatch = endRegex.exec(afterStart);
  const endIndex = endMatch && endMatch.index !== undefined ? startIndex + startMatch[0].length + endMatch.index : html.length;
  return html.slice(startIndex, endIndex);
};

const extractServings = (html) => {
  const servingsMatch = html.match(
    /class="[^"]*wprm-recipe-servings[^"]*"[^>]*>\s*([^<]+?)\s*<\/span>\s*<span class="[^"]*wprm-recipe-servings-unit[^"]*"[^>]*>\s*([^<]+?)\s*<\/span>/i,
  );

  if (!servingsMatch) {
    return { servings: '', servingsCount: 1 };
  }

  const amountText = cleanText(servingsMatch[1]);
  const unitText = cleanText(servingsMatch[2]);
  const countMatch = amountText.match(/(\d+(?:[.,]\d+)?)/);
  const servingsCount = countMatch ? Math.max(1, Math.round(Number(countMatch[1].replace(',', '.')))) : 1;

  return {
    servings: [amountText, unitText].filter(Boolean).join(' ').trim(),
    servingsCount,
  };
};

const extractGroupedIngredients = (ingredientsHtml) => {
  const groups = [];
  const groupRegex =
    /<h4[^>]*class="[^"]*wprm-recipe-ingredient-group-name[^"]*"[^>]*>([\s\S]*?)<\/h4>\s*<ul[^>]*class="[^"]*wprm-recipe-ingredients[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi;

  let groupMatch;
  while ((groupMatch = groupRegex.exec(ingredientsHtml))) {
    groups.push({
      label: cleanText(groupMatch[1]),
      listHtml: groupMatch[2],
    });
  }

  if (groups.length > 0) return groups;

  const standaloneListMatch = ingredientsHtml.match(/<ul[^>]*class="[^"]*wprm-recipe-ingredients[^"]*"[^>]*>([\s\S]*?)<\/ul>/i);
  return standaloneListMatch ? [{ label: '', listHtml: standaloneListMatch[1] }] : [];
};

const extractIngredients = (ingredientsHtml) => {
  const groups = extractGroupedIngredients(ingredientsHtml);
  const rows = [];

  for (const group of groups) {
    const liRegex = /<li[^>]*class="[^"]*wprm-recipe-ingredient[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;

    while ((liMatch = liRegex.exec(group.listHtml))) {
      const liHtml = liMatch[1];
      const quantity = cleanText(liHtml.match(/wprm-recipe-ingredient-amount[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
      const unit = cleanText(liHtml.match(/wprm-recipe-ingredient-unit[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
      const item = cleanText(liHtml.match(/wprm-recipe-ingredient-name[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
      const notes = cleanText(liHtml.match(/wprm-recipe-ingredient-notes[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');

      if (!item && !quantity && !unit && !notes) continue;

      const groupNote = group.label ? `Group: ${group.label}` : '';
      const mergedNotes = [groupNote, notes].filter(Boolean).join(' | ');

      rows.push({
        item,
        notes: mergedNotes,
        quantity: [quantity, unit].filter(Boolean).join(' ').trim(),
      });
    }
  }

  return rows;
};

const extractSteps = (instructionsHtml) => {
  const steps = [];
  const stepRegex =
    /<li[^>]*class="[^"]*wprm-recipe-instruction[^"]*"[^>]*>[\s\S]*?<div[^>]*class="[^"]*wprm-recipe-instruction-text[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<\/li>/gi;

  let stepMatch;
  while ((stepMatch = stepRegex.exec(instructionsHtml))) {
    const instruction = stripTags(stepMatch[1]).replace(/\s+/g, ' ').trim();
    if (!instruction) continue;
    steps.push({ instruction });
  }

  return steps;
};

const extractIntroParagraphs = (html) => {
  const recipeBlockIndex = html.search(/<div id="recipe-\d+-ingredients"/i);
  const introHtml = recipeBlockIndex >= 0 ? html.slice(0, recipeBlockIndex) : html;
  const paragraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  const paragraphs = [];
  let paragraphMatch;

  while ((paragraphMatch = paragraphRegex.exec(introHtml))) {
    const text = cleanText(paragraphMatch[1]);
    if (!text) continue;
    if (/^recette pour/i.test(text) || /^pour une\b/i.test(text)) continue;
    if (/^vous avez essaye/i.test(text)) continue;
    paragraphs.push(text);
  }

  return paragraphs.slice(0, 6);
};

const normalizeOutput = ({ content, ingredients, instructions, introParagraphs, servings }) => ({
  _status: 'draft',
  author: null,
  categories: [],
  content,
  contentBlocks: [],
  contentV2: buildLexicalRoot(
    introParagraphs.length > 0
      ? introParagraphs
      : ['Legacy HTML imported for testing. Review and refine before publishing.'],
  ),
  excerpt: introParagraphs[0] || '',
  featuredMedia: null,
  imageBlocks: [],
  lang: 'fr',
  noIndex: false,
  readyForPublication: false,
  recipeBlocks: [
    {
      blockType: 'recipeCard',
      cookingTimeMinutes: 0,
      cuisine: '',
      difficulty: 'medium',
      dishType: '',
      ingredients: ingredients.length > 0 ? ingredients : [{ item: '', notes: '', quantity: '' }],
      preparationTimeMinutes: 0,
      recipeType: 'other',
      servings: servings.servings,
      servingsCount: servings.servingsCount,
      steps: instructions.length > 0 ? instructions : [{ instruction: '' }],
      title: 'Recipe card',
    },
  ],
  slug: slugArg,
  tags: [],
  title: titleArg,
  translationReviewStatus: 'not_required',
});

const main = async () => {
  const html = await fs.readFile(inputPath, 'utf8');
  const ingredientsHtml = extractSection(
    html,
    /<div id="recipe-\d+-ingredients"[\s\S]*?>/i,
    /<div id="recipe-\d+-instructions"[\s\S]*?>/i,
  );
  const instructionsHtml = extractSection(
    html,
    /<div id="recipe-\d+-instructions"[\s\S]*?>/i,
    /<div class="xs_social_share_widget|<div class="wprm-call-to-action/i,
  );

  const ingredients = extractIngredients(ingredientsHtml);
  const instructions = extractSteps(instructionsHtml);
  const introParagraphs = extractIntroParagraphs(html);
  const servings = extractServings(html);

  const output = normalizeOutput({
    content: html,
    ingredients,
    instructions,
    introParagraphs,
    servings,
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`Parsed legacy HTML: ${path.relative(process.cwd(), inputPath)}`);
  console.log(`Ingredients extracted: ${ingredients.length}`);
  console.log(`Steps extracted: ${instructions.length}`);
  console.log(`Output written to: ${path.relative(process.cwd(), outputPath)}`);
};

main().catch((error) => {
  console.error('Legacy HTML parse failed:', error);
  process.exit(1);
});
