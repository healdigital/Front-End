// Test what the Payload API returns for articles
const testAPIResponse = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/articles?limit=1&depth=2', {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.docs && data.docs.length > 0) {
      const article = data.docs[0];
      console.log('\n📊 Payload API Response for Article:');
      console.log('Title:', article.title);
      console.log('\n🔑 Available fields:', Object.keys(article).sort());
      
      console.log('\n📸 Image-related fields:');
      console.log('featured_img_url:', article.featured_img_url);
      console.log('featured_image:', article.featured_image);
      console.log('featureImage:', article.featureImage);
      
      console.log('\n📋 Full article (first 2000 chars):');
      console.log(JSON.stringify(article, null, 2).substring(0, 2000));
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

testAPIResponse();
