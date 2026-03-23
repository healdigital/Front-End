import fs from 'fs';
import { resolve } from 'path';
import { MongoClient } from 'mongodb';
import translate from 'google-translate-api-x';

const uri = "mongodb+srv://atoolsood_db_user:S6CAKbYrmiyLkKFz@leo.cn7rilk.mongodb.net/lcdb?appName=Leo&retryWrites=true&w=majority";
const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function main() {
  const filePath = resolve('./prepared-articles.json');
  console.log("Loading prepared-articles.json into memory...");
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('lcdb');
    const collection = db.collection('articles');

    console.log("Fetching arabic articles from DB...");
    const articlesCursor = await collection.find(
      { lang: 'ar', recipeBlocks: { $exists: true, $not: { $size: 0 } } },
      { projection: { _id: 1, slug: 1, recipeBlocks: 1 } }
    );
    const articles = await articlesCursor.toArray();
    console.log(`Found ${articles.length} Arabic articles in DB.`);

    const isLatin = (str) => /[a-zA-ZÀ-ÿ]/.test(str);
    const traverseAndCollect = (obj, key, textToTranslate, refsToUpdate) => {
      if (obj && typeof obj[key] === 'string' && isLatin(obj[key])) {
        textToTranslate.push(obj[key]);
        refsToUpdate.push({ obj, key });
      }
    };

    let updatedCount = 0;

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      console.log(`Processing article ${i+1}/${articles.length}: ${article.slug}`);
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
          const chunkSize = 15; // smaller chunks
          for (let j = 0; j < textToTranslate.length; j += chunkSize) {
            const chunk = textToTranslate.slice(j, j + chunkSize);
            const res = await translate(chunk, { to: 'ar', client: 'gtx' });
            if (Array.isArray(res)) {
               translatedTexts.push(...res.map(r => r.text));
            } else {
               translatedTexts.push(res.text); 
            }
            await delay(1200); // 1.2s delay to prevent 429
          }

          for (let j = 0; j < refsToUpdate.length; j++) {
            if (translatedTexts[j]) {
              refsToUpdate[j].obj[refsToUpdate[j].key] = translatedTexts[j];
            }
          }
          needsUpdate = true;
        } catch (e) {
          console.error(`Translation error on article ${article.slug}:`, e.message);
          await delay(5000); // wait before continuing
          continue; 
        }
      }

      if (needsUpdate) {
        // Update DB
        try {
          await collection.updateOne(
            { _id: article._id },
            { $set: { recipeBlocks: article.recipeBlocks } }
          );
          
          // Update JSON structure
          const targetJsonId = article._id.toString();
          const targetJsonArticle = data.find(x => 
              (x._id && x._id.toString() === targetJsonId) || 
              x.slug === article.slug
          );
          
          if (targetJsonArticle) {
            targetJsonArticle.recipeBlocks = article.recipeBlocks;
          }
          
          updatedCount++;
        } catch(e) {
          console.error(`DB Update Error on article ${article.slug}:`, e);
        }
      }
      
      if (updatedCount > 0 && updatedCount % 10 === 0 && needsUpdate) {
         console.log(`Combined Progress: Checked ${i+1}/${articles.length} (Actually Updated: ${updatedCount})`);
         fs.writeFileSync('prepared-articles.json.tmp', JSON.stringify(data));
         fs.renameSync('prepared-articles.json.tmp', filePath);
      }
    }

    console.log(`Finished processing! Successfully modified and synced ${updatedCount} articles to MongoDB and json.`);
    fs.writeFileSync('prepared-articles.json.tmp', JSON.stringify(data));
    fs.renameSync('prepared-articles.json.tmp', filePath);
    
  } catch (err) {
    console.error("Critical error:", err);
  } finally {
    await client.close();
  }
}

main();
