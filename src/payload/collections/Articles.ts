import type { CollectionConfig } from 'payload';

export const Articles: CollectionConfig = {
  slug: 'articles',
  labels: {
    singular: 'Article',
    plural: 'Articles',
  },
  admin: {
    useAsTitle: 'title',
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'postId',
      type: 'number',
      label: 'WordPress Post ID',
      unique: true,
    },
    {
      name: 'lang',
      type: 'text',
      label: 'Language',
      defaultValue: 'en',
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'excerpt',
      type: 'richText',
      label: 'Short Excerpt',
    },
    {
      name: 'content',
      type: 'textarea',
      required: true,
      label: 'Full Content',
      maxLength: 1000000, // Allow up to 1 million characters
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      index: true,
    },
    {
      name: 'modified',
      type: 'date',
      label: 'Last Modified',
    },
    {
      name: 'link',
      type: 'text',
      label: 'Original WordPress Link',
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'authors',
      hasMany: false,
    },
    {
      name: 'featured_image',
      type: 'upload',
      relationTo: 'media',
      label: 'Featured Image',
    },
    {
      name: 'featured_img_url',
      type: 'text',
      label: 'Featured Image URL',
      admin: {
        hidden: true, // Hide from admin UI since we have featured_image
      },
    },
    {
      name: 'featureImage',
      type: 'text',
      label: 'Feature Image (alt)',
      admin: {
        hidden: true,
      },
    },
    {
      name: 'inline_images',
      type: 'array',
      label: 'Inline Images',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
        },
      ],
    },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
    },
    {
      name: 'comments',
      type: 'array',
      label: 'Comments',
      fields: [
        {
          name: 'comment_id',
          type: 'number',
        },
        {
          name: 'author',
          type: 'text',
        },
        {
          name: 'email',
          type: 'email',
        },
        {
          name: 'date',
          type: 'date',
        },
        {
          name: 'content',
          type: 'richText',
        },
      ],
    },
    {
      name: 'seo',
      type: 'group',
      label: 'SEO',
      fields: [
        {
          name: 'title',
          type: 'text',
        },
        {
          name: 'description',
          type: 'textarea',
        },
        {
          name: 'focus_kw',
          type: 'text',
          label: 'Focus Keyword',
        },
      ],
    },
    {
      name: 'meta',
      type: 'json',
      label: 'Custom Meta',
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if (!req.payload?.db) return;
        const db = req.payload.db;
        const categoriesCollection = db.collection('categories');
        const articlesCollection = db.collection('articles');

        // Get old categories (for update operations)
        let oldCats: any[] = [];
        if (operation === 'update' && doc.id) {
          const oldDoc = await articlesCollection.findOne({ _id: doc.id });
          oldCats = oldDoc?.categories || [];
        }

        // Recalculate counts for affected categories
        const affectedCats = new Set([
          ...(doc.categories || []).map((c: any) => (c._id || c).toString()),
          ...oldCats.map((c: any) => (c._id || c).toString()),
        ]);

        for (const catId of affectedCats) {
          const count = await articlesCollection.countDocuments({
            categories: { $in: [catId] },
          });
          try {
            await categoriesCollection.updateOne(
              { _id: catId },
              { $set: { articleCount: count } }
            );
          } catch (e) {
            // Silent fail for invalid ObjectId
          }
        }
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        if (!req.payload?.db) return;
        const db = req.payload.db;
        const categoriesCollection = db.collection('categories');
        const articlesCollection = db.collection('articles');

        // Recalculate counts for categories that were linked to this article
        const affectedCats = doc.categories || [];
        for (const cat of affectedCats) {
          const catId = (cat._id || cat).toString();
          const count = await articlesCollection.countDocuments({
            categories: { $in: [catId] },
          });
          try {
            await categoriesCollection.updateOne(
              { _id: catId },
              { $set: { articleCount: count } }
            );
          } catch (e) {
            // Silent fail for invalid ObjectId
          }
        }
      },
    ],
  },
};
