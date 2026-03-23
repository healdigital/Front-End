import fs from 'fs';
import { MongoClient } from 'mongodb';

const uri = "mongodb+srv://atoolsood_db_user:S6CAKbYrmiyLkKFz@leo.cn7rilk.mongodb.net/lcdb?appName=Leo&retryWrites=true&w=majority";

async function main() {
  const filePath = 'prepared-articles.json';
  console.log("Loading JSON into memory...");
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('lcdb');
    
    console.log("Fetching finalized Arabic articles from DB...");
    const articles = await db.collection('articles').find(
      { lang: 'ar', recipeBlocks: { $exists: true, $not: { $size: 0 } } },
      { projection: { _id: 1, slug: 1, recipeBlocks: 1 } }
    ).toArray();

    let updated = 0;
    for (const article of articles) {
      const target = data.find(a => 
        (a._id && a._id.toString() === article._id.toString()) || 
        a.slug === article.slug
      );
      if (target) {
        // Force the JSON to have exactly what's fully translated in DB
        target.recipeBlocks = article.recipeBlocks;
        updated++;
      }
    }
    
    console.log(`Hard-Synced ${updated} Arabic articles from DB directly to JSON.`);
    fs.writeFileSync(filePath, JSON.stringify(data));
    console.log("prepared-articles.json completely refreshed and saved!");
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}
main();
