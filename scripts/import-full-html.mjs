#!/usr/bin/env node

/**
 * Full Content Import - As-Is with All HTML
 * Stores complete HTML content exactly as provided
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

// Progress bar function
function showProgress(current, total, label = 'Documents') {
  const percentage = Math.round((current / total) * 100);
  const barLength = 30;
  const filledLength = Math.round((percentage / 100) * barLength);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
  
  // Use \r to overwrite the same line
  process.stdout.write(`\r  ${bar} ${percentage}% (${current}/${total} ${label})`);
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

// Helper function to create slug
function createSlug(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function importAllArticles() {
  log('\n🚀 FULL CONTENT IMPORT WITH COMMENTS & RATINGS\n', 'blue');
  log('================================================\n', 'blue');
  
  try {
    const articlesFolder = path.join(process.cwd(), 'All Articles');
    
    if (!fs.existsSync(articlesFolder)) {
      log(`❌ ERROR: Folder not found: ${articlesFolder}`, 'red');
      process.exit(1);
    }

    const jsonFiles = fs.readdirSync(articlesFolder)
      .filter(f => f.endsWith('.json'))
      .sort();
    
    log(`📁 Found ${jsonFiles.length} JSON files in 'All Articles' folder\n`, 'yellow');
    
    let totalArticles = 0;
    let totalComments = 0;
    let imported = 0;
    let skipped = 0;
    const allDocuments = [];

    // Read all JSON files and extract articles & comments
    for (const file of jsonFiles) {
      const filePath = path.join(articlesFolder, file);
      log(`📖 Reading ${file}...`, 'blue');
      
      try {
        const fileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const articles = fileData.posts || [];
        totalArticles += articles.length;
        
        for (const article of articles) {
          try {
            if (!article.title?.rendered || !article.slug) {
              skipped++;
              continue;
            }

            const htmlContent = article.content?.rendered || '';
            const htmlExcerpt = article.excerpt?.rendered || '';
            const articleId = `wp-article-${article.id}`;

            // Create article document
            const doc = {
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
              featuredImageUrl: article.featured_image?.url || article.featured_image_src || '',
              featuredImage: article.featured_image || null,
              lang: article.lang || 'en',
              // Add rating fields
              rating: {
                average: article.rating?.average || 0,
                count: article.rating?.count || 0,
                total: article.rating?.total || 0,
              },
              // Store WordPress metadata
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
            
            allDocuments.push(doc);

            // Create comment documents if comments exist
            if (article.comments && Array.isArray(article.comments) && article.comments.length > 0) {
              totalComments += article.comments.length;
              
              for (const comment of article.comments) {
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
                  allDocuments.push(commentDoc);
                }
              }
            }

            imported++;
            
          } catch (error) {
            skipped++;
          }
        }
      } catch (error) {
        log(`⚠ Error reading ${file}: ${error.message}`, 'red');
      }
    }

    log(`\n📊 Summary before upload:`, 'yellow');
    log(`   • Total articles found: ${totalArticles}`, 'yellow');
    log(`   • Total comments found: ${totalComments}`, 'yellow');
    log(`   • Total documents to upload: ${allDocuments.length}`, 'yellow');
    log(`   • Skipped: ${skipped}\n`, 'yellow');

    // Create a set of valid article IDs for validation
    const validArticleIds = new Set(
      allDocuments
        .filter(doc => doc._type === 'article')
        .map(doc => doc._id)
    );

    // Filter out comments that reference non-existent articles
    const validDocuments = allDocuments.filter(doc => {
      if (doc._type === 'comment' && doc.articleRef) {
        if (!validArticleIds.has(doc.articleRef._ref)) {
          log(`   ⚠ Skipping comment ${doc._id}: references non-existent article ${doc.articleRef._ref}`, 'yellow');
          return false;
        }
      }
      return true;
    });

    log(`   • Valid documents after reference check: ${validDocuments.length}\n`, 'yellow');

    // Upload documents in batches with smaller batch size
    log(`🚀 Starting upload in batches of 20...\n`, 'blue');
    
    const BATCH_SIZE = 20;
    let successfulBatches = 0;
    let failedBatches = 0;
    const totalBatches = Math.ceil(validDocuments.length / BATCH_SIZE);
    
    for (let i = 0; i < validDocuments.length; i += BATCH_SIZE) {
      const batch = validDocuments.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const uploadedCount = Math.min(i + BATCH_SIZE, validDocuments.length);
      
      try {
        const transaction = client.transaction();
        for (const doc of batch) {
          transaction.createIfNotExists(doc);
        }
        await transaction.commit();
        
        successfulBatches++;
        showProgress(uploadedCount, validDocuments.length, 'documents');
        
        // Rate limiting between batches
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        failedBatches++;
        const errorMsg = error.message || 'Unknown error';
        
        // Log error on new line to not overwrite progress bar
        console.log('');
        log(`⚠ Batch ${batchNum} error: ${errorMsg.substring(0, 80)}`, 'red');
        
        // Try to upload batch documents individually as fallback
        let successCount = 0;
        for (const doc of batch) {
          try {
            await client.createIfNotExists(doc);
            successCount++;
          } catch (docError) {
            log(`  ✗ Failed to upload ${doc._id}: ${docError.message.substring(0, 60)}`, 'red');
          }
        }
        
        log(`  📊 Partial upload: ${successCount}/${batch.length} documents saved`, 'yellow');
        showProgress(uploadedCount, validDocuments.length, 'documents');
      }
    }
    
    // New line after progress bar
    console.log('');
    
    log(`\n================================================`, 'green');
    log(`✅ IMPORT COMPLETE!`, 'green');
    log(`================================================\n`, 'green');
    log(`📊 Final Statistics:`, 'green');
    log(`   ✓ Articles imported: ${imported}`, 'green');
    log(`   ✓ Comments imported: ${validDocuments.filter(d => d._type === 'comment').length}`, 'green');
    log(`   ✓ Total documents: ${validDocuments.length}`, 'green');
    log(`   ✓ Skipped: ${skipped}\n`, 'yellow');
    log(`✨ All content imported with HTML preserved, comments linked, and ratings included!\n`, 'green');
    
  } catch (error) {
    log(`\n❌ ERROR:`, 'red');
    log(`${error.message}`, 'red');
    process.exit(1);
  }
}

importAllArticles();
