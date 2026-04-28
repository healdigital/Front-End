// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

const isDev = process.env.NODE_ENV === 'development';
const siteUrl = isDev
  ? 'http://localhost:4321'
  : 'https://lacuisinedebernard.com';

export default defineConfig({
  site: siteUrl,

  // Adapter enables on-demand routes (`export const prerender = false`) while other pages stay static.
  output: 'static',
  adapter: node({
    mode: 'standalone',
  }),

  vite: {
    cacheDir: './.vite-cache-build',
    ssr: {
      external: ['svgo'],
    },
  },

  image: {
    domains: ['admin.lacuisinedebernard.com', 'lcdb.fra1.digitaloceanspaces.com'],
  },
});
