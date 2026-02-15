import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';

const isDev = process.env.NODE_ENV === 'development';
const siteUrl =
  process.env.PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  (isDev ? 'http://localhost:4321' : 'https://lacuisinedebernard.com');

export default defineConfig({
  site: siteUrl,

  // Pure SSG in production, hybrid in dev to allow API routes
  output: 'static',
  adapter: isDev ? node({ mode: 'standalone' }) : undefined,

  integrations: [sitemap()],

  vite: {
    cacheDir: './.vite-cache-build',
    ssr: {
      external: ['svgo'],
    },
  },

  image: {
    domains: ['lacuisinedebernard.com', 'lcdb.fra1.digitaloceanspaces.com', 'via.placeholder.com', 'img.youtube.com'],
  },
});
