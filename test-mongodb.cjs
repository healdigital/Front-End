const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://atoolsood_db_user:S6CAKbYrmiyLkKFz@leo.cn7rilk.mongodb.net/lcdb?appName=Leo&retryWrites=true&w=majority";

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('lcdb');
    const article = await db.collection('articles').findOne({ "slug": "إبينال-تارت", "lang": "ar" });
    if (article) {
      console.log("MongoDB Ingredients:");
      console.log(JSON.stringify(article.recipeBlocks[0].ingredients.slice(0, 3), null, 2));
    } else {
      console.log("Not found in Mongo");
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}
main();
