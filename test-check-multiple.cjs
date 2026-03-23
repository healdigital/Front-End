const fs = require('fs');
const data = JSON.parse(fs.readFileSync('prepared-articles.json', 'utf-8'));
const articles = data.filter(a => a.lang === 'ar' && a.title && a.title.includes('إبينال تارت'));

console.log(`Found ${articles.length} articles matching title.`);
articles.forEach((a, index) => {
  console.log(`\n--- Article ${index+1} (ID: ${a._id}) ---`);
  console.log("Ingredients:", JSON.stringify(a.recipeBlocks[0].ingredients.slice(0, 2)));
});
