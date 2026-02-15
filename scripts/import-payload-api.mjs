import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PREPARED_FILE = path.join(__dirname, '../prepared-articles.json');
const PAYLOAD_API = process.env.PAYLOAD_API_URL || 'http://localhost:3000/api';
const PAYLOAD_TOKEN = process.env.PAYLOAD_TOKEN || '';

/**
 * Import prepared articles to PayloadCMS via REST API
 */
async function importToPaylodCMS() {
  try {
    console.log('🚀 Importing articles to PayloadCMS...\n');
    
    // Read prepared articles
    if (!fs.existsSync(PREPARED_FILE)) {
      console.error('❌ prepared-articles.json not found. Run: npm run prepare:articles');
      process.exit(1);
    }
    
    const articles = JSON.parse(fs.readFileSync(PREPARED_FILE, 'utf-8'));
    console.log(`📦 Found ${articles.length} articles to import\n`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Import each article
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      const progress = `[${i + 1}/${articles.length}]`;
      
      try {
        console.log(`${progress} Importing: ${article.title.substring(0, 50)}...`);
        
        // Create article via PayloadCMS REST API
        const response = await fetch(`${PAYLOAD_API}/articles`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(PAYLOAD_TOKEN && { 'Authorization': `Bearer ${PAYLOAD_TOKEN}` })
          },
          body: JSON.stringify(article)
        });
        
        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorData}`);
        }
        
        const result = await response.json();
        console.log(`   ✓ Created with ID: ${result.id || result.doc?._id}`);
        successCount++;
        
        // Add small delay to avoid overwhelming the server
        if ((i + 1) % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        errorCount++;
        errors.push({
          title: article.title,
          error: error.message
        });
        console.error(`   ✗ Error: ${error.message}`);
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total articles: ${articles.length}`);
    console.log(`✅ Successfully imported: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    
    if (errors.length > 0 && errors.length <= 10) {
      console.log('\nFirst errors:');
      errors.slice(0, 10).forEach(err => {
        console.log(`  - ${err.title}: ${err.error}`);
      });
    }
    
    console.log('\n✅ Import complete!\n');
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

importToPaylodCMS();
