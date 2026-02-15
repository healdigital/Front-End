#!/usr/bin/env node

/**
 * Test Import - Single Article (ID 331)
 * Tests if import is working correctly before full import
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@sanity/client';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const client = createClient({
  projectId: process.env.PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.PUBLIC_SANITY_DATASET || 'production',
  apiVersion: process.env.PUBLIC_SANITY_API_VERSION || '2024-01-15',
  useCdn: false,
  token: process.env.SANITY_AUTH_TOKEN,
});

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Helper function to extract text from HTML
function extractTextFromHTML(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

async function testImportSingle() {
  log('\n🧪 TEST IMPORT - SINGLE ARTICLE (ID 331)\n', 'blue');
  log('==========================================\n', 'blue');
  
  try {
    // Check environment
    if (!process.env.PUBLIC_SANITY_PROJECT_ID) {
      log('❌ ERROR: PUBLIC_SANITY_PROJECT_ID not set in .env.local', 'red');
      process.exit(1);
    }
    
    if (!process.env.SANITY_AUTH_TOKEN) {
      log('❌ ERROR: SANITY_AUTH_TOKEN not set in .env.local', 'red');
      process.exit(1);
    }
    
    log('✓ Environment variables loaded', 'green');
    log(`  Project ID: ${process.env.PUBLIC_SANITY_PROJECT_ID}`, 'yellow');
    log(`  Dataset: ${process.env.PUBLIC_SANITY_DATASET || 'production'}`, 'yellow');
    log(`  Token: ${process.env.SANITY_AUTH_TOKEN.substring(0, 10)}...`, 'yellow');
    
    // Read post-1.json
    const filePath = path.join(process.cwd(), 'All Articles', 'post-1.json');
    log(`\n📖 Reading file: ${filePath}`, 'blue');
    
    if (!fs.existsSync(filePath)) {
      log(`❌ ERROR: File not found: ${filePath}`, 'red');
      process.exit(1);
    }
    
    const fileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const posts = fileData.posts || [];
    
    log(`✓ File loaded, found ${posts.length} articles\n`, 'green');
    
    // Find article with ID 331
    const article = posts.find(p => p.id === 331);
    
    if (!article) {
      log('❌ ERROR: Article with ID 331 not found in post-1.json', 'red');
      log(`Available IDs: ${posts.map(p => p.id).join(', ')}`, 'yellow');
      process.exit(1);
    }
    
    log('✓ Found article ID 331', 'green');
    log(`  Title: "${article.title.rendered}"`, 'yellow');
    log(`  Language: ${article.lang || 'en'}`, 'yellow');
    log(`  Date: ${article.date}`, 'yellow');
    
    const commentCount = (article.comments || []).length;
    log(`  Comments: ${commentCount}\n`, 'yellow');
    
    // Prepare article document
    const htmlContent = article.content?.rendered || '';
    const htmlExcerpt = article.excerpt?.rendered || '';
    const articleId = `wp-article-${article.id}`;
    
    log('📝 Creating article document...', 'blue');
    
    const articleDoc = {
      _type: 'article',
      _id: articleId,
      title: article.title.rendered || 'Untitled',
      slug: {
        _type: 'slug',
        current: article.slug || `article-${article.id}`,
      },
      content: htmlContent ? [{
        _type: 'block',
        _key: 'html-content',
        style: 'normal',
        children: [{
          _type: 'span',
          _key: 'html-span',
          text: htmlContent,
          marks: []
        }],
        markDefs: []
      }] : [],
      excerpt: htmlExcerpt ? [{
        _type: 'block',
        _key: 'html-excerpt',
        style: 'normal',
        children: [{
          _type: 'span',
          _key: 'excerpt-span',
          text: htmlExcerpt,
          marks: []
        }],
        markDefs: []
      }] : [],
      date: article.date || new Date().toISOString(),
      modified: article.modified || article.date || new Date().toISOString(),
      status: article.status || 'publish',
      postType: article.type || 'post',
      authorName: article.author_name || `Author ${article.author || 'Unknown'}`,
      categories: article.categories || [],
      tags: article.tags || [],
      featuredImageUrl: article.featured_image_src || '',
      lang: article.lang || 'en',
      rating: {
        average: article.rating?.average || 0,
        count: article.rating?.count || 0,
        total: article.rating?.total || 0,
      },
      wordpressId: article.id,
      wordpressUrl: article.link || '',
      metadata: {
        comment_status: article.comment_status || 'open',
        ping_status: article.ping_status || 'open',
        sticky: article.sticky || false,
        format: article.format || 'standard',
        content_type: article.meta?.['content-type'] || '',
      }
    };
    
    log('✓ Article document prepared', 'green');
    
    // Prepare comment documents
    const commentDocs = [];
    log(`🔍 Checking for comments...`, 'blue');
    log(`   • article.comments exists: ${!!article.comments}`, 'yellow');
    log(`   • article.comments is array: ${Array.isArray(article.comments)}`, 'yellow');
    log(`   • comment count: ${(article.comments || []).length}\n`, 'yellow');
    
    if (article.comments && Array.isArray(article.comments)) {
      log(`📝 Processing ${article.comments.length} comments...`, 'blue');
      for (let i = 0; i < article.comments.length; i++) {
        const comment = article.comments[i];
        log(`   Comment ${i + 1}: ID=${comment.id}, Author=${comment.author}`, 'yellow');
        
        if (comment.id && comment.author) {
          const commentDoc = {
            _type: 'comment',
            _id: `wp-comment-${comment.id}`,
            author: comment.author || 'Anonymous',
            email: comment.email || '',
            content: extractTextFromHTML(comment.content),
            date: comment.date || new Date().toISOString(),
            approved: comment.approved !== false,
            articleRef: {
              _type: 'reference',
              _ref: articleId
            },
            wordpressId: comment.id,
            parentCommentId: comment.parent || null,
          };
          commentDocs.push(commentDoc);
          log(`   ✓ Added to queue`, 'green');
        } else {
          log(`   ✗ Skipped (missing ID or author)`, 'red');
        }
      }
    }
    
    log(`\n✓ Prepared ${commentDocs.length} comment documents\n`, 'green');
    
    // Upload to Sanity
    log('🚀 Uploading to Sanity...', 'blue');
    log(`   • Article: 1 document`, 'yellow');
    log(`   • Comments: ${commentDocs.length} documents`, 'yellow');
    log(`   • Total: ${1 + commentDocs.length} documents\n`, 'yellow');
    
    const transaction = client.transaction();
    log('📦 Creating transaction...', 'blue');
    transaction.createIfNotExists(articleDoc);
    log(`   ✓ Article added to transaction`, 'green');
    
    for (let i = 0; i < commentDocs.length; i++) {
      const commentDoc = commentDocs[i];
      transaction.createIfNotExists(commentDoc);
      log(`   ✓ Comment ${i + 1} added to transaction`, 'green');
    }
    
    log(`\n⏳ Sending ${1 + commentDocs.length} documents to Sanity...\n`, 'blue');
    const result = await transaction.commit();
    
    log(`\n✅ UPLOAD SUCCESSFUL!\n`, 'green');
    log('📊 Results:', 'green');
    log(`   ✓ Article created: ${articleId}`, 'green');
    log(`   ✓ Comments created: ${commentDocs.length}`, 'green');
    log(`   ✓ Total documents: ${1 + commentDocs.length}`, 'green');
    
    log('\n✨ Test import completed successfully!', 'green');
    log('\nYou can now:');
    log('  1. Check in Sanity Studio at http://localhost:3333', 'yellow');
    log('  2. Run full import: node scripts/import-full-html.mjs', 'yellow');
    log('  3. Verify comment links and ratings are working', 'yellow');
    
  } catch (error) {
    log(`\n❌ ERROR:`, 'red');
    log(`${error.message}`, 'red');
    
    if (error.response) {
      log(`\nAPI Response:`, 'red');
      log(`  Status: ${error.response.status}`, 'red');
      log(`  Message: ${error.response.body?.message || 'No message'}`, 'red');
    }
    
    process.exit(1);
  }
}

testImportSingle();
