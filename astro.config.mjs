// @ts-check
import { defineConfig } from 'astro/config';

const isDev = process.env.NODE_ENV === 'development';
const siteUrl = isDev
  ? 'http://localhost:4321'
  : 'https://lacuisinedebernard.com';

export default defineConfig({
  site: siteUrl,

  // Astro 5 removed `hybrid`; static now supports the same dev workflow.
  output: 'static',

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
