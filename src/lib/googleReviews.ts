export interface GoogleReviewItem {
  author: string;
  authorPhoto: string;
  rating: number;
  text: string;
  relativeTime: string;
  time: number;
}

export interface GoogleReviewsPayload {
  name: string;
  rating: number;
  totalReviews: number;
  reviews: GoogleReviewItem[];
  fetchedAt: string;
}

export interface LoadGoogleReviewsResult {
  data: GoogleReviewsPayload | null;
  endpoint: string | null;
  reviewsPageUrl: string | null;
  error: string | null;
}

const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_ENDPOINT = 'https://atelier-lacuisinedebernard.com/wp-json/api/google-reviews';

const toAbsoluteUrl = (endpoint: string): string => {
  if (/^https?:\/\//i.test(endpoint)) {
    return endpoint;
  }

  const siteUrl = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || '';
  if (!siteUrl) {
    return endpoint;
  }

  try {
    return new URL(endpoint, siteUrl).toString();
  } catch {
    return endpoint;
  }
};

const normalizeReview = (value: unknown): GoogleReviewItem | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const item = value as Record<string, unknown>;
  const author = String(item.author || '').trim();
  const text = String(item.text || '').trim();
  const relativeTime = String(item.relative_time || '').trim();
  const authorPhoto = String(item.author_photo || '').trim();
  const rating = Number(item.rating || 0);
  const time = Number(item.time || 0);

  if (!author || !text || !Number.isFinite(rating) || rating <= 0) {
    return null;
  }

  return {
    author,
    authorPhoto,
    rating: Math.max(0, Math.min(5, rating)),
    text,
    relativeTime,
    time: Number.isFinite(time) ? time : 0,
  };
};

const normalizePayload = (value: unknown): GoogleReviewsPayload | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const name = String(payload.name || '').trim();
  const rating = Number(payload.rating || 0);
  const totalReviews = Number(payload.total_reviews || 0);
  const fetchedAt = String(payload.fetched_at || '').trim();
  const reviewsSource = Array.isArray(payload.reviews) ? payload.reviews : [];
  const reviews = reviewsSource
    .map((item) => normalizeReview(item))
    .filter((item): item is GoogleReviewItem => Boolean(item));

  if (!name || !Number.isFinite(rating) || reviews.length === 0) {
    return null;
  }

  return {
    name,
    rating: Math.max(0, Math.min(5, rating)),
    totalReviews: Number.isFinite(totalReviews) ? totalReviews : reviews.length,
    reviews,
    fetchedAt,
  };
};

export const getGoogleReviewsEndpoint = (): string | null => {
  const rawEndpoint =
    process.env.GOOGLE_REVIEWS_ENDPOINT ||
    process.env.PUBLIC_GOOGLE_REVIEWS_ENDPOINT ||
    DEFAULT_ENDPOINT;

  const endpoint = String(rawEndpoint || '').trim();
  if (!endpoint) {
    return null;
  }

  return toAbsoluteUrl(endpoint);
};

export const getGoogleReviewsPageUrl = (): string | null => {
  const directUrl =
    process.env.GOOGLE_REVIEWS_PAGE_URL ||
    process.env.PUBLIC_GOOGLE_REVIEWS_PAGE_URL ||
    '';

  const normalizedDirectUrl = String(directUrl).trim();
  if (normalizedDirectUrl) {
    return normalizedDirectUrl;
  }

  const placeId =
    process.env.GOOGLE_PLACE_ID ||
    process.env.PUBLIC_GOOGLE_PLACE_ID ||
    '';

  const normalizedPlaceId = String(placeId).trim();
  if (!normalizedPlaceId) {
    return null;
  }

  return `https://search.google.com/local/reviews?placeid=${encodeURIComponent(normalizedPlaceId)}`;
};

export const loadGoogleReviews = async (
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<LoadGoogleReviewsResult> => {
  const endpoint = getGoogleReviewsEndpoint();
  const reviewsPageUrl = getGoogleReviewsPageUrl();

  if (!endpoint) {
    return {
      data: null,
      endpoint: null,
      reviewsPageUrl,
      error: 'missing_endpoint',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        data: null,
        endpoint,
        reviewsPageUrl,
        error: `http_${response.status}`,
      };
    }

    const json = await response.json();
    const data = normalizePayload(json);

    if (!data) {
      return {
        data: null,
        endpoint,
        reviewsPageUrl,
        error: 'invalid_payload',
      };
    }

    return {
      data,
      endpoint,
      reviewsPageUrl,
      error: null,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'timeout'
        : 'fetch_failed';

    return {
      data: null,
      endpoint,
      reviewsPageUrl,
      error: message,
    };
  } finally {
    clearTimeout(timeout);
  }
};
