#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const INPUT_PATH = path.join(process.cwd(), 'prepared-articles.json');
const DESKTOP = process.env.HOME || process.env.USERPROFILE || process.env.USERPROFILE;
const OUTPUT_PATH = path.join(DESKTOP, 'Desktop', 'LCDB-Prepared-JSON', 'prepared-articles-DEDUP.json');

async function main() {
  console.log('Loading prepared-articles.json...');
  const raw = fs.readFileSync(INPUT_PATH, 'utf8');
  const articles = JSON.parse(raw);
  console.log(`Total articles: ${articles.length}`);

  const seen = new Map();
  const deduped = [];

  for (const article of articles) {
    const lang = article.lang || 'fr';
    const slug = article.slug || '';
    const key = `${lang}:${slug}`;

    if (!seen.has(key)) {
      seen.set(key, article);
      deduped.push(article);
    }
  }

  console.log(`\nDeduplicated: ${deduped.length} articles`);
  console.log(`Removed: ${articles.length - deduped.length} duplicates`);

  const byLang = {};
  for (const a of deduped) {
    const lang = a.lang || 'fr';
    byLang[lang] = (byLang[lang] || 0) + 1;
  }
  console.log('\nBy language:');
  for (const [lang, count] of Object.entries(byLang)) {
    console.log(`  ${lang}: ${count}`);
  }

  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(deduped, null, 2), 'utf8');
  console.log(`\nSaved to: ${OUTPUT_PATH}`);
}

main().catch(console.error);