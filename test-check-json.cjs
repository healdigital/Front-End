const fs = require('fs');

const data = JSON.parse(fs.readFileSync('prepared-articles.json', 'utf-8'));
const article = data.find(a => a.lang === 'ar' && a.title && a.title.includes('إبينال تارت'));

if (article && article.recipeBlocks && article.recipeBlocks[0]) {
  console.log("Title: " + article.title);
  console.log("Ingredients for recipe block 0:");
  console.log(JSON.stringify(article.recipeBlocks[0].ingredients.slice(0, 5), null, 2));
} else {
  console.log("Article not found or no recipe blocks.");
}
