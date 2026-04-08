type TextLike = string | null | undefined | { rendered?: string | null };
type TaxonomyLike = { name?: string | null };
type ArticleJsonLdInput = {
  author_name?: string | null;
  blog_images?: { large?: string | null } | null;
  category_names?: TaxonomyLike[] | null;
  date?: string | null;
  excerpt?: TextLike;
  featured_image_src?: string | null;
  lang?: string | null;
  locale?: string | null;
  modified?: string | null;
  slug?: string | null;
  tag_names?: TaxonomyLike[] | null;
  title?: TextLike;
};

const stripHtml = (html: string) => html?.replace(/<[^>]*>/g, "").trim() || "";

const normalizeLanguage = (value: string | null | undefined): string => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'pt' || raw === 'pt_br' || raw === 'ptbr') return 'pt-br';
  if (['fr', 'en', 'es', 'pt-br', 'ar'].includes(raw)) return raw;
  return 'fr';
};

export function buildArticleJsonLd(
  article: ArticleJsonLdInput,
  domain: string = 'https://lacuisinedebernard.com',
) {

  const getTitle = () => {
    if (typeof article.title === 'string') return article.title;
    if (article.title?.rendered) return stripHtml(article.title.rendered);
    return 'Untitled';
  };

  const getExcerpt = () => {
    if (typeof article.excerpt === 'string') return stripHtml(article.excerpt);
    if (article.excerpt?.rendered) return stripHtml(article.excerpt.rendered);
    return '';
  };

  const title = getTitle();
  const excerpt = getExcerpt();
  const image = article.featured_image_src || article.blog_images?.large || '';
  const publicDate = article.date || new Date().toISOString();
  const modifiedDate = article.modified || publicDate;
  const author = article.author_name || 'La Cuisine De Bernard';
  const category = article.category_names?.[0]?.name || 'Recipe';
  const tags = article.tag_names?.map((tag) => tag.name).filter(Boolean) || [];
  const articleUrl = `${domain}/${article.slug}`;
  const language = normalizeLanguage(article.lang || article.locale);

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': articleUrl,
    'headline': title,
    'description': excerpt.substring(0, 155),
    'image': image ? {
      '@type': 'ImageObject',
      'url': image,
      'width': 1200,
      'height': 630
    } : undefined,
    'datePublished': publicDate,
    'dateModified': modifiedDate,
    'author': {
      '@type': 'Person',
      'name': author
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'La Cuisine De Bernard',
      'logo': {
        '@type': 'ImageObject',
        'url': `${domain}/logo.png`,
        'width': 250,
        'height': 60
      }
    },
    'mainEntity': {
      '@type': 'Article',
      'headline': title,
      'image': image,
      'datePublished': publicDate,
      'dateModified': modifiedDate,
      'author': author,
      'publisher': 'La Cuisine De Bernard'
    },
    'articleSection': category,
    'keywords': tags.join(', '),
    'inLanguage': language
  };
}

export function buildBreadcrumbJsonLd(
  title: string,
  slug: string,
  domain: string = 'https://lacuisinedebernard.com',
) {
  const normalizedSlug = String(slug || '').replace(/^\/+|\/+$/g, '');
  const articleUrl = normalizedSlug ? `${domain}/${normalizedSlug}` : domain;

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Home',
        'item': domain
      },
      {
        '@type': 'ListItem',
        'position': 2,
        'name': title,
        'item': articleUrl
      }
    ]
  };
}
