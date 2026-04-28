// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

const isDev = process.env.NODE_ENV === 'development';
const siteUrl = isDev
  ? 'http://localhost:4321'
  : 'https://lacuisinedebernard.com';

export default defineConfig({
  site: siteUrl,

  // Fully server-rendered output: no mixed static/SSR ambiguity for data routes.
  output: 'server',
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
