import { MongoClient } from 'mongodb';
import translate from 'google-translate-api-x';

const uri = "mongodb+srv://atoolsood_db_user:S6CAKbYrmiyLkKFz@leo.cn7rilk.mongodb.net/lcdb?appName=Leo&retryWrites=true&w=majority";

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function processArticle(article, collection) {
  let needsUpdate = false;
  let textToTranslate = [];
  
  // collect references to properties to quickly update later
  let refsToUpdate = [];

  const isLatin = (str) => {
    return /[a-zA-ZÀ-ÿ]/.test(str);
  };

  const traverseAndCollect = (obj, key) => {
    if (obj && typeof obj[key] === 'string' && isLatin(obj[key])) {
      textToTranslate.push(obj[key]);
      refsToUpdate.push({ obj, key });
    }
  };

  if (!article.recipeBlocks || article.recipeBlocks.length === 0) {
    return false;
  }

  for (const block of article.recipeBlocks) {
    if (block.servings && typeof block.servings === 'string' && block.servings.includes('personnes')) {
      block.servings = block.servings.replace('personnes', 'أشخاص');
      needsUpdate = true;
    }

    if (block.ingredients) {
      for (const ing of block.ingredients) {
        traverseAndCollect(ing, 'item');
        traverseAndCollect(ing, 'groupHeading');
      }
    }
    
    if (block.steps) {
      for (const step of block.steps) {
        traverseAndCollect(step, 'instruction');
        traverseAndCollect(step, 'groupHeading');
      }
    }
  }

  if (textToTranslate.length === 0 && !needsUpdate) {
    return false;
  }

  if (textToTranslate.length > 0) {
    try {
      // Split into safe sized chunks to not overwhelm free API
      const translatedTexts = [];
      const chunkSize = 20;
      for (let i = 0; i < textToTranslate.length; i += chunkSize) {
        const chunk = textToTranslate.slice(i, i + chunkSize);
        const res = await translate(chunk, { to: 'ar' });
        if (Array.isArray(res)) {
           translatedTexts.push(...res.map(r => r.text));
        } else {
           translatedTexts.push(res.text); // Single item returned
        }
        await delay(500); // 500ms between chunks
      }

      for (let i = 0; i < refsToUpdate.length; i++) {
        refsToUpdate[i].obj[refsToUpdate[i].key] = translatedTexts[i];
      }
      needsUpdate = true;
    } catch (e) {
      console.error(`Translation error on article ${article.slug}:`, e.message);
      return false; // Skip updating this article if translation failed
    }
  }

  if (needsUpdate) {
    try {
      await collection.updateOne(
        { _id: article._id },
        { $set: { recipeBlocks: article.recipeBlocks } }
      );
      return true;
    } catch(e) {
      console.error(`DB Update Error on article ${article.slug}:`, e);
      return false;
    }
  }
  return false;
}

async function main() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('lcdb');
    const collection = db.collection('articles');

    console.log("Fetching arabic articles...");
    const articlesCursor = await collection.find(
      { lang: 'ar', recipeBlocks: { $exists: true, $not: { $size: 0 } } },
      { projection: { _id: 1, slug: 1, recipeBlocks: 1 } }
    );
    const articles = await articlesCursor.toArray();
    console.log(`Found ${articles.length} Arabic articles with recipe blocks.`);

    let updatedCount = 0;
    
    for (let i = 0; i < articles.length; i++) {
       const article = articles[i];
       
       const didUpdate = await processArticle(article, collection);
       if (didUpdate) {
          updatedCount++;
       }
       if (i % 20 === 0) {
          console.log(`Progress: ${i}/${articles.length} (Updated: ${updatedCount})`);
       }
       await delay(300); // Small pause to prevent 429
    }
    
    console.log(`Finished processing. Successfully updated ${updatedCount} articles.`);
  } catch (err) {
    console.error("Critical error:", err);
  } finally {
    await client.close();
  }
}

main();
