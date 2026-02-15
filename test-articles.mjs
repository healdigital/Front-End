import { getAllArticlesFromMongo } from './src/lib/mongo.server.ts';

async function testArticles() {
  try {
    const articles = await getAllArticlesFromMongo();
    if (articles && articles.length > 0) {
      console.log('Total articles:', articles.length);
      console.log('First article:');
      console.log('- Title:', articles[0].title);
      console.log('- Slug:', articles[0].slug);
      console.log('- Categories:', JSON.stringify(articles[0].categories, null, 2));
      console.log('- Category count:', articles[0].categories?.length || 0);

      // Check category format
      if (articles[0].categories && articles[0].categories.length > 0) {
        console.log('First category structure:', typeof articles[0].categories[0], articles[0].categories[0]);
      }
    } else {
      console.log('No articles found');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testArticles();