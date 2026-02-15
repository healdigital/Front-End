export function buildArticleJsonLd(article: any, domain: string = 'https://lacuisinedebernard.com') {
  const stripHtml = (html: string) => html?.replace(/<[^>]*>/g, "").trim() || "";

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
  const tags = article.tag_names?.map((t: any) => t.name) || [];
  const articleUrl = `${domain}/${article.slug}`;

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
    'inLanguage': 'en'
  };
}

export function buildBreadcrumbJsonLd(title: string, domain: string = 'https://lacuisinedebernard.com') {
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
        'name': 'Articles',
        'item': `${domain}/articles`
      },
      {
        '@type': 'ListItem',
        'position': 3,
        'name': title,
        'item': `${domain}/${title.toLowerCase().replace(/\s+/g, '-')}`
      }
    ]
  };
}
