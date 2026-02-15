#!/usr/bin/env node

/**
 * WordPress to Sanity Article Import Script
 * Imports articles with comments and ratings from WordPress JSON exports
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@sanity/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sanity Client
const client = createClient({
  projectId: 'g45aygyb',
  dataset: 'production',
  useCdn: false,
  token: process.env.SANITY_TOKEN, // Must be set via environment variable
  apiVersion: '2024-01-01',
});

// Configuration
const ARTICLES_FOLDER = path.join(__dirname, 'All Articles');
const BATCH_SIZE = 100; // Process in batches to avoid rate limiting

// Helper function to extract text from HTML
function extractTextFromHTML(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

// Convert HTML content to Sanity portable text blocks
function htmlToPortableText(html) {
  if (!html) return [];

  const blocks = [];
  const lines = html.split(/<div|<p|<h[1-6]|<ul|<ol|<li/i);

  lines.forEach((line, idx) => {
    const text = extractTextFromHTML(line);
    if (text.length > 0) {
      blocks.push({
        _type: 'block',
        _key: `block-${idx}`,
        style: 'normal',
        children: [
          {
            _type: 'span',
            marks: [],
            text: text,
          },
        ],
        markDefs: [],
      });
    }
  });

  return blocks.length > 0 ? blocks : [];
}

// Sanitize and create slug
function createSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim('-');
}

// Process article data from WordPress format
function processArticle(wpArticle) {
  const slug = wpArticle.slug || createSlug(wpArticle.title.rendered);
  
  const article = {
    _type: 'article',
    _id: `wp-article-${wpArticle.id}`,
    title: wpArticle.title.rendered,
    slug: {
      _type: 'slug',
      current: slug,
    },
    description: extractTextFromHTML(wpArticle.content.rendered).substring(0, 500),
    content: htmlToPortableText(wpArticle.content.rendered),
    date: new Date(wpArticle.date).toISOString(),
    lang: wpArticle.lang || 'en',
    wordpressId: wpArticle.id,
    wordpressUrl: wpArticle.link,
  };

  return article;
}

// Create comment document
function createComment(comment, articleId) {
  return {
    _type: 'comment',
    _id: `wp-comment-${comment.id}`,
    author: comment.author || 'Anonymous',
    email: comment.email || '',
    content: extractTextFromHTML(comment.content),
    date: new Date(comment.date).toISOString(),
    articleRef: {
      _type: 'reference',
      _ref: articleId,
    },
    wordpressId: comment.id,
    parentCommentId: comment.parent || null,
  };
}

// Import articles from all JSON files
async function importArticles() {
  try {
    console.log('🚀 Starting article import...\n');

    // Read all JSON files
    const files = fs.readdirSync(ARTICLES_FOLDER).filter(f => f.endsWith('.json'));
    console.log(`📁 Found ${files.length} JSON files\n`);

    let totalArticles = 0;
    let totalComments = 0;
    let allDocuments = [];

    // Process each JSON file
    for (const file of files) {
      const filePath = path.join(ARTICLES_FOLDER, file);
      console.log(`\n📄 Processing ${file}...`);

      try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(fileContent);
        const posts = data.posts || [];

        console.log(`   Articles in file: ${posts.length}`);

        for (const wpArticle of posts) {
          // Create article document
          const article = processArticle(wpArticle);
          allDocuments.push(article);
          totalArticles++;

          // Create comment documents if they exist
          if (wpArticle.comments && wpArticle.comments.length > 0) {
            for (const comment of wpArticle.comments) {
              const commentDoc = createComment(comment, article._id);
              allDocuments.push(commentDoc);
              totalComments++;
            }
          }

          // Log progress every 100 articles
          if (totalArticles % 100 === 0) {
            console.log(`   ✓ Processed ${totalArticles} articles...`);
          }
        }

        console.log(`   ✓ File completed`);
      } catch (err) {
        console.error(`   ✗ Error reading file: ${err.message}`);
      }
    }

    console.log(`\n✅ Prepared ${totalArticles} articles and ${totalComments} comments`);
    console.log(`📦 Total documents to import: ${allDocuments.length}\n`);

    // Upload to Sanity in batches
    console.log('🔄 Uploading to Sanity...\n');

    let uploadedCount = 0;
    for (let i = 0; i < allDocuments.length; i += BATCH_SIZE) {
      const batch = allDocuments.slice(i, i + BATCH_SIZE);

      try {
        const transaction = client.transaction();

        for (const doc of batch) {
          // Check if document exists
          try {
            const existing = await client.getDocument(doc._id);
            // Update existing
            transaction.patch(doc._id, { set: doc });
          } catch {
            // Create new
            transaction.create(doc);
          }
        }

        await transaction.commit();
        uploadedCount += batch.length;

        console.log(
          `   ✓ Uploaded batch ${Math.ceil(uploadedCount / BATCH_SIZE)}/${Math.ceil(
            allDocuments.length / BATCH_SIZE
          )} (${uploadedCount}/${allDocuments.length} documents)`
        );

        // Add delay between batches to avoid rate limiting
        if (uploadedCount < allDocuments.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (err) {
        console.error(`   ✗ Error uploading batch: ${err.message}`);
      }
    }

    console.log(`\n✅ Import completed!`);
    console.log(`📊 Summary:`);
    console.log(`   - Articles: ${totalArticles}`);
    console.log(`   - Comments: ${totalComments}`);
    console.log(`   - Total documents: ${allDocuments.length}`);
  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  }
}

// Main execution
if (!process.env.SANITY_TOKEN) {
  console.error('❌ Error: SANITY_TOKEN environment variable is not set');
  console.error('Please set your Sanity API token before running this script');
  console.error('\nUsage: SANITY_TOKEN=your_token_here npm run import-articles');
  process.exit(1);
}

importArticles().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
