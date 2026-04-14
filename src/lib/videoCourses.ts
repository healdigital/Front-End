const VIDEO_COURSES_API_URL =
  process.env.VIDEO_COURSES_API_URL ||
  'https://atelier-lacuisinedebernard.com/api/video-courses';

const VIDEO_COURSES_FEATURED_API_URL =
  process.env.VIDEO_COURSES_FEATURED_API_URL ||
  `${VIDEO_COURSES_API_URL}${VIDEO_COURSES_API_URL.includes('?') ? '&' : '?'}scope=featured`;

const VIDEO_COURSES_FETCH_TIMEOUT_MS = 5000;
const VIDEO_COURSES_CACHE_TTL_MS = 5 * 60 * 1000;
const VIDEO_COURSES_USER_AGENT =
  'Mozilla/5.0 (compatible; LCDBAstro/1.0; +https://lacuisinedebernard.com)';

const DEFAULT_COURSES_URL = '/cours-video';

const FALLBACK_IMAGE_MAP: Array<{ matcher: RegExp; src: string }> = [
  {
    matcher: /p[aâ]te feuillet[eé]e invers[eé]e/i,
    src: 'https://atelier-lacuisinedebernard.com/wp-content/uploads/fluent-community/fluentcom-JDg2G8Pr8b5t7FDLhdbw3HTJDfxsUo9p-fluentcom-Capture-decran-2026-03-26-a-18.16.24.png',
  },
  {
    matcher: /cr[eè]mes? de base|cr[eè]me diplomate|cr[eè]me p[aâ]tissi[eè]re/i,
    src: 'https://atelier-lacuisinedebernard.com/wp-content/uploads/fluent-community/fluentcom-wXu5Bo0LxL1HJHwS16cOnKEkBQVrRvqX-fluentcom-IMG_8113-2.jpg',
  },
  {
    matcher: /millefeuille/i,
    src: 'https://atelier-lacuisinedebernard.com/wp-content/uploads/fluent-community/fluentcom-5ESxvDoe6eY88sOtUNMsiMhVUbvsOG1q-fluentcom-IMG_8120-2.jpg',
  },
];

export interface VideoCourse {
  id: string;
  title: string;
  shortDescription: string;
  courseUrl: string;
  priceType?: string;
  price?: number;
  image: string | null;
  publishedAt?: string;
  lessonCount?: number | null;
  duration?: string | null;
}

const featuredFallbackCourses: VideoCourse[] = [
  {
    id: 'fallback-pate-feuilletee-inversee',
    title: 'La pâte feuilletée inversée',
    shortDescription:
      'Apprenez la technique complète de la pâte feuilletée inversée avec Bernard, étape par étape.',
    courseUrl: 'https://atelier-lacuisinedebernard.com/club/course/pate-feuilletee-inversee/lessons',
    priceType: 'paid',
    price: 0,
    image:
      'https://atelier-lacuisinedebernard.com/wp-content/uploads/fluent-community/fluentcom-JDg2G8Pr8b5t7FDLhdbw3HTJDfxsUo9p-fluentcom-Capture-decran-2026-03-26-a-18.16.24.png',
    publishedAt: '',
    lessonCount: null,
    duration: null,
  },
  {
    id: 'fallback-cremes-de-base',
    title: 'Les Crèmes de Base',
    shortDescription:
      'Les bases incontournables de la pâtisserie française pour réussir vos crèmes maison.',
    courseUrl: 'https://atelier-lacuisinedebernard.com/club/course/les-cremes-de-base/lessons',
    priceType: 'paid',
    price: 0,
    image:
      'https://atelier-lacuisinedebernard.com/wp-content/uploads/fluent-community/fluentcom-wXu5Bo0LxL1HJHwS16cOnKEkBQVrRvqX-fluentcom-IMG_8113-2.jpg',
    publishedAt: '',
    lessonCount: null,
    duration: null,
  },
  {
    id: 'fallback-millefeuille',
    title: 'Millefeuille',
    shortDescription:
      "Le millefeuille de A à Z, avec le montage, la cuisson et l'équilibre des textures expliqués pas à pas.",
    courseUrl: 'https://atelier-lacuisinedebernard.com/club/course/millefeuille/lessons',
    priceType: 'paid',
    price: 0,
    image:
      'https://atelier-lacuisinedebernard.com/wp-content/uploads/fluent-community/fluentcom-5ESxvDoe6eY88sOtUNMsiMhVUbvsOG1q-fluentcom-IMG_8120-2.jpg',
    publishedAt: '',
    lessonCount: null,
    duration: null,
  },
];

const genericFallbackCourses: VideoCourse[] = [...featuredFallbackCourses];

const responseCache = new Map<string, { expiresAt: number; promise: Promise<VideoCourse[]> }>();

const decodeEntities = (value: string): string =>
  String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&hellip;/g, '...')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeCourseText = (value: unknown): string =>
  decodeEntities(String(value || ''))
    .replace(/\s*\.{3}\s*Lire la suite$/i, '')
    .replace(/\s*Lire la suite$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeHref = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_COURSES_URL;
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw.startsWith('/') ? `https://atelier-lacuisinedebernard.com${raw}` : raw;
};

const normalizeCourseImageUrl = (value: unknown): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('/')) return `https://atelier-lacuisinedebernard.com${raw}`;
  return raw;
};

const toPositiveNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : undefined;
};

const normalizeDuration = (value: unknown): string | null => {
  const raw = String(value || '').trim();
  return raw || null;
};

const getFallbackImage = (title: string): string | null =>
  FALLBACK_IMAGE_MAP.find((entry) => entry.matcher.test(title))?.src || '/images/masterclass-video.jpg';

const getForcedCourseImage = (course: Pick<VideoCourse, 'title' | 'courseUrl'>): string | null => {
  const title = normalizeCourseText(course.title);
  const courseUrl = String(course.courseUrl || '').trim().toLowerCase();
  if (/millefeuille/i.test(title) || courseUrl.includes('/course/millefeuille/')) {
    return 'https://atelier-lacuisinedebernard.com/wp-content/uploads/fluent-community/fluentcom-5ESxvDoe6eY88sOtUNMsiMhVUbvsOG1q-fluentcom-IMG_8120-2.jpg';
  }
  return null;
};

const buildCourseKey = (course: Pick<VideoCourse, 'courseUrl' | 'title'>): string => {
  const normalizedUrl = String(course.courseUrl || '').trim().toLowerCase();
  if (normalizedUrl) return `url:${normalizedUrl}`;
  return `title:${normalizeCourseText(course.title).toLowerCase()}`;
};

const mergeCourseDetails = (primary: VideoCourse, canonical?: VideoCourse): VideoCourse => {
  const forcedImage = getForcedCourseImage(primary);
  if (!canonical) return primary;

  return {
    ...primary,
    image: forcedImage || canonical.image || primary.image,
    shortDescription: canonical.shortDescription || primary.shortDescription,
    lessonCount: canonical.lessonCount ?? primary.lessonCount,
    duration: canonical.duration ?? primary.duration,
  };
};

const mapVideoCourse = (item: Record<string, unknown>, index: number): VideoCourse | null => {
  if (!item || typeof item !== 'object') return null;

  const title = normalizeCourseText(item.title);
  if (!title) return null;

  const shortDescription = normalizeCourseText(item.shortDescription);
  const courseUrl = normalizeHref(item.courseUrl);
  const forcedImage = getForcedCourseImage({ title, courseUrl });
  const normalizedImage = normalizeCourseImageUrl(item.image);
  const image =
    forcedImage ||
    (normalizedImage || getFallbackImage(title));

  return {
    id: String(item.id || index + 1),
    title,
    shortDescription,
    courseUrl,
    priceType: String(item.priceType || '').trim().toLowerCase() || undefined,
    price: toPositiveNumber(item.price),
    image,
    publishedAt: String(item.publishedAt || '').trim() || undefined,
    lessonCount:
      item.lessonCount === undefined || item.lessonCount === null
        ? null
        : toPositiveNumber(item.lessonCount) ?? null,
    duration: normalizeDuration(item.duration),
  };
};

const fetchVideoCourses = async (url: string, fallbackCourses: VideoCourse[]): Promise<VideoCourse[]> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VIDEO_COURSES_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': VIDEO_COURSES_USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`video_courses_fetch_http_${response.status}`);
    }

    const payload = await response.json();
    const items = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
        ? payload
        : [];

    const normalized = items
      .map((item: unknown, index: number) => mapVideoCourse(item as Record<string, unknown>, index))
      .filter(Boolean) as VideoCourse[];

    const deduped = normalized.filter(
      (course, index, list) =>
        list.findIndex((candidate) => candidate.title.localeCompare(course.title, 'fr') === 0) === index,
    );

    return deduped.length ? deduped : fallbackCourses;
  } catch (error) {
    console.warn('[VIDEO] Video courses fetch failed:', error);
    return fallbackCourses;
  } finally {
    clearTimeout(timeout);
  }
};

const getCachedCourses = (url: string, fallbackCourses: VideoCourse[]): Promise<VideoCourse[]> => {
  const cached = responseCache.get(url);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.promise;

  const promise = fetchVideoCourses(url, fallbackCourses);
  responseCache.set(url, {
    expiresAt: now + VIDEO_COURSES_CACHE_TTL_MS,
    promise,
  });
  return promise;
};

export const loadFeaturedCourses = async (): Promise<VideoCourse[]> =>
  {
    const [featuredCourses, allCourses] = await Promise.all([
      getCachedCourses(VIDEO_COURSES_FEATURED_API_URL, featuredFallbackCourses),
      getCachedCourses(VIDEO_COURSES_API_URL, genericFallbackCourses),
    ]);

    const allCourseMap = new Map(allCourses.map((course) => [buildCourseKey(course), course]));

    return featuredCourses.map((course) =>
      mergeCourseDetails(course, allCourseMap.get(buildCourseKey(course))),
    );
  };

export const loadVideoCourses = async (): Promise<VideoCourse[]> =>
  getCachedCourses(VIDEO_COURSES_API_URL, genericFallbackCourses);
