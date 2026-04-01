# Google Reviews Integration — Astro Blog Brief

## Overview

Display Google reviews on the Astro blog by consuming data already served by the existing WordPress plugin **"Google Reviews pour Bernard"** via a Cloudflare Worker edge cache.

---

## Existing Infrastructure

### 1. WordPress Plugin (`google-reviews-bernard`)

- **Settings** (WP Admin > Settings > Google Reviews):
  - `grb_api_key` — Google API key (Places API enabled)
  - `grb_place_id` — Google Maps Place ID
  - `grb_cache_duration` — WP transient TTL (default 24h)
- **REST endpoint**: `GET /wp-json/api/google-reviews` (public, no auth required)
- **Caching**: WP transients, configurable 1h–7d
- **Response shape**:

```json
{
  "name": "La Cuisine de Bernard",
  "rating": 4.8,
  "total_reviews": 342,
  "reviews": [
    {
      "author": "Jane Doe",
      "author_photo": "https://lh3.googleusercontent.com/...",
      "rating": 5,
      "text": "Review text content...",
      "relative_time": "il y a 2 semaines",
      "time": 1710000000
    }
  ],
  "fetched_at": "2026-03-31T10:00:00+02:00"
}
```

- **Limits**: Google Places API returns max 5 reviews per request, sorted by `newest`.

### 2. Cloudflare Worker (`reviews-cache.js`)

- **Route**: `/api/reviews-cache`
- **Upstream**: `https://atelier-lacuisinedebernard.com/wp-json/api/google-reviews`
- **Edge cache TTL**: 24 hours (`s-maxage=86400`)
- **Browser cache**: 1 hour (`max-age=3600`)
- **Fallback**: returns stale cache on upstream failure, then empty response with `error: "upstream_unavailable"`
- **CORS**: `Access-Control-Allow-Origin: *`

### 3. Existing Astro Component (`GoogleReviews.astro`)

A fully built component already exists at `A trier/Bernard/astro-components/GoogleReviews.astro`. It:
- Fetches from `/api/reviews-cache` at build/SSR time with a 3s timeout
- Renders a header (Google icon + aggregated rating + star count)
- Displays reviews in a responsive grid of cards (avatar, author, date, stars, text)
- Links to Google reviews page using `GOOGLE_PLACE_ID` env var
- Includes full CSS (light theme, responsive, hover effects)
- Handles error/empty states gracefully

---

## Integration Steps for the Astro Blog

### Step 1 — Environment Variable

Add to `.env`:

```
GOOGLE_PLACE_ID=ChIJ...  # Same Place ID as WordPress plugin
```

### Step 2 — Cloudflare Worker Deployment

Deploy `reviews-cache.js` as a Cloudflare Worker (or Cloudflare Pages Function) on the same domain as the Astro blog, mapped to route `/api/reviews-cache`.

Alternatively, if the Astro blog runs on a different domain, point the fetch URL directly to the WordPress REST endpoint or to a dedicated Worker subdomain.

### Step 3 — Add the Component

Copy `GoogleReviews.astro` into the blog's `src/components/` directory and import it in the target page(s):

```astro
---
import GoogleReviews from '@/components/GoogleReviews.astro';
---

<GoogleReviews />
```

### Step 4 — Style Adjustments

The component ships with scoped CSS. Adapt if needed:
- Font family (currently system fonts)
- Color tokens to match the blog design system
- Grid breakpoints
- Card border-radius, background, shadow

---

## Data Flow

```
Google Places API
       |
       v  (cached via WP transient, 24h)
WordPress REST API  (/wp-json/api/google-reviews)
       |
       v  (cached at edge, 24h)
Cloudflare Worker   (/api/reviews-cache)
       |
       v  (fetched at build/SSR time, 3s timeout)
Astro Component     (GoogleReviews.astro)
```

---

## Key Considerations

| Topic | Detail |
|---|---|
| **Google API quota** | Places API has daily limits; double caching (WP + CF) keeps calls minimal |
| **Max reviews** | Google returns max 5 reviews per API call — this is a platform limit, not a plugin limit |
| **Freshness** | Reviews update every ~24h (WP transient TTL + CF edge TTL) |
| **Language** | Reviews fetched in French (`language=fr` in plugin) |
| **Sort order** | `newest` — most recent reviews first |
| **SSR vs SSG** | Component works with both; with SSG, reviews are frozen at build time |
| **Fallback** | On fetch failure: shows "Les avis seront disponibles prochainement." |
| **SEO** | Reviews render server-side (no client JS needed), good for SEO |
| **Dark mode** | Not implemented in Astro component (WP plugin supports it via `theme="dark"`) — add if needed |

---

## Optional Enhancements

1. **Dark mode support** — Add CSS variables toggled by a `data-theme` attribute
2. **"Read more" toggle** — Currently text is clamped at 5 lines; add expand/collapse
3. **Schema.org markup** — Add `AggregateRating` and `Review` structured data for rich snippets
4. **ISR / on-demand revalidation** — If using Astro SSR with Cloudflare adapter, use `Cache-Control` headers for incremental static regeneration
5. **Direct Google API call from Astro** — Skip WordPress entirely by calling the Places API from an Astro API route with KV/cache (removes WordPress dependency)


Leo Turbet-Delof
8:27 PM
"These are not the texts I corrected."

[3/31/2026 4:58:30 PM] Bernard's Kitchen: And the carousel is fixed
[3/31/2026 4:58:34 PM] Bernard's Kitchen: It's not moving

https://www.happyscribe.com/transcriptions/8263517db01e4e80964827c8ce5b367e/edit?organization_id=6411621

LT
Leo Turbet-Delof
8:35 PM
Hmm seems working on my side

It's from the computer's client