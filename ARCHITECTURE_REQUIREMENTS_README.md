![1769778804436](image/ARCHITECTURE_REQUIREMENTS_README/1769778804436.png)![1769778805775](image/ARCHITECTURE_REQUIREMENTS_README/1769778805775.png)![1769778808842](image/ARCHITECTURE_REQUIREMENTS_README/1769778808842.png)![1769778811815](image/ARCHITECTURE_REQUIREMENTS_README/1769778811815.png)![1769778815917](image/ARCHITECTURE_REQUIREMENTS_README/1769778815917.png)# Website Architecture Requirements - Detailed Analysis

## Client Requirements Overview

This document explains the mandatory architectural requirements provided by Leo Turbet-Delof for building a high-performance, scalable content website.

## Table of Contents
1. [Core Architecture](#core-architecture)
2. [Rendering Strategies Explained](#rendering-strategies-explained)
3. [CMS Responsibilities](#cms-responsibilities)
4. [Revalidation Model](#revalidation-model)
5. [Image Optimization](#image-optimization)
6. [Comments System](#comments-system)
7. [SEO Requirements](#seo-requirements)
8. [Data Contract](#data-contract)
9. [Environments](#environments)
10. [Hosting Recommendations](#hosting-recommendations)
11. [Implementation Checklist](#implementation-checklist)

## Core Architecture

### Target Architecture (Mandatory)
- **Payload CMS (Node.js + MongoDB)**: Used exclusively for admin, content management, API, preview, and webhooks
- **Next.js Frontend**: Public pages rendered using SSG/ISR only
- **CDN-First Delivery**: HTML pages served from CDN with no backend dependency

### Key Principles
- **Performance First**: Public pages must be served instantly from CDN
- **Cost Control**: Backend load only occurs during content publishing, not reading
- **Scalability**: Handle millions of page views without backend scaling

## Rendering Strategies Explained

### What is SSR (Server-Side Rendering)?
**Server-Side Rendering (SSR)** is when a web page is generated on the server for each user request.

#### How SSR Works:
1. User requests a page (e.g., `/articles/my-article`)
2. Server receives request
3. Server fetches data from database/API
4. Server generates complete HTML with data
5. Server sends HTML to browser
6. Browser displays page and loads JavaScript

#### SSR Code Example (Next.js):
```javascript
// pages/articles/[slug].js
export async function getServerSideProps({ params }) {
  // This runs on EVERY page request
  const article = await fetchFromDatabase(params.slug);

  return {
    props: { article }
  };
}

export default function ArticlePage({ article }) {
  return <div>{article.title}</div>;
}
```

#### SSR Problems (Why Client Says NO):
- **Slow**: Every page request requires server processing
- **Expensive**: Server must handle every visitor
- **Scalability Issues**: High traffic = high server load
- **Database Load**: Every page view queries database

### What is SSG (Static Site Generation)?
**Static Site Generation (SSG)** generates all pages at build time.

#### How SSG Works:
1. During build (npm run build), generate all possible pages
2. Save HTML files to disk/CDN
3. User requests page
4. CDN serves pre-generated HTML instantly
5. No server processing needed

#### SSG Code Example (Next.js):
```javascript
// pages/articles/[slug].js
export async function getStaticPaths() {
  // Generate ALL article pages at build time
  const articles = await getAllArticles();
  return {
    paths: articles.map(article => ({
      params: { slug: article.slug }
    })),
    fallback: false
  };
}

export async function getStaticProps({ params }) {
  // Fetch data at BUILD TIME, not request time
  const article = await getArticleBySlug(params.slug);
  return { props: { article } };
}

export default function ArticlePage({ article }) {
  return <div>{article.title}</div>;
}
```

#### SSG Benefits:
- **Lightning Fast**: Pre-generated HTML served from CDN
- **Cheap**: No server costs for page views
- **Scalable**: Handle millions of visitors with static files
- **SEO Friendly**: Search engines get complete HTML immediately

### What is ISR (Incremental Static Regeneration)?
**Incremental Static Regeneration** combines SSG with the ability to update pages after build.

#### How ISR Works:
1. Generate pages at build time (like SSG)
2. Set revalidation time (e.g., 1 hour)
3. After time expires, next visitor triggers background regeneration
4. Old page served while new one generates
5. Future visitors get updated page

#### ISR Code Example:
```javascript
export async function getStaticProps({ params }) {
  const article = await getArticleBySlug(params.slug);

  return {
    props: { article },
    revalidate: 3600 // Regenerate every hour
  };
}
```

#### ISR Benefits:
- **Fresh Content**: Pages update automatically
- **Performance**: Still served from CDN
- **Cost Effective**: Regeneration happens in background

### Client's Rendering Requirements
**MANDATORY**: All public pages must use SSG or ISR only. **NO SSR ALLOWED**.

#### Why No SSR?
- Client wants **zero backend dependency** on page loads
- **CDN-first delivery** for maximum performance
- **Cost control** - no server costs for readers
- **Scalability** - static files can handle any traffic

## CMS Responsibilities

### Payload CMS Usage (Allowed)
- ✅ Admin interface for content editors
- ✅ Content management and editorial workflow
- ✅ API endpoints for build processes
- ✅ Preview functionality (authenticated only)
- ✅ Webhooks for triggering revalidation

### Payload CMS Usage (NOT Allowed)
- ❌ Runtime queries for public page views
- ❌ Part of critical rendering path
- ❌ Handling comments or user interactions
- ❌ Any public-facing backend logic

#### Why This Separation?
- **Performance**: Public traffic never touches CMS
- **Security**: Admin system isolated from public
- **Scalability**: CMS load independent of traffic
- **Cost**: CMS only active during content operations

## Revalidation Model

### How Revalidation Works
Instead of SSR (querying database on every request), content updates trigger page regeneration.

#### Revalidation Flow:
1. Editor updates article in Payload CMS
2. Payload sends webhook to frontend
3. Frontend regenerates affected pages
4. CDN serves updated static pages

#### Webhook Implementation:
```javascript
// In Payload CMS
{
  hooks: {
    afterChange: [
      async ({ doc, operation }) => {
        if (operation === 'create' || operation === 'update') {
          // Send webhook to frontend
          await fetch('https://your-frontend.com/api/revalidate', {
            method: 'POST',
            body: JSON.stringify({
              articleId: doc.id,
              slug: doc.slug
            })
          });
        }
      }
    ]
  }
}
```

#### Frontend Revalidation:
```javascript
// pages/api/revalidate.js
export default async function handler(req, res) {
  const { articleId, slug } = req.body;

  // Revalidate the article page
  await res.revalidate(`/articles/${slug}`);

  // Revalidate related category pages
  // Revalidate homepage if needed

  res.status(200).json({ revalidated: true });
}
```

### Benefits of Webhook Revalidation
- **Precise**: Only regenerate when content actually changes
- **Efficient**: No unnecessary rebuilds
- **Fast**: Changes appear quickly
- **Cost Effective**: Minimal compute usage

## Image Optimization

### Requirements
- **No unoptimized images** served directly to users
- **CDN delivery** with proper sizing and formats
- **Modern formats**: WebP, AVIF
- **Responsive images**: Different sizes for different devices

### Implementation Options

#### Option 1: Next.js Image Optimization
```javascript
import Image from 'next/image';

export default function Article({ article }) {
  return (
    <Image
      src={article.featuredImage.url}
      alt={article.featuredImage.alt}
      width={800}
      height={600}
      sizes="(max-width: 768px) 100vw, 50vw"
      placeholder="blur"
    />
  );
}
```

#### Option 2: Cloudflare Images
- Upload originals to Cloudflare
- Automatic optimization and CDN delivery
- Variants for different sizes

#### Option 3: External Service (Imgproxy/Cloudinary)
- Payload stores originals
- Image service handles optimization
- CDN delivers optimized versions

### Why Image Optimization Matters
- **Performance**: Smaller images = faster pages
- **SEO**: Page speed affects rankings
- **User Experience**: Faster loading
- **Bandwidth**: Reduced data usage

## Comments System

### Requirements
- **Third-party SaaS solution** (Giscus, Disqus, Hyvor, Commento)
- **Client-side loading only**
- **No SSR triggered**
- **No page revalidation**
- **No backend dependency**

### How It Works
```javascript
// Article page (SSG)
export default function ArticlePage({ article }) {
  return (
    <div>
      <h1>{article.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: article.content }} />

      {/* Comments load client-side only */}
      <div id="comments">
        <script
          src="https://giscus.app/client.js"
          data-repo="your/repo"
          data-category="Comments"
          crossOrigin="anonymous"
          async
        />
      </div>
    </div>
  );
}
```

### Benefits
- **Performance**: No impact on page load time
- **SEO**: Comments don't affect static HTML
- **Scalability**: No backend for comments
- **Features**: Built-in moderation, spam protection, notifications

### Why Not Payload Comments?
- Would require SSR or runtime API calls
- Violates "no backend dependency" rule
- Adds complexity and cost
- Not needed for static site architecture

## SEO Requirements

### Mandatory SEO Implementation
- ✅ **Stable URL structure** (no breaking changes)
- ✅ **Canonical URLs**
- ✅ **Metadata** (title, description, Open Graph)
- ✅ **Sitemap.xml**
- ✅ **robots.txt**
- ✅ **301 redirects** for slug changes
- ✅ **Structured data** (Recipe schema if applicable)

### Implementation Example
```javascript
// pages/articles/[slug].js
export async function getStaticProps({ params }) {
  const article = await getArticleBySlug(params.slug);

  return {
    props: {
      article,
      // SEO data
      title: article.seo?.title || article.title,
      description: article.seo?.description || article.excerpt,
      canonical: `https://yoursite.com/articles/${article.slug}`,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": article.title,
        "description": article.excerpt,
        // ... more structured data
      }
    }
  };
}
```

## Data Contract

### Requirements
- **Stable content schema** consumed by frontend
- **No runtime fetching** of additional data
- **No hidden dependencies** on CMS field changes
- **Explicit data structure** defined and documented

### Example Data Contract
```typescript
// types/article.ts
export interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  publishedAt: string;
  author: {
    name: string;
    avatar?: string;
  };
  categories: Category[];
  tags: Tag[];
  featuredImage: {
    url: string;
    alt: string;
    width: number;
    height: number;
  };
  seo: {
    title?: string;
    description?: string;
    canonical?: string;
  };
}
```

## Environments

### Requirements
- **Production and staging clearly separated**
- **Same rendering and caching strategy** in both
- **Separate webhooks and credentials**

### Environment Setup
```
Production:
- Domain: yoursite.com
- Payload: payload-prod.yoursite.com
- Database: MongoDB Prod
- Webhooks: Point to production frontend

Staging:
- Domain: staging.yoursite.com
- Payload: payload-staging.yoursite.com
- Database: MongoDB Staging
- Webhooks: Point to staging frontend
```

## Hosting Recommendations

### Client's Suggested Stack
- **Payload CMS**: Hetzner or Scaleway (cost-effective European hosting)
- **Images**: Cloudflare Images (optimization + CDN)
- **Frontend**: Vercel (CDN + ISR support)

### Why This Stack?
- **Cost**: Hetzner/Scaleway cheaper than Vercel for CMS
- **Performance**: Cloudflare Images better than DigitalOcean
- **CDN**: Vercel provides global CDN for static content

## Implementation Checklist

### Phase 1: Architecture Setup
- [ ] Switch from Astro to Next.js
- [ ] Set up Payload CMS on Hetzner/Scaleway
- [ ] Configure Cloudflare Images
- [ ] Set up staging and production environments

### Phase 2: Content Delivery
- [ ] Implement SSG/ISR for all public pages
- [ ] Set up webhook revalidation system
- [ ] Remove all runtime Payload queries
- [ ] Implement proper error boundaries

### Phase 3: Features
- [ ] Replace Payload comments with SaaS solution
- [ ] Implement image optimization pipeline
- [ ] Set up SEO metadata and structured data
- [ ] Create sitemap and robots.txt

### Phase 4: Quality Assurance
- [ ] Performance testing (Lighthouse, WebPageTest)
- [ ] SEO audit
- [ ] Accessibility testing
- [ ] Cross-browser testing

### Phase 5: Deployment
- [ ] Set up CI/CD pipelines
- [ ] Configure monitoring and alerts
- [ ] Set up backup and disaster recovery
- [ ] Performance monitoring

## Cost Implications

### Traditional SSR Approach (Expensive)
- Server costs scale with traffic
- Database costs increase with page views
- CDN costs for static assets only

### SSG/ISR + CDN Approach (Cost Effective)
- Minimal server costs (only for publishing)
- CDN costs for all content
- Database costs minimal (only admin operations)

### Estimated Cost Savings
- **Server Costs**: 80-90% reduction
- **Database Costs**: 95% reduction
- **Scalability**: Handle 10x traffic with same costs

## Risks and Mitigations

### Risk: Content Freshness
**Mitigation**: Robust webhook system with monitoring

### Risk: Build Times
**Mitigation**: Incremental builds, optimize build process

### Risk: Image Management
**Mitigation**: Automated optimization pipeline

### Risk: SEO Impact
**Mitigation**: Proper metadata, sitemap, structured data

## Conclusion

This architecture prioritizes **performance**, **scalability**, and **cost efficiency** by eliminating backend dependencies for public page views. The CDN-first approach ensures instant page loads while maintaining fresh content through webhook-driven revalidation.

The key insight: **Content publishing and content consumption are separate concerns** that should not share infrastructure.

## Questions for Client Discussion

1. Can we keep Astro instead of migrating to Next.js?
2. Which comment SaaS platform do you prefer (Giscus, Disqus, Hyvor)?
3. Do you approve the hosting migration (Hetzner + Cloudflare + Vercel)?
4. What are the specific performance targets (Lighthouse scores, TTFB)?
5. How frequently should content be revalidated?
6. Do you need preview functionality beyond authenticated editors?</content>
<parameter name="filePath">ARCHITECTURE_REQUIREMENTS_README.md