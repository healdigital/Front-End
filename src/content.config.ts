import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const staticPages = defineCollection({
  loader: glob({
    pattern: '**/*.html',
    base: './src/content/static-pages',
  }),
  schema: z.object({}),
});

export const collections = {
  'static-pages': staticPages,
};
