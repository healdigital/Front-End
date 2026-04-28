import type { APIRoute } from 'astro';
import { getRecipeFeedBatch } from '../../lib/recipeFeed.server';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const typeRaw = String(url.searchParams.get('type') || '').toLowerCase();
  const type = typeRaw === 'salees' ? 'salees' : typeRaw === 'sucrees' ? 'sucrees' : null;
  if (!type) {
    return new Response(JSON.stringify({ error: 'Invalid type. Use salees or sucrees.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const page = Number(url.searchParams.get('page') || '1');
  const size = Number(url.searchParams.get('size') || '24');
  const lang = String(url.searchParams.get('lang') || 'fr').toLowerCase();
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeSize = Number.isFinite(size) && size > 0 ? Math.min(40, Math.floor(size)) : 24;

  const result = await getRecipeFeedBatch(type, safePage, safeSize, lang);
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};

