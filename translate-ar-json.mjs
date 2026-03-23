import fs from 'fs';
import translate from 'google-translate-api-x';
import { resolve } from 'path';

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function main() {
  const filePath = resolve('./prepared-articles.json');
  console.log("Loading prepared-articles.json...");
  
  if (!fs.existsSync(filePath)) {
    console.error("File not found!");
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  const arArticles = data.filter(a => a.lang === 'ar' && a.recipeBlocks && a.recipeBlocks.length > 0);
  console.log(`Found ${arArticles.length} Arabic articles with recipeBlocks in JSON file.`);
  
  const isLatin = (str) => /[a-zA-ZÀ-ÿ]/.test(str);

  const traverseAndCollect = (obj, key, textToTranslate, refsToUpdate) => {
    if (obj && typeof obj[key] === 'string' && isLatin(obj[key])) {
      textToTranslate.push(obj[key]);
      refsToUpdate.push({ obj, key });
    }
  };

  let updatedCount = 0;

  for (let i = 0; i < arArticles.length; i++) {
    const article = arArticles[i];
    let needsUpdate = false;
    let textToTranslate = [];
    let refsToUpdate = [];

    for (const block of article.recipeBlocks) {
      if (block.servings && typeof block.servings === 'string' && block.servings.includes('personnes')) {
        block.servings = block.servings.replace('personnes', 'أشخاص');
        needsUpdate = true;
      }

      if (block.ingredients) {
        for (const ing of block.ingredients) {
          traverseAndCollect(ing, 'item', textToTranslate, refsToUpdate);
          traverseAndCollect(ing, 'groupHeading', textToTranslate, refsToUpdate);
        }
      }
      
      if (block.steps) {
        for (const step of block.steps) {
          traverseAndCollect(step, 'instruction', textToTranslate, refsToUpdate);
          traverseAndCollect(step, 'groupHeading', textToTranslate, refsToUpdate);
        }
      }
    }

    if (textToTranslate.length > 0) {
      try {
        const translatedTexts = [];
        const chunkSize = 20;
        for (let j = 0; j < textToTranslate.length; j += chunkSize) {
          const chunk = textToTranslate.slice(j, j + chunkSize);
          const res = await translate(chunk, { to: 'ar' });
          if (Array.isArray(res)) {
             translatedTexts.push(...res.map(r => r.text));
          } else {
             translatedTexts.push(res.text); // Single res returned
          }
          await delay(800); // 800ms offset to avoid overriding limits w/ the DB script
        }

        // Apply translations back to JSON structure's refs
        for (let j = 0; j < refsToUpdate.length; j++) {
          if (translatedTexts[j]) {
            refsToUpdate[j].obj[refsToUpdate[j].key] = translatedTexts[j];
          }
        }
        needsUpdate = true;
      } catch (e) {
        console.error(`Status API error on article ${article.slug}:`, e.message);
      }
    }

    if (needsUpdate) {
      updatedCount++;
    }
    
    if ((i+1) % 20 === 0) {
       console.log(`JSON Progress: ${i+1}/${arArticles.length} (Updated: ${updatedCount})`);
       fs.writeFileSync('prepared-articles.json.tmp', JSON.stringify(data));
       fs.renameSync('prepared-articles.json.tmp', filePath);
    }
    await delay(300); // extra buffer
  }

  console.log(`Finished JSON file modifications! Updated: ${updatedCount} articles.`);
  fs.writeFileSync('prepared-articles.json.tmp', JSON.stringify(data));
  fs.renameSync('prepared-articles.json.tmp', filePath);
  console.log("prepared-articles.json successfully saved over.");
}

main();
