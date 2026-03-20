import fs from "node:fs";
import path from "node:path";
import { decodeHtmlEntities } from "../utils/decodeHtmlEntities";
import { repairDeepStrings } from "../utils/repairMojibake";

export type PreparedArchiveArticle = {
  slug?: string;
  title?: string;
  excerpt?: string;
  content?: string;
  contentV2?: unknown;
  categories?: Array<{ name?: string; slug?: string }>;
  recipeBlocks?: Array<{
    preparationTimeMinutes?: number | string;
    cookingTimeMinutes?: number | string;
    difficulty?: string;
  }>;
  recipe?: {
    prepTime?: string | number;
    prepTimeFormat?: string;
    difficulty?: string;
  };
  prep_time?: string | number;
  prepTime?: string | number;
  preparationTimeMinutes?: string | number;
  difficulty?: string;
  featuredMedia?: unknown;
  featuredImage?: unknown;
  featured_img_url?: string;
  featured_image?: unknown;
  featuredImageUrl?: string;
};

export type StaticArchiveEntry = {
  slug: string;
  href: string;
  fallbackTitle: string;
  fallbackImage: string;
};

let cachedPreparedArticles: PreparedArchiveArticle[] | null = null;

const preparedPath = path.resolve(process.cwd(), "prepared-articles.json");

const normalizeHrefToSlug = (href: string): string => {
  const clean = String(href || "").trim();
  if (!clean) return "";

  try {
    const url = clean.startsWith("http")
      ? new URL(clean)
      : new URL(clean, "https://lacuisinedebernard.com");
    return decodeURIComponent(url.pathname).replace(/^\/+|\/+$/g, "");
  } catch {
    return decodeURIComponent(clean).replace(/^\/+|\/+$/g, "");
  }
};

const stripTags = (value: string): string =>
  decodeHtmlEntities(
    String(value || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );

const isArchiveNoiseSlug = (slug: string): boolean =>
  !slug ||
  slug.startsWith("categorie/") ||
  slug.startsWith("category/") ||
  slug.startsWith("author/") ||
  slug.startsWith("tag/") ||
  slug.startsWith("#");

export const getPreparedArchiveArticles = (): PreparedArchiveArticle[] => {
  if (cachedPreparedArticles) return cachedPreparedArticles;
  const raw = fs.existsSync(preparedPath) ? fs.readFileSync(preparedPath, "utf8") : "[]";
  const parsed = JSON.parse(raw);
  cachedPreparedArticles = Array.isArray(parsed) ? (repairDeepStrings(parsed) as PreparedArchiveArticle[]) : [];
  return cachedPreparedArticles;
};

export const getStaticArchiveEntries = (sourceSlug: string): StaticArchiveEntry[] => {
  const sourcePath = path.resolve(process.cwd(), "src", "content", "static-pages", `${sourceSlug}.html`);
  if (!fs.existsSync(sourcePath)) return [];

  const html = fs.readFileSync(sourcePath, "utf8");
  const seen = new Set<string>();
  const entries: StaticArchiveEntry[] = [];

  const anchorMatches = html.matchAll(/<a\b([^>]*?)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/gi);
  for (const match of anchorMatches) {
    const attrPrefix = String(match[1] || "");
    const hrefRaw = String(match[2] || "");
    const attrSuffix = String(match[3] || "");
    const inner = String(match[4] || "");

    const slug = normalizeHrefToSlug(hrefRaw);
    if (isArchiveNoiseSlug(slug) || seen.has(slug)) continue;

    const attrs = `${attrPrefix} ${attrSuffix}`;
    const titleAttrMatch = attrs.match(/\btitle="([^"]+)"/i);
    const bgsetMatch = attrs.match(/\bdata-bgset="([^"]+)"/i);
    const bgStyleMatch = attrs.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/i);
    const fallbackTitle = stripTags(titleAttrMatch?.[1] || inner || slug);
    const fallbackImage = String(bgsetMatch?.[1] || bgStyleMatch?.[1] || "").trim();

    seen.add(slug);
    entries.push({
      slug,
      href: `/${slug}`,
      fallbackTitle,
      fallbackImage,
    });
  }

  return entries;
};
