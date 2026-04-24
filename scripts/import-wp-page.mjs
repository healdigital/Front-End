import fs from 'node:fs/promises';
import path from 'node:path';

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

function stripShareWidget(html) {
  return html.replace(/<div[^>]*class=\"[^\"]*xs_social_share_widget[^\"]*\"[\s\S]*?<\/div>/g, '');
}

function fixMojibake(text) {
  if (!text) return text;
  let fixed = text;
  const markers = [
    "\u00C3",
    "\u00C2",
    "\u00E2\u20AC\u2122",
    "\u00E2\u20AC\u201C",
    "\u00E2\u20AC\u201D",
    "\u00E2\u20AC\u2019",
    "\u00E2\u20AC\u2013",
    "\u00E2\u20AC\u2014",
    "\u00E2\u20AC\u2026"
  ];
  if (!markers.some((m) => fixed.includes(m))) {
    return fixed;
  }
  for (let i = 0; i < 2; i += 1) {
    if (markers.some((m) => fixed.includes(m))) {
      fixed = Buffer.from(fixed, 'latin1').toString('utf8');
    } else {
      break;
    }
  }
  return fixed;
}

function replaceImageDomains(html) {
  if (!html) return html;
  const target = 'https://lcdb.fra1.digitaloceanspaces.com/';
  return html
    .replace(/https?:\/\/cdn\.lacuisinedebernard\.com\/wp-content\//g, `${target}wp-content/`)
    .replace(/https?:\/\/lacuisinedebernard\.com\/wp-content\//g, `${target}wp-content/`);
}

function rewriteWpLinksToLocal(html) {
  if (!html) return html;
  const excludedPrefixes = [
    'wp-content/',
    'wp-json/',
    'wp-admin/',
    'category/',
    'categorie/',
    'tag/',
    'author/',
    'feed/',
    'amp/',
  ];
  return html.replace(
    /href="https?:\/\/(?:www\.)?lacuisinedebernard\.com\/([^"#?]+)([?#][^"]*)?"/g,
    (match, path, suffix = '') => {
      const normalized = String(path).replace(/^\/+|\/+$/g, '');
      if (!normalized) return match;
      const lower = normalized.toLowerCase();
      if (excludedPrefixes.some((prefix) => lower.startsWith(prefix))) {
        return match;
      }
      return `href="/${normalized}${suffix}"`;
    }
  );
}

function fixPenciLazyBackgrounds(html) {
  if (!html) return html;
  return html.replace(/<a([^>]*?)data-bgset=\"([^\"]+)\"([^>]*)>/g, (match, pre, url, post) => {
    if (/style=\"[^\"]*background-image/i.test(match)) return match;
    return `<a${pre}data-bgset="${url}" style="background-image:url('${url}');"${post}>`;
  });
}

function stripShortcodes(html) {
  return html.replace(/\[[^\]]+\]/g, '');
}

function isEncodedShortcode(text) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^JTVC/i.test(trimmed) && /^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    try {
      const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
      if (decoded.includes('%5B') || decoded.includes('[')) return true;
    } catch {
      return false;
    }
  }
  if (/^%5B/i.test(trimmed) && trimmed.includes('%5D')) return true;
  return false;
}

function hasMeaningfulContent(html) {
  if (/<(img|iframe|figure|video|audio|table)\b/i.test(html)) return true;
  if (/<ul\b[^>]*>\s*<li/i.test(html)) return true;
  if (/<ol\b[^>]*>\s*<li/i.test(html)) return true;
  const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, '');
  if (isEncodedShortcode(text)) return false;
  return text.length > 0;
}

async function main() {
  const input = getArg('--input');
  const slugArg = getArg('--slug');
  const api = getArg('--api') || 'https://lacuisinedebernard.com/wp-json/wp/v2/pages';
  const outDir = getArg('--out-dir') || path.join('src', 'content', 'static-pages');

  let data;
  if (input) {
    const raw = await fs.readFile(input, 'utf8');
    data = JSON.parse(raw);
  } else {
    if (!slugArg) throw new Error('Missing --slug (or provide --input JSON file).');
    const url = `${api}?slug=${encodeURIComponent(slugArg)}`;
    data = await fetchJson(url);
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('No page data found in JSON.');
  }

  const page = data[0];
  const slug = slugArg || page.slug;
  if (!slug) throw new Error('Missing slug in data.');
  let html = fixPenciLazyBackgrounds(
    replaceImageDomains(
      rewriteWpLinksToLocal(
        stripShortcodes(fixMojibake(stripShareWidget(page?.content?.rendered ?? '')))
      )
    )
  );
  if (!html) throw new Error('Missing content.rendered in JSON.');
  if (!hasMeaningfulContent(html)) {
    html = '';
  }

  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${slug}.html`);
  await fs.writeFile(outPath, html, 'utf8');
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
