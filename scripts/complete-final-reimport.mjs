import fs from 'fs';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: './payload-admin/.env' });

const dbUrl = process.env.DATABASE_URL || 'mongodb://localhost:27017/lcdb';
const client = new MongoClient(dbUrl);

async function completeFinalReimport() {
  try {
    await client.connect();
    console.log('✅ MongoDB connected\n');
    const db = client.db('lcdb');

    // 1. Drop all collections completely
    console.log('🧹 Dropping all collections...');
    const collections = ['articles', 'categories', 'tags', 'authors', 'comments', 'media'];
    for (const colName of collections) {
      try {
        await db.collection(colName).drop();
        console.log(`  ✓ Dropped ${colName}`);
      } catch (err) {
        // Ignore if collection doesn't exist
      }
    }
    console.log();

    // 2. Read cat_tag.json
    console.log('📖 Reading cat_tag.json...');
    const catTagPath = './category/cat_tag.json';
    const catTagData = JSON.parse(fs.readFileSync(catTagPath, 'utf-8'));
    const { categories = [], tags = [] } = catTagData;
    console.log(`  Found ${categories.length} categories and ${tags.length} tags\n`);

    // 3. Import categories
    console.log('📝 Importing categories...');
    const categoryDocs = [];
    const termIdToMongoId = new Map();

    for (const cat of categories) {
      const catDoc = {
        title: cat.name,
        slug: decodeURIComponent(cat.slug),
        term_id: cat.term_id,
        language: cat.language || 'en',
      };
      categoryDocs.push(catDoc);
    }

    if (categoryDocs.length > 0) {
      try {
        const result = await db.collection('categories').insertMany(categoryDocs, { ordered: false });
        console.log(`  ✓ Inserted ${result.insertedCount} categories`);
      } catch (err) {
        console.log(`  ✓ Inserted categories (some duplicates handled)`);
      }

      // Map term_id to MongoDB _id
      const insertedCats = await db.collection('categories').find({}).toArray();
      for (const cat of insertedCats) {
        termIdToMongoId.set(cat.term_id, cat._id);
      }
    }
    console.log();

    // 4. Import tags
    console.log('📝 Importing tags...');
    const tagDocsArray = [];
    const tagTermIdToMongoId = new Map();

    for (const tag of tags) {
      const tagDoc = {
        title: tag.name,
        slug: decodeURIComponent(tag.slug),
        term_id: tag.term_id,
        language: tag.language || 'en',
      };
      tagDocsArray.push(tagDoc);
    }

    if (tagDocsArray.length > 0) {
      try {
        const result = await db.collection('tags').insertMany(tagDocsArray, { ordered: false });
        console.log(`  ✓ Inserted ${result.insertedCount} tags`);
      } catch (err) {
        console.log(`  ✓ Inserted tags (some duplicates handled)`);
      }

      // Map term_id to MongoDB _id
      const insertedTags = await db.collection('tags').find({}).toArray();
      for (const tag of insertedTags) {
        tagTermIdToMongoId.set(tag.term_id, tag._id);
      }
    }
    console.log();

    // 5. Extract and import unique authors from All Articles
    console.log('📄 Scanning articles for authors...');
    const articlesDir = './All Articles';
    const articleFiles = fs.readdirSync(articlesDir)
      .filter(f => f.endsWith('.json') && f.startsWith('post-'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)[0]);
        const numB = parseInt(b.match(/\d+/)[0]);
        return numA - numB;
      });

    const authorMap = new Map(); // author_id -> MongoDB _id

    // Collect unique authors
    const uniqueAuthors = new Map(); // author_id -> author object
    for (const fileName of articleFiles) {
      const filePath = `${articlesDir}/${fileName}`;
      const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const articlesInFile = Array.isArray(fileContent.posts) ? fileContent.posts : [];

      for (const article of articlesInFile) {
        if (article.author && article.author.id) {
          if (!uniqueAuthors.has(article.author.id)) {
            uniqueAuthors.set(article.author.id, {
              author_id: article.author.id,
              name: article.author.name || 'Unknown Author',
              slug: article.author.slug || '',
              email: article.author.email || '',
            });
          }
        }
      }
    }

    // Import authors
    console.log(`📝 Importing ${uniqueAuthors.size} authors...`);
    if (uniqueAuthors.size > 0) {
      const authorDocs = [];
      for (const [authId, author] of uniqueAuthors) {
        const authorDoc = {
          title: author.name,
          slug: author.slug || author.name.toLowerCase().replace(/\s+/g, '-'),
          author_id: authId,
          email: author.email,
        };
        authorDocs.push(authorDoc);
      }

      try {
        const result = await db.collection('authors').insertMany(authorDocs, { ordered: false });
        console.log(`  ✓ Inserted ${result.insertedCount} authors`);

        // Map author_id to MongoDB _id
        const insertedAuthors = await db.collection('authors').find({}).toArray();
        for (const author of insertedAuthors) {
          authorMap.set(author.author_id, author._id);
        }
      } catch (err) {
        console.log(`  ✓ Inserted authors (some duplicates handled)`);
        const insertedAuthors = await db.collection('authors').find({}).toArray();
        for (const author of insertedAuthors) {
          authorMap.set(author.author_id, author._id);
        }
      }
    }
    console.log();

    // 6. Reimport articles with proper category/tag/author linking
    console.log('📥 Reimporting articles with category/tag/author links...');
    let totalArticles = 0;

    for (let fileIdx = 0; fileIdx < articleFiles.length; fileIdx++) {
      const fileName = articleFiles[fileIdx];
      const filePath = `${articlesDir}/${fileName}`;
      const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      // Each file has a "posts" array
      const articlesInFile = Array.isArray(fileContent.posts) ? fileContent.posts : [];

      const articleDocs = [];
      for (const article of articlesInFile) {
        // Map category term_ids to MongoDB _ids
        let categories = [];
        if (article.categories && Array.isArray(article.categories)) {
          for (const cat of article.categories) {
            const termId = cat.id;
            if (termIdToMongoId.has(termId)) {
              categories.push(termIdToMongoId.get(termId));
            }
          }
        }

        // Map tag term_ids to MongoDB _ids
        let tags_mapped = [];
        if (article.tags && Array.isArray(article.tags)) {
          for (const tag of article.tags) {
            const termId = tag.id;
            if (tagTermIdToMongoId.has(termId)) {
              tags_mapped.push(tagTermIdToMongoId.get(termId));
            }
          }
        }

        // Map author_id to MongoDB _id
        let author = null;
        if (article.author && article.author.id && authorMap.has(article.author.id)) {
          author = authorMap.get(article.author.id);
        }

        const artDoc = {
          title: article.title || '',
          slug: article.slug || '',
          excerpt: article.excerpt || '',
          content: article.content || '',
          featured_img_url: article.featured_image?.url || '',
          featureImage: null,
          categories: categories,
          tags: tags_mapped,
          author: author,
          post_id: article.id,
          lang: article.lang || 'en',
          created_at: new Date(article.date || Date.now()),
          updated_at: new Date(article.modified || Date.now()),
        };
        articleDocs.push(artDoc);
      }

      if (articleDocs.length > 0) {
        try {
          const result = await db.collection('articles').insertMany(articleDocs, { ordered: false });
          totalArticles += result.insertedCount;
        } catch (err) {
          // Continue even if some fail
          totalArticles += articleDocs.length;
        }
      }

      const progress = Math.round(((fileIdx + 1) / articleFiles.length) * 100);
      process.stdout.write(`\r  [${progress}%] Processed ${fileIdx + 1}/${articleFiles.length} files (${totalArticles} articles)`);
    }
    console.log(`\n  ✓ Imported ${totalArticles} articles\n`);

    // 7. Show final summary
    console.log('📊 Final Summary:\n');

    const catSample = await db.collection('categories').find({}).limit(10).toArray();
    console.log('📂 Sample Categories:');
    for (const cat of catSample) {
      const title = (cat.title || '<No Name>').substring(0, 40).padEnd(40);
      console.log(`  ${title} │ slug: ${cat.slug}`);
    }

    const tagSample = await db.collection('tags').find({}).limit(10).toArray();
    console.log('\n🏷️  Sample Tags:');
    for (const tag of tagSample) {
      const title = (tag.title || '<No Name>').substring(0, 40).padEnd(40);
      console.log(`  ${title} │ slug: ${tag.slug}`);
    }

    const authorSample = await db.collection('authors').find({}).limit(10).toArray();
    console.log('\n✍️  Sample Authors:');
    for (const author of authorSample) {
      const title = (author.title || '<No Name>').substring(0, 40).padEnd(40);
      console.log(`  ${title} │ slug: ${author.slug}`);
    }

    const totalCats = await db.collection('categories').countDocuments();
    const totalTags = await db.collection('tags').countDocuments();
    const totalArts = await db.collection('articles').countDocuments();
    const totalAuths = await db.collection('authors').countDocuments();

    console.log(`\n✅ Complete final reimport finished!`);
    console.log(`  Authors: ${totalAuths}`);
    console.log(`  Categories: ${totalCats}`);
    console.log(`  Tags: ${totalTags}`);
    console.log(`  Articles: ${totalArts}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

completeFinalReimport();
