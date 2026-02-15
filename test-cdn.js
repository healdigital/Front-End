import { replaceCdnUrl, processArticleImageUrl } from './src/utils/cdnUrlReplacer.ts';

// Test the replaceCdnUrl function
const oldUrl = 'https://cdn.lacuisinedebernard.com/wp-content/uploads/2019/08/11213052/IMG_6684-2.jpg';
const newUrl = replaceCdnUrl(oldUrl);
console.log('Old URL:', oldUrl);
console.log('New URL:', newUrl);
console.log('Replacement working:', newUrl.includes('lcdb.fra1.digitaloceanspaces.com'));

// Test with an article object
const testArticle = {
  featured_image: {
    asset: {
      url: 'https://cdn.lacuisinedebernard.com/wp-content/uploads/2019/08/11213052/IMG_6684-2.jpg'
    }
  }
};

const processedUrl = processArticleImageUrl(testArticle);
console.log('Processed article image URL:', processedUrl);
console.log('Article URL replacement working:', processedUrl.includes('lcdb.fra1.digitaloceanspaces.com'));