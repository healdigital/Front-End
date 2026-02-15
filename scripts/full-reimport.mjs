#!/usr/bin/env node

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use the correct MongoDB URL from .env
const MONGODB_URL = 'mongodb+srv://atoolsood_db_user:S6CAKbYrmiyLkKFz@leo.cn7rilk.mongodb.net/lcdb?appName=Leo&retryWrites=true&w=majority';

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URL);
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

async function clearCollections() {
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  
  for (const collection of collections) {
    if (!['users', 'payload_preferences'].includes(collection.name)) {
      await db.collection(collection.name).deleteMany({});
      console.log(`🗑️  Cleared ${collection.name}`);
    }
  }
}

function extractAuthor(article) {
  if (!article.author) return null;
  return {
    _id: new mongoose.Types.ObjectId(article.author.id.toString().padEnd(24, '0')),
    name: article.author.name || 'Unknown',
    email: article.author.email || '',
    bio: '',
    link: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function extractCategories(article) {
  // Parse categories from content/title if available
  const categories = [];
  if (article.post_categories && Array.isArray(article.post_categories)) {
    return article.post_categories.map((cat, idx) => ({
      _id: new mongoose.Types.ObjectId(cat.id.toString().padEnd(24, '0')),
      name: cat.name || 'Uncategorized',
      slug: cat.slug || cat.name?.toLowerCase().replace(/\s+/g, '-') || `cat-${idx}`,
      description: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }
  return categories;
}

function extractTags(article) {
  const tags = [];
  if (article.post_tags && Array.isArray(article.post_tags)) {
    return article.post_tags.map((tag, idx) => ({
      _id: new mongoose.Types.ObjectId(tag.id.toString().padEnd(24, '0')),
      name: tag.name || 'Untagged',
      slug: tag.slug || tag.name?.toLowerCase().replace(/\s+/g, '-') || `tag-${idx}`,
      description: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }
  return tags;
}

function extractComments(article, articleId) {
  const comments = [];
  if (article.comments && Array.isArray(article.comments)) {
    return article.comments.map((comment, idx) => ({
      _id: new mongoose.Types.ObjectId((article.id * 10000 + idx).toString().padEnd(24, '0')),
      author: comment.author || 'Anonymous',
      email: comment.author_email || '',
      content: comment.content || comment.comment_text || '',
      article: articleId,
      approved: true,
      createdAt: new Date(comment.date || comment.comment_date || Date.now()),
      updatedAt: new Date(comment.date_modified || Date.now()),
    }));
  }
  return comments;
}

async function importArticles() {
  const articlesDir = path.join(__dirname, '..', 'All Articles');
  const authors = new Map();
  const categories = new Map();
  const tags = new Map();
  const articlesData = [];
  const commentsData = [];
  const mediaMap = new Map();
  const mediaData = [];

  try {
    // Read all JSON files
    const files = fs.readdirSync(articlesDir)
      .filter(f => f.startsWith('post-') && f.endsWith('.json'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)[0]);
        const numB = parseInt(b.match(/\d+/)[0]);
        return numA - numB;
      });

    console.log(`📂 Found ${files.length} article files`);

    for (const file of files) {
      const filePath = path.join(articlesDir, file);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const posts = content.posts || [];

      console.log(`📄 Processing ${file} (${posts.length} articles)...`);

      for (const post of posts) {
        // Extract author
        if (post.author) {
          const authorId = post.author.id.toString().padEnd(24, '0');
          if (!authors.has(authorId)) {
            authors.set(authorId, extractAuthor(post));
          }
        }

        // Extract categories
        if (post.post_categories) {
          for (const cat of post.post_categories) {
            const catId = cat.id.toString().padEnd(24, '0');
            if (!categories.has(catId)) {
              categories.set(catId, {
                _id: new mongoose.Types.ObjectId(catId),
                name: cat.name || 'Uncategorized',
                slug: cat.slug || cat.name?.toLowerCase().replace(/\s+/g, '-'),
                description: '',
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }
          }
        }

        // Extract tags
        if (post.post_tags) {
          for (const tag of post.post_tags) {
            const tagId = tag.id.toString().padEnd(24, '0');
            if (!tags.has(tagId)) {
              tags.set(tagId, {
                _id: new mongoose.Types.ObjectId(tagId),
                name: tag.name || 'Untagged',
                slug: tag.slug || tag.name?.toLowerCase().replace(/\s+/g, '-'),
                description: '',
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }
          }
        }

        // Create article
        const articleId = new mongoose.Types.ObjectId(post.id.toString().padEnd(24, '0'));
        
        const article = {
          _id: articleId,
          title: post.title || 'Untitled',
          slug: post.slug || post.title?.toLowerCase().replace(/\s+/g, '-'),
          lang: post.lang || 'en',
          excerpt: post.excerpt || '',
          content: post.content || '',
          date: new Date(post.date || post.post_date),
          modified: new Date(post.modified || post.post_modified || post.date),
          link: post.link || '',
          author: post.author ? new mongoose.Types.ObjectId(post.author.id.toString().padEnd(24, '0')) : null,
          categories: post.post_categories ? post.post_categories.map(c => 
            new mongoose.Types.ObjectId(c.id.toString().padEnd(24, '0'))
          ) : [],
          tags: post.post_tags ? post.post_tags.map(t => 
            new mongoose.Types.ObjectId(t.id.toString().padEnd(24, '0'))
          ) : [],
          // Keep original featured image object
          featuredImage: post.featured_image ? {
            url: post.featured_image.url,
            width: post.featured_image.width,
            height: post.featured_image.height,
            alt: post.featured_image.alt || '',
            id: post.featured_image.id,
          } : null,
          // New: store raw featured image url
          featured_img_url: post.featured_image ? post.featured_image.url : null,
          // New: reference to media document (ObjectId) - populate below when media found
          featureImage: null,
          createdAt: new Date(post.date || post.post_date),
          updatedAt: new Date(post.modified || post.post_modified || post.date),
        };

        // If there is a featured image, prepare a media document and set article.featureImage
        if (post.featured_image && post.featured_image.url) {
          const sourceKey = post.featured_image.id ? post.featured_image.id.toString() : post.featured_image.url;
          if (!mediaMap.has(sourceKey)) {
            const mId = new mongoose.Types.ObjectId();
            const mediaDoc = {
              _id: mId,
              url: post.featured_image.url,
              width: post.featured_image.width || null,
              height: post.featured_image.height || null,
              alt: post.featured_image.alt || '',
              filename: path.basename(post.featured_image.url || ''),
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mediaData.push(mediaDoc);
            mediaMap.set(sourceKey, mId);
          }
          // attach media ObjectId to article
          article.featureImage = mediaMap.get(post.featured_image.id ? post.featured_image.id.toString() : post.featured_image.url);
        }

        articlesData.push(article);

        // Extract comments
        const articleComments = extractComments(post, articleId);
        commentsData.push(...articleComments);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Articles: ${articlesData.length}`);
    console.log(`   Authors: ${authors.size}`);
    console.log(`   Categories: ${categories.size}`);
    console.log(`   Tags: ${tags.size}`);
    console.log(`   Comments: ${commentsData.length}`);

    // Insert into MongoDB
    const db = mongoose.connection.db;

    if (authors.size > 0) {
      await db.collection('authors').insertMany(Array.from(authors.values()), { ordered: false });
      console.log(`✅ Inserted ${authors.size} authors`);
    }

    if (categories.size > 0) {
      await db.collection('categories').insertMany(Array.from(categories.values()), { ordered: false });
      console.log(`✅ Inserted ${categories.size} categories`);
    }

    if (tags.size > 0) {
      await db.collection('tags').insertMany(Array.from(tags.values()), { ordered: false });
      console.log(`✅ Inserted ${tags.size} tags`);
    }

    // Insert media first so articles can reference media ObjectIds
    if (mediaData.length > 0) {
      try {
        await db.collection('media').insertMany(mediaData, { ordered: false });
        console.log(`✅ Inserted ${mediaData.length} media items`);
      } catch (err) {
        console.error('⚠️ Media insert warning:', err.message);
      }
    }

    if (articlesData.length > 0) {
      try {
        await db.collection('articles').insertMany(articlesData, { ordered: false });
        console.log(`✅ Inserted ${articlesData.length} articles`);
      } catch (err) {
        console.error('⚠️ Articles insert warning:', err.message);
        if (err.result && err.result.insertedCount) {
          console.log(`Inserted ${err.result.insertedCount} articles before error`);
        }
      }
    }

    if (commentsData.length > 0) {
      try {
        await db.collection('comments').insertMany(commentsData, { ordered: false });
        console.log(`✅ Inserted ${commentsData.length} comments`);
      } catch (err) {
        console.error('⚠️ Comments insert warning:', err.message);
        if (err.result && err.result.insertedCount) {
          console.log(`Inserted ${err.result.insertedCount} comments before error`);
        }
      }
    }

    console.log(`\n🎉 Import completed successfully!`);
  } catch (error) {
    console.error('❌ Import error:', error.message);
    throw error;
  }
}

async function main() {
  try {
    await connectDB();
    await clearCollections();
    await importArticles();
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
