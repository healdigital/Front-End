# LCDB Blog - Full Audit Report

**Date:** March 31, 2026
**Project:** La Cuisine de Bernard - Astro Blog + Payload CMS
**Overall Score:** 7/10

---

## Architecture Overview

| Component | Stack | Version |
|-----------|-------|---------|
| **Front-End** | Astro (SSG) + Tailwind v4 | 5.16.11 |
| **Back-End** | Payload CMS + Next.js 15 | 3.73.0 |
| **Database** | MongoDB | 7.0 |
| **Search** | Algolia | 5.46.3 |
| **CDN** | DigitalOcean Spaces | - |
| **Deployment** | Docker/Nginx (Coolify) | - |

**Content:** 5,316 articles including 1,989 recipes, 5 languages (FR, EN, ES, PT-BR, AR)

---

## Table of Contents

1. [Front-End Audit](#1-front-end-audit-astro)
2. [Back-End Audit](#2-back-end-audit-payload-cms)
3. [Issues Summary](#3-issues-summary)
4. [Recommendations](#4-recommendations)

---

## 1. Front-End Audit (Astro)

### 1.1 Project Structure

```
Front-End-main/
├── src/
│   ├── components/          # 61 Astro components (atomic design)
│   │   ├── atoms/           # Button, Icon, Input, Badge, Checkbox, Logo
│   │   ├── molecules/       # DateBadge, Navigation, SearchField, SocialShare
│   │   ├── organisms/       # HeroCarousel, RecipeCard, NewsletterModal, Pagination
│   │   ├── layout/          # Container, Grid
│   │   └── schema/          # RecipeSchema.astro
│   ├── layouts/             # 3 layouts: BaseLayout, MainLayout, RecipeLayout
│   ├── pages/               # 43 .astro pages + dynamic routes
│   │   ├── articles/[slug]  # Main article display (24KB dynamic route)
│   │   ├── categories/      # Category index pages
│   │   ├── tags/            # Tag index pages
│   │   ├── print/[slug]     # Print-friendly version
│   │   ├── api/             # translate.ts endpoint
│   │   └── sitemap.xml.ts   # Dynamic sitemap generation
│   ├── lib/                 # 8 utility modules (data fetching & conversion)
│   ├── utils/               # 18 utility files (image, i18n, rendering)
│   ├── i18n/                # 6 language files (fr, en, es, pt-br, ar)
│   ├── styles/              # global.css + home-figma-sections.css
│   └── content/             # 12 static HTML pages (legal, recipes, workshops)
├── public/                  # Static assets, robots.txt, ads.txt
│   ├── search-index.json    # 15.6MB Algolia index snapshot
│   └── home-recipes-index.json  # 3.1MB homepage index
├── scripts/                 # 40 migration/import Node.js scripts
├── .github/workflows/       # 2 CI/CD workflows
├── astro.config.mjs         # Static output mode
├── tailwind.config.js       # Brand colors & typography
├── Dockerfile               # Multi-stage nginx build
└── nginx.conf               # Production server config
```

### 1.2 Dependencies

| Package | Version | Status |
|---------|---------|--------|
| `astro` | ^5.16.11 | Current |
| `@astrojs/node` | ^9.5.2 | Current |
| `typescript` | ^5.9.3 | Strict mode |
| `tailwindcss` | ^4.1.18 | Current |
| `payload` | ^3.74.0 | Current |
| `@payloadcms/db-mongodb` | ^3.74.0 | Current |
| `@payloadcms/db-postgres` | ^3.74.0 | **UNUSED** - Only MongoDB in use |
| `@payloadcms/richtext-lexical` | ^3.74.0 | Current |
| `@payloadcms/richtext-slate` | ^3.74.0 | **UNUSED** - Only Lexical in use |
| `mongodb` | ^7.0.0 | Current |
| `algoliasearch` | ^5.46.3 | Current |
| `sharp` | ^0.34.5 | Current |
| `zod` | ^3.25.76 | Current |
| `i18next` | ^25.8.0 | Current |

**Package manager:** pnpm 10.28.2

### 1.3 Astro Configuration

| Setting | Value | Assessment |
|---------|-------|------------|
| Output mode | `static` | Correct for SSG |
| Site URL | `staging.lacuisinedebernard.com` | Should be production URL |
| Image domains | admin + CDN configured | OK |
| Compression | Not configured | **MISSING** |
| i18n integration | Not configured | Handled client-side (suboptimal) |
| Sitemap integration | Not configured | Custom implementation used |

### 1.4 Content & Data Flow

- **No Astro content collections** - All content fetched from APIs
- **Data pipeline:** Payload CMS API -> MongoDB fallback -> prepared-articles.json -> Static HTML
- **Static pages:** 12 hardcoded HTML files in `src/content/static-pages/`
- **Zod validation** schemas present in `src/lib/validation/`
- **Build limits:** `MAX_SSG_ARTICLES` = 50 (dev) / configurable (prod)

### 1.5 Components Analysis

| Category | Count | Examples |
|----------|-------|---------|
| Atoms | 6 | Button, Icon, Input, Badge, Checkbox, Logo |
| Molecules | 5 | DateBadge, Navigation, SearchField, SocialShare, FilterDropdown |
| Organisms | 12 | HeroCarousel, RecipeCard, NewsletterModal, Pagination |
| Layout | 2 | Container, Grid |
| Schema | 1 | RecipeSchema.astro |
| Root level | 35 | Header, Footer, ArticleDisplay, CommentForm, SEO, etc. |

**Duplicate components found:**
- `RecipeCard.astro` exists in both root and organisms/
- `Pagination.astro` exists in both root and organisms/
- `Header.astro` exists in both root and organisms/

**Likely unused components:**
- `RandomArticles.astro` - No import found
- `ArticleSlider.astro` - Appears unused
- Multiple commenting components (CommentForm, CommentList, CommentsList) - Only Disqus active

**Oversized components:**
- `Header.astro` (33KB) - Should be split
- `ArticleDisplay.astro` (20KB) - Mixed rendering logic & UI

### 1.6 Pages & Routing

| Route | File | Purpose |
|-------|------|---------|
| `/` | `index.astro` | Homepage (24KB) |
| `/articles/` | `articles/index.astro` | Article listing (paginated) |
| `/articles/[slug]` | `articles/[slug].astro` | Article detail (5,316+ pages) |
| `/[slug]` | `[slug].astro` | Fallback/legacy route |
| `/page/[page]` | `page/[page].astro` | Homepage pagination |
| `/categories/[slug]` | `categories/*.astro` | Category pages |
| `/tags/[slug]` | `tags/*.astro` | Tag pages |
| `/print/[slug]` | `print/[slug].astro` | Print-friendly version |
| `/recettes-sucrees` | `recettes-sucrees.astro` | Sweet recipes |
| `/recettes-salees` | `recettes-salees.astro` | Savory recipes |
| `/voyages-culinaires` | `voyages-culinaires.astro` | Culinary travel |
| `/videos` | `videos.astro` | Video courses |
| `/sitemap.xml` | `sitemap.xml.ts` | Dynamic sitemap |
| `/api/translate` | `api/translate.ts` | DeepL translation |
| `/test-*` | 3 test pages | **Should be removed** |

**Routing issues:**
- `/[slug]` catch-all may conflict with explicit routes
- No `404.astro` page defined
- Test pages present in production build
- Dual routing for articles (`/articles/[slug]` AND `/[slug]`)

### 1.7 Styling

**Strategy:** Tailwind v4 + PostCSS + scoped component styles

**Typography:**
- Headings: Instrument Serif (serif)
- Body: Inter (sans-serif)
- Buttons: Jost
- Monospace: Roboto Mono

**Color palette:** Custom tokens (primary, secondary, status, text, border)

**Issues:**
- Google Fonts loaded via `<link>` tags (render-blocking)
- External font from onlinewebfonts.com (Maison Neue) - unreliable dependency
- No `font-display: swap` directive
- Mix of custom and default Tailwind color classes
- `autoprefixer` installed but not in postcss config (unnecessary for TW v4)

### 1.8 SEO

**Implemented:**
- Meta tags (title, description, viewport, charset, canonical)
- Open Graph tags (type, url, title, description, image with 1200x630)
- Twitter Card (summary_large_image)
- Article meta (published_time, modified_time, author)
- Hreflang (FR + EN only)
- JSON-LD structured data (Article, Breadcrumb, Recipe schemas)
- Dynamic sitemap (2,000+ URLs with lastmod & changefreq)
- robots.txt in public/

**Issues:**
- Hreflang only supports FR & EN - **missing ES, PT-BR, AR**
- OG image dimensions hardcoded (1200x630), not actual sizes
- `inLanguage` in schema sometimes incorrect (says "en" for French articles)
- `dateModified` may be null in Article schema
- Recipe schema missing `recipeYield`, time formats not validated
- robots.txt is static (not dynamically generated)

### 1.9 Performance

**Build performance:** 1.95-2.14 seconds (excellent)

**Issues:**
- No Astro `<Image />` component used - raw `<img>` tags everywhere
- No `srcset`, `sizes`, or lazy loading attributes
- No WebP/AVIF format negotiation (no `<picture>` tags)
- Google Fonts render-blocking (4 font families in single request)
- Search index 15.6MB in public/ (not lazy-loaded)
- No gzip/brotli compression configured
- No HTTP/2 push headers
- No service worker for offline support
- 111 `console.log` calls in production code

**What works well:**
- CDN integration with URL replacement (cdnUrlReplacer.ts)
- Vite cache directory configured
- MongoDB query caching with JSON fallback
- Build flags for selective page generation

### 1.10 TypeScript

**Configuration:** `astro/tsconfigs/strict` (good)

**Issues:**
- **111+ instances of `any` type** across the codebase
- No `Article` or `Recipe` type definitions (uses `any[]` in MongoDB queries)
- No type guards (`isArticle()`, `isRecipe()`)
- Payload API responses not validated on client side
- `window as any` casts for client-side scripts
- Generic `<T>` in payloadFetch defaults to `any`

### 1.11 Environment Variables

```bash
# Algolia
ALGOLIA_APP_ID / PUBLIC_ALGOLIA_APP_ID
ALGOLIA_ADMIN_KEY / PUBLIC_ALGOLIA_SEARCH_KEY

# GitHub ISR
GITHUB_TOKEN / GITHUB_REPO / GITHUB_DISPATCH_TOKEN

# Secrets
DEEPL_API_KEY / PAYLOAD_SECRET / DATABASE_URL

# Build Config
USE_LOCAL_JSON / PREPARED_JSON_URL / MAX_SSG_ARTICLES
SEARCH_INDEX_LIMIT / BUILD_ONLY_ARTICLE_PAGES / BUILD_DISABLE_SEARCH

# Client
PUBLIC_DISQUS_SHORTNAME / PUBLIC_TRANSLATE_API_URL
```

**Issues:**
- No `PAYLOAD_API_URL` in env example (uses hardcoded defaults)
- No `MONGODB_URI` in env example (but used in code)
- Staging URL hardcoded in astro.config.mjs instead of env var

### 1.12 Deployment

**Docker:** Multi-stage build (deps -> builder -> nginx:1.27-alpine)
- Health check on `/healthz`
- BuildKit secrets support
- Targets: Coolify (primary), Vercel/Netlify/Cloudflare (planned)

**CI/CD:**
- `deploy-scaleway.yml` - DISABLED (echoes "disabled")
- ISR rebuild workflow (triggers Coolify webhooks)

---

## 2. Back-End Audit (Payload CMS)

### 2.1 Project Structure

```
Back-End-main/
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── (frontend)/          # Preview pages
│   │   ├── (payload)/           # Admin panel routes
│   │   └── my-route/            # Custom routes
│   ├── collections/             # 8 collection definitions
│   │   ├── blocks/              # Block field definitions
│   │   └── hooks/               # Collection lifecycle hooks
│   ├── components/admin/        # Custom React admin components
│   ├── endpoints/               # Custom API endpoints
│   ├── lib/                     # Utility libraries
│   └── types/                   # TypeScript type definitions
├── tests/
│   ├── int/                     # Integration tests (Vitest)
│   └── e2e/                     # E2E tests (Playwright)
├── .cursor/rules/               # 13 Cursor AI rule files
├── Dockerfile                   # Multi-stage Docker build
├── docker-compose.yml           # Local MongoDB + dev server
└── payload.config.ts            # Main Payload configuration
```

### 2.2 Payload Configuration

- **Admin user:** Users collection (email-based)
- **i18n:** French (fr) default
- **Editor:** Lexical WYSIWYG
- **Database:** MongoDB (mongoose adapter)
- **S3 storage:** Conditional (enabled via `S3_ENABLED=true`)
- **TypeScript output:** `payload-types.ts`

### 2.3 Collections

#### Articles (main collection - 565 lines)

| Feature | Detail |
|---------|--------|
| **Fields** | title, slug, excerpt, featuredMedia, author, lang (fr/en/es/pt-br/ar), categories, tags, recipeBlocks, contentV2 (Lexical), contentBlocks, seoTitle, seoDescription, translationReviewStatus, readyForPublication |
| **Drafts** | Enabled with autosave (1400ms interval) |
| **Versions** | Max 80 per document |
| **Preview** | Token-based draft preview |
| **Hooks** | 7 hooks (auto-translate, deploy queue, validation, normalization) |

#### Media (upload collection)

| Image Size | Dimensions | Fit |
|-----------|------------|-----|
| thumb | 320x320 | cover, center |
| cardPortrait | 900x1200 | - |
| articleHero | 1600x2200 | - |
| articleStep | 1280x1800 | - |
| gallery | 1400x1800 | - |

#### Other Collections

| Collection | Fields | Notes |
|-----------|--------|-------|
| **Users** | email + Payload defaults | Minimal, auth enabled |
| **Authors** | name, email, bio, link | Deploy hooks on change |
| **Categories** | name, slug (unique), description | Deploy hooks on change |
| **Tags** | name, slug (unique), description | Deploy hooks on change |
| **Comments** | author, email, content, article, approved, createdAt | Public create, hidden from admin |
| **DeployQueue** | key, pendingFullRefresh, changes[] | Internal, hidden |

### 2.4 Access Control

| Collection | Read | Create | Update | Delete |
|-----------|------|--------|--------|--------|
| Users | admin | admin | admin | admin |
| Media | public | auth | auth | auth |
| Authors | public | auth | auth | auth |
| Categories | public | auth | auth | auth |
| Tags | public | auth | auth | auth |
| Articles | public | auth | auth | auth |
| Comments | **public** | **public** | auth | auth |
| DeployQueue | auth | auth | auth | auth |

### 2.5 Hooks Architecture

**Article hooks (7):**

| Hook | Phase | Purpose |
|------|-------|---------|
| forcePrimaryReadWhenDraftQuery | beforeOperation | Route draft queries to primary DB |
| autoGenerateArticleDerivedFields | beforeValidate | Auto-generate slug, SEO title/description |
| normalizeRecipeBlocks | beforeValidate | Normalize recipe card structures |
| normalizeArticleRelationships | beforeValidate | Normalize relationship references |
| autoTranslateFromSource | beforeChange | DeepL auto-translation (45 texts/batch) |
| validateArticlePublicationChecklist | beforeChange | Validate required fields before publish |
| applyTranslationReviewWorkflow | beforeChange | Translation approval workflow |

**Deploy hooks:** All major collections trigger `appendDeployQueueChange` + `dispatchPayloadWebhook` on afterChange/afterDelete.

### 2.6 Custom API Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/deploy-frontend` | POST | Required | Trigger frontend deployment via Coolify webhook |
| `/api/deploy-frontend/status` | GET | Required | Monitor GitHub Actions deployment progress |
| `/api/translate` | POST | **None** | DeepL translation (texts[] -> translations[]) |

### 2.7 Admin Components

- `DeployFrontendButton.tsx` - Sidebar deploy trigger
- `DeployFrontendSidebarButton.tsx` - Dashboard deploy button
- `InlineSlugEditor.tsx` - Inline slug editing
- `RecipeEditorProgress.tsx` - Article completion indicator
- `ExcerptField.tsx` - Custom excerpt field

### 2.8 Block Types

1. EditorialNoteBlock
2. ImageGalleryBlock
3. IntroductionBlock
4. RecipeCardBlock

### 2.9 Environment Variables

```bash
# Required
DATABASE_URL          # MongoDB connection string
PAYLOAD_SECRET        # JWT signing secret

# Frontend Deployment
FRONTEND_DEPLOY_WEBHOOK_URL    # Coolify/custom webhook
FRONTEND_DEPLOY_WEBHOOK_TOKEN  # Bearer token
FRONTEND_DEPLOY_TIMEOUT_MS     # Timeout (default: 12000)

# Legacy GitHub Actions
ASTRO_WEBHOOK_URL              # GitHub dispatch URL
GITHUB_DISPATCH_TOKEN          # GitHub PAT

# Translation
DEEPL_API_KEY                  # DeepL API key
DEEPL_API_URL                  # DeepL endpoint
TRANSLATE_ALLOWED_ORIGINS      # CORS origins

# S3 Storage (optional)
S3_ENABLED / S3_BUCKET / S3_REGION / S3_ENDPOINT
S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY
S3_FORCE_PATH_STYLE / S3_DISABLE_LOCAL_STORAGE

# Webhooks
FORCE_WEBHOOKS                 # Force in dev (default: false)
AUTO_SNAPSHOT_ON_CHANGE        # Auto-snapshot (default: true)
```

### 2.10 Deployment

**Dockerfile:**
- Multi-stage: deps -> builder -> prod-deps -> runner
- Base: node:22-bookworm-slim
- Runtime user: nextjs (UID 1001, non-root)
- Port: 3000
- Health check: HTTP GET /, 30s interval
- 8GB heap allocation for build

**Docker Compose (local dev):**
- Node 18-alpine + MongoDB latest (WiredTiger)
- Volume mounts for live reload

### 2.11 Testing

| Type | File | Coverage |
|------|------|----------|
| Integration (Vitest) | `tests/int/api.int.spec.ts` | 1 test (users fetch) |
| E2E (Playwright) | `tests/e2e/frontend.e2e.spec.ts` | 1 test (homepage h1) |

**Assessment:** 2 tests total. No collection logic tested, no hook testing, no API endpoint testing, no security tests. **Severely insufficient.**

### 2.12 Cursor Rules Summary

13 rule files covering: Payload overview, security-critical patterns, access control (basic + advanced), collections, hooks, endpoints, fields, queries, adapters, components, plugin development, field type guards.

**Key emphasis:** Local API `overrideAccess` bypass warning, transaction atomicity with `req`, infinite loop prevention.

---

## 3. Issues Summary

### CRITICAL

| # | Area | Issue | Impact |
|---|------|-------|--------|
| 1 | Front | **Test pages in production** (`test-golden-recipe.astro`, `test-translation.astro`) | SEO pollution, user confusion |
| 2 | Front | **No 404 page** - No `404.astro` defined | Poor UX on broken links |
| 3 | Front | **Render-blocking fonts** - Google Fonts via `<link>` tags | Core Web Vitals failure |
| 4 | Front | **Hreflang incomplete** - Only FR/EN, missing ES/PT-BR/AR | International SEO broken |
| 5 | Back | **Missing `overrideAccess: false`** in Local API operations | Permission bypass risk |
| 6 | Back | **Public comments without moderation** - No CAPTCHA, no rate limit | Spam vulnerability |
| 7 | Back | **`/api/translate` no rate limiting** - Public endpoint with API cost | Abuse/DDoS risk |
| 8 | Back | **Draft articles exposed** - `read: () => true` without draft filter | Unpublished content leaked |

### HIGH

| # | Area | Issue | Impact |
|---|------|-------|--------|
| 9 | Front | **Duplicate components** (RecipeCard, Pagination, Header in 2 places) | Maintenance confusion |
| 10 | Front | **111+ `any` types** in TypeScript | Refactoring risk, no type safety |
| 11 | Front | **No image optimization** - Raw `<img>`, no srcset/lazy loading | Performance, bandwidth |
| 12 | Front | **Unused dependencies** (richtext-slate, db-postgres) | Bundle bloat |
| 13 | Front | **Staging URL hardcoded** in astro.config.mjs | Wrong canonical URLs |
| 14 | Front | **15.6MB search index** in public/ not lazy-loaded | Slow page loads |
| 15 | Front | **111 console.log calls** in production | Performance, info leak |
| 16 | Back | **Slug collision risk** - Same slug allowed across languages | Routing conflicts |
| 17 | Back | **Infinite hook loop risk** - afterChange -> DeployQueue -> hooks | Server crash |
| 18 | Back | **2 tests total** - No meaningful test coverage | Regression risk |

### MEDIUM

| # | Area | Issue | Impact |
|---|------|-------|--------|
| 19 | Front | No gzip/brotli compression | Transfer size |
| 20 | Front | No WebP/AVIF format negotiation | Image bandwidth |
| 21 | Front | External font dependency (onlinewebfonts.com) | Reliability |
| 22 | Front | No component documentation | Developer onboarding |
| 23 | Back | No row-level security (any auth user edits all) | Data integrity |
| 24 | Back | Generic error handling (no structured codes) | Debugging difficulty |
| 25 | Back | No deployment audit trail | Traceability |
| 26 | Back | Comment content length not limited | Storage abuse |

---

## 4. Recommendations

### Pre-Launch (estimated 4-6 hours)

| Action | Effort | Priority |
|--------|--------|----------|
| Delete test pages (`test-*.astro`) | 5 min | CRITICAL |
| Create `404.astro` page | 10 min | CRITICAL |
| Fix hreflang tags for all 5 languages | 15 min | CRITICAL |
| Optimize font loading (async / `@font-face`) | 30 min | CRITICAL |
| Add `overrideAccess: false` to Payload Local API ops | 30 min | CRITICAL |
| Add rate limiting on `/api/translate` | 30 min | CRITICAL |
| Filter drafts in Articles read access control | 15 min | CRITICAL |
| Remove unused deps (slate, postgres) | 10 min | HIGH |
| Consolidate duplicate components | 1-2h | HIGH |
| Change astro.config site URL to production | 5 min | HIGH |

### Post-Launch

| Action | Effort | Priority |
|--------|--------|----------|
| Migrate to Astro `<Image />` for responsive images + WebP | 3-4h | HIGH |
| Create Article/Recipe TypeScript types, reduce `any` usage | 3-4h | HIGH |
| Add CAPTCHA to public comment creation | 1h | HIGH |
| Expand test suite (target 80% on critical paths) | 8-12h | HIGH |
| Enable gzip/brotli compression in Nginx | 30 min | MEDIUM |
| Lazy-load search index (15.6MB) | 1-2h | MEDIUM |
| Remove 111 console.log calls | 1h | MEDIUM |
| Add slug uniqueness constraint per language | 30 min | MEDIUM |
| Implement infinite loop prevention (`req.context.skipHooks`) | 1h | MEDIUM |
| Add row-level security in Payload | 2h | MEDIUM |
| Add deployment audit logging | 2h | LOW |
| Add Storybook for component documentation | 4-6h | LOW |
| Add performance monitoring (Sentry, Web Vitals) | 2-3h | LOW |

---

## What's Working Well

- **SEO infrastructure** - Comprehensive meta tags, JSON-LD, sitemap, robots.txt
- **Data pipeline** - Smart fallback system (Payload -> MongoDB -> JSON)
- **Multi-language support** - 5 languages with dynamic DeepL translation
- **Build performance** - 1.95-2.14 seconds for 5,316+ articles
- **CDN integration** - URL replacement and image variant handling
- **Deployment infrastructure** - Multi-stage Docker, Coolify webhooks, ISR support
- **Hook architecture** - Auto-translation, deploy queue, validation workflows
- **Atomic design** - Component organization follows atomic design principles
- **Admin UX** - Custom components (deploy button, slug editor, progress indicator)
- **Draft/versioning** - 80 versions per article with autosave
