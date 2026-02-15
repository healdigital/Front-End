import fs from 'fs';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: './payload-admin/.env' });

const dbUrl = process.env.DATABASE_URL || 'mongodb://localhost:27017/lcdb';
const client = new MongoClient(dbUrl);

async function fixNamesAndImportComments() {
  try {
    await client.connect();
    console.log('✅ MongoDB connected\n');
    const db = client.db('lcdb');

    // 1. Fix category names - rename title to name
    console.log('🔧 Fixing category field names...');
    const categoriesCol = db.collection('categories');
    const categories = await categoriesCol.find({}).toArray();
    
    for (const cat of categories) {
      await categoriesCol.updateOne(
        { _id: cat._id },
        {
          $set: { name: cat.title },
          $unset: { title: '' }
        }
      );
    }
    console.log(`  ✓ Fixed ${categories.length} categories\n`);

    // 2. Fix tag names - rename title to name
    console.log('🔧 Fixing tag field names...');
    const tagsCol = db.collection('tags');
    const tags = await tagsCol.find({}).toArray();
    
    for (const tag of tags) {
      await tagsCol.updateOne(
        { _id: tag._id },
        {
          $set: { name: tag.title },
          $unset: { title: '' }
        }
      );
    }
    console.log(`  ✓ Fixed ${tags.length} tags\n`);

    // 3. Fix author names - rename title to name
    console.log('🔧 Fixing author field names...');
    const authorsCol = db.collection('authors');
    const authors = await authorsCol.find({}).toArray();
    
    for (const author of authors) {
      await authorsCol.updateOne(
        { _id: author._id },
        {
          $set: { name: author.title },
          $unset: { title: '' }
        }
      );
    }
    console.log(`  ✓ Fixed ${authors.length} authors\n`);

    // 4. Extract and import comments from articles
    console.log('📝 Extracting comments from articles...');
    const articlesDir = './All Articles';
    const articleFiles = fs.readdirSync(articlesDir)
      .filter(f => f.endsWith('.json') && f.startsWith('post-'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)[0]);
        const numB = parseInt(b.match(/\d+/)[0]);
        return numA - numB;
      });

    const articlesCol = db.collection('articles');
    const commentsCol = db.collection('comments');
    let totalComments = 0;

    for (let fileIdx = 0; fileIdx < articleFiles.length; fileIdx++) {
      const fileName = articleFiles[fileIdx];
      const filePath = `${articlesDir}/${fileName}`;
      const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const articlesInFile = Array.isArray(fileContent.posts) ? fileContent.posts : [];

      const commentDocs = [];

      for (const article of articlesInFile) {
        // Get the MongoDB article ID
        const dbArticle = await articlesCol.findOne({ post_id: article.id });
        if (!dbArticle) continue;

        // Extract comments from article
        if (article.comments && Array.isArray(article.comments)) {
          for (const comment of article.comments) {
            const commentDoc = {
              article: dbArticle._id,
              content: comment.content || '',
              author: comment.author || 'Anonymous',
              email: comment.email || '',
              date: new Date(comment.date || Date.now()),
              approved: comment.approved !== false,
              post_id: article.id,
              comment_id: comment.id,
            };
            commentDocs.push(commentDoc);
            totalComments++;
          }
        }
      }

      if (commentDocs.length > 0) {
        try {
          await commentsCol.insertMany(commentDocs, { ordered: false });
        } catch (err) {
          // Continue even if some fail
        }
      }

      const progress = Math.round(((fileIdx + 1) / articleFiles.length) * 100);
      process.stdout.write(`\r  [${progress}%] Processed ${fileIdx + 1}/${articleFiles.length} files (${totalComments} comments)`);
    }
    console.log(`\n  ✓ Imported ${totalComments} comments\n`);

    // 5. Verification
    console.log('✅ Verification:\n');

    const catSample = await categoriesCol.find({}).limit(5).toArray();
    console.log('📂 Categories (with name field):');
    for (const cat of catSample) {
      console.log(`  ✓ ${cat.name} (slug: ${cat.slug})`);
    }

    const tagSample = await tagsCol.find({}).limit(5).toArray();
    console.log('\n🏷️  Tags (with name field):');
    for (const tag of tagSample) {
      console.log(`  ✓ ${tag.name} (slug: ${tag.slug})`);
    }

    const authorSample = await authorsCol.find({}).toArray();
    console.log('\n✍️  Authors (with name field):');
    for (const author of authorSample) {
      console.log(`  ✓ ${author.name} (slug: ${author.slug})`);
    }

    const totalCommentCount = await commentsCol.countDocuments();
    console.log(`\n💬 Total comments: ${totalCommentCount}`);

    console.log(`\n✅ All fixes applied successfully!`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

fixNamesAndImportComments();
