const fs = require('fs');
const data = JSON.parse(fs.readFileSync('prepared-articles.json', 'utf-8'));
const article = data.find(a => a.lang === 'ar' && a.title && a.title.includes('إبينال تارت'));

if (article) {
  fs.writeFileSync('test-check-out.json', JSON.stringify(article, null, 2));
  console.log("Written full article payload to test-check-out.json");
} else {
  console.log("Article not found.");
}
