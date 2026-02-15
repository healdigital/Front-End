#!/usr/bin/env node

/**
 * Simple One Article Import
 * Imports only 1 article with content as-is
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

async function importOneArticle() {
  log('\n🚀 IMPORTING 1 ARTICLE - AS-IS\n', 'blue');
  
  try {
    // Load posts from posts_all.json
    const postsPath = path.join(process.cwd(), 'posts_all.json');
    const posts = JSON.parse(fs.readFileSync(postsPath, 'utf-8'));
    
    // Take only the first article
    const article = posts[0];
    
    log(`📄 Article Details:`, 'yellow');
    log(`ID: ${article.id}`, 'yellow');
    log(`Title: ${article.title?.rendered}`, 'yellow');
    log(`Slug: ${article.slug}`, 'yellow');
    log(`Content Length: ${article.content?.rendered?.length || 0} characters`, 'yellow');
    log(`Excerpt Length: ${article.excerpt?.rendered?.length || 0} characters`, 'yellow');
    
    // Create document with content AS-IS (HTML directly)
    const doc = {
      _type: 'article',
      title: article.title?.rendered || 'Untitled',
      slug: {
        _type: 'slug',
        current: article.slug || 'untitled',
      },
      content: article.content?.rendered || '',
      excerpt: article.excerpt?.rendered || '',
      date: article.date,
      modified: article.modified,
      status: article.status,
      postType: article.type,
      authorName: article.author_name || 'Unknown',
      categories: article.categories || [],
      tags: article.tags || [],
      featuredImageUrl: article.featured_image_src || '',
      metadata: {
        comment_status: article.comment_status || 'open',
        ping_status: article.ping_status || 'open',
        sticky: article.sticky || false,
        format: article.format || 'standard',
        content_type: article.meta?.['content-type'] || '',
      }
    };
    
    log(`\n📤 Creating article in Sanity...`, 'blue');
    const created = await client.create(doc);
    
    log(`\n✅ SUCCESS! Article imported!`, 'green');
    log(`Article ID: ${created._id}`, 'green');
    log(`Title: ${created.title}`, 'green');
    log(`Content Length: ${created.content?.length || 0} characters`, 'green');
    log(`\nCheck Sanity Studio to verify: http://localhost:3333`, 'green');
    
  } catch (error) {
    log(`\n❌ ERROR:`, 'red');
    log(`${error.message}`, 'red');
    
    if (error.response) {
      log(`\nDetails:`, 'red');
      log(JSON.stringify(error.response, null, 2), 'red');
    }
    
    process.exit(1);
  }
}

importOneArticle();
