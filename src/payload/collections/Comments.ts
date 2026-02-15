import type { CollectionConfig } from 'payload';

export const Comments: CollectionConfig = {
  slug: 'comments',
  labels: {
    singular: 'Comment',
    plural: 'Comments',
  },
  admin: {
    useAsTitle: 'author',
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'comment_id',
      type: 'number',
      unique: true,
    },
    {
      name: 'article',
      type: 'relationship',
      relationTo: 'articles',
    },
    {
      name: 'author',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
    },
    {
      name: 'date',
      type: 'date',
      required: true,
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
    },
    {
      name: 'rating',
      type: 'number',
      label: 'Rating (1-5)',
      min: 1,
      max: 5,
    },
  ],
};
