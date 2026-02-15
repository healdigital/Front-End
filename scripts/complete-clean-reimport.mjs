import fs from 'fs';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: './payload-admin/.env' });

const dbUrl = process.env.DATABASE_URL || 'mongodb://localhost:27017/lcdb';
const client = new MongoClient(dbUrl);

async function completeReimport() {
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
        if (err.code !== 26) { // 26 = namespace not found
          console.log(`  ✓ ${colName} (did not exist)`);
        }
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
        title: cat.name, // Use the name as-is (it's already properly encoded in JSON)
        slug: decodeURIComponent(cat.slug), // Decode the URL-encoded slug
        term_id: cat.term_id,
        language: cat.language || 'en',
      };
      categoryDocs.push(catDoc);
    }

    if (categoryDocs.length > 0) {
      const result = await db.collection('categories').insertMany(categoryDocs, { ordered: false });
      console.log(`  ✓ Inserted ${result.insertedCount} categories`);

      // Map term_id to MongoDB _id
      const insertedCats = await db.collection('categories').find({}).toArray();
      for (const cat of insertedCats) {
        termIdToMongoId.set(cat.term_id, cat._id);
      }
    }
    console.log();

    // 4. Import tags
    console.log('📝 Importing tags...');
    const tagDocs = [];
    const tagTermIdToMongoId = new Map();

    for (const tag of tags) {
      const tagDoc = {
        title: tag.name, // Use the name as-is
        slug: decodeURIComponent(tag.slug), // Decode the URL-encoded slug
        term_id: tag.term_id,
        language: tag.language || 'en',
      };
      tagDocs.push(tagDoc);
    }

    if (tagDocs.length > 0) {
      const result = await db.collection('tags').insertMany(tagDocs, { ordered: false });
      console.log(`  ✓ Inserted ${result.insertedCount} tags`);

      // Map term_id to MongoDB _id
      const insertedTags = await db.collection('tags').find({}).toArray();
      for (const tag of insertedTags) {
        tagTermIdToMongoId.set(tag.term_id, tag._id);
      }
    }
    console.log();

    // 5. Get original articles from All Articles folder
    console.log('📄 Reading All Articles folder...');
    const articlesDir = './All Articles';
    const articleFiles = fs.readdirSync(articlesDir)
      .filter(f => f.endsWith('.json') && f.startsWith('post-'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)[0]);
        const numB = parseInt(b.match(/\d+/)[0]);
        return numA - numB;
      });

    console.log(`  Found ${articleFiles.length} article files\n`);

    // 6. Reimport articles with proper category/tag linking
    console.log('📥 Reimporting articles with category/tag links...');
    let totalArticles = 0;

    for (let fileIdx = 0; fileIdx < articleFiles.length; fileIdx++) {
      const fileName = articleFiles[fileIdx];
      const filePath = `${articlesDir}/${fileName}`;
      const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const articlesInFile = Array.isArray(fileContent) ? fileContent : [fileContent];

      const articleDocs = [];
      for (const article of articlesInFile) {
        // Map category term_ids to MongoDB _ids
        let categories = [];
        if (article.post_categories && Array.isArray(article.post_categories)) {
          for (const termId of article.post_categories) {
            if (termIdToMongoId.has(termId)) {
              categories.push(termIdToMongoId.get(termId));
            }
          }
        }

        // Map tag term_ids to MongoDB _ids
        let tags_mapped = [];
        if (article.post_tags && Array.isArray(article.post_tags)) {
          for (const termId of article.post_tags) {
            if (tagTermIdToMongoId.has(termId)) {
              tags_mapped.push(tagTermIdToMongoId.get(termId));
            }
          }
        }

        const artDoc = {
          title: article.title || '',
          slug: article.slug || '',
          excerpt: article.excerpt || '',
          content: article.content || '',
          featured_img_url: article.featured_img_url || article.featuredImage?.url || '',
          featureImage: article.featureImage || null,
          categories: categories,
          tags: tags_mapped,
          post_id: article.post_id || article.id,
          created_at: new Date(article.post_date || Date.now()),
          updated_at: new Date(article.post_modified || Date.now()),
        };
        articleDocs.push(artDoc);
      }

      if (articleDocs.length > 0) {
        try {
          const result = await db.collection('articles').insertMany(articleDocs, { ordered: false });
          totalArticles += result.insertedCount;
        } catch (err) {
          // Continue even if some fail due to duplicates
          totalArticles += articleDocs.length;
        }
      }

      const progress = Math.round(((fileIdx + 1) / articleFiles.length) * 100);
      process.stdout.write(`\r  [${progress}%] Imported ${totalArticles} articles from ${fileIdx + 1}/${articleFiles.length} files`);
    }
    console.log(`\n  ✓ Reimported ${totalArticles} articles\n`);

    // 7. Show final summary
    console.log('📊 Final Summary:\n');

    const catWithCounts = await db.collection('categories').aggregate([
      {
        $lookup: {
          from: 'articles',
          localField: '_id',
          foreignField: 'categories',
          as: 'articles_in_category'
        }
      },
      {
        $project: {
          title: 1,
          slug: 1,
          count: { $size: '$articles_in_category' }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();

    console.log('📂 Categories with article counts:');
    for (const cat of catWithCounts.slice(0, 20)) {
      const title = (cat.title || '<No Name>').substring(0, 40).padEnd(40);
      const count = cat.count.toString().padStart(5);
      console.log(`  ${title} │ ${count} articles`);
    }
    if (catWithCounts.length > 20) {
      console.log(`  ... and ${catWithCounts.length - 20} more categories`);
    }

    console.log('\n🏷️  Tags with article counts:');
    const tagWithCounts = await db.collection('tags').aggregate([
      {
        $lookup: {
          from: 'articles',
          localField: '_id',
          foreignField: 'tags',
          as: 'articles_in_tag'
        }
      },
      {
        $project: {
          title: 1,
          slug: 1,
          count: { $size: '$articles_in_tag' }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();

    for (const tag of tagWithCounts.slice(0, 15)) {
      const title = (tag.title || '<No Name>').substring(0, 40).padEnd(40);
      const count = tag.count.toString().padStart(5);
      console.log(`  ${title} │ ${count} articles`);
    }
    if (tagWithCounts.length > 15) {
      console.log(`  ... and ${tagWithCounts.length - 15} more tags`);
    }

    const totalCats = await db.collection('categories').countDocuments();
    const totalTags = await db.collection('tags').countDocuments();
    const totalArts = await db.collection('articles').countDocuments();

    console.log(`\n✅ Complete reimport finished!`);
    console.log(`  Categories: ${totalCats}`);
    console.log(`  Tags: ${totalTags}`);
    console.log(`  Articles: ${totalArts}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.close();
  }
}

completeReimport();
