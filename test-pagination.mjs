import { getArticlesCountFromMongo } from './src/lib/mongo.server.js';

async function testPagination() {
  try {
    const totalCount = await getArticlesCountFromMongo();
    const articlesPerPage = 10;
    const totalPages = Math.max(1, Math.ceil(totalCount / articlesPerPage));

    console.log('📊 Pagination Test Results:');
    console.log('Total articles:', totalCount);
    console.log('Articles per page:', articlesPerPage);
    console.log('Total pages:', totalPages);
    console.log('Should show pagination:', totalPages > 1);

    if (totalPages === 1) {
      console.log('❌ Pagination will not show because totalPages = 1');
    } else {
      console.log('✅ Pagination should show with', totalPages, 'pages');
    }
  } catch (error) {
    console.error('❌ Error testing pagination:', error);
  }
}

testPagination();